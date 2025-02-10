from datetime import datetime
from typing import Any
from typing import cast

from langchain_core.messages import HumanMessage
from langchain_core.messages import merge_message_runs
from langchain_core.runnables.config import RunnableConfig
from langgraph.types import StreamWriter

from onyx.agents.agent_search.deep_search.shared.expanded_retrieval.operations import (
    dispatch_subquery,
)
from onyx.agents.agent_search.deep_search.shared.expanded_retrieval.states import (
    ExpandedRetrievalInput,
)
from onyx.agents.agent_search.deep_search.shared.expanded_retrieval.states import (
    QueryExpansionUpdate,
)
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_LLM_ERROR_MESSAGE,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_LLM_RATELIMIT_MESSAGE,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_LLM_TIMEOUT_MESSAGE,
)
from onyx.agents.agent_search.shared_graph_utils.models import AgentError
from onyx.agents.agent_search.shared_graph_utils.utils import dispatch_separated
from onyx.agents.agent_search.shared_graph_utils.utils import (
    get_langgraph_node_log_string,
)
from onyx.agents.agent_search.shared_graph_utils.utils import parse_question_id
from onyx.configs.agent_configs import (
    AGENT_TIMEOUT_OVERWRITE_LLM_QUERY_REWRITING_GENERATION,
)
from onyx.llm.chat_llm import LLMRateLimitError
from onyx.llm.chat_llm import LLMTimeoutError
from onyx.prompts.agent_search import (
    QUERY_REWRITING_PROMPT,
)
from onyx.utils.logger import setup_logger

logger = setup_logger()

BaseMessage_Content = str | list[str | dict[str, Any]]


def expand_queries(
    state: ExpandedRetrievalInput,
    config: RunnableConfig,
    writer: StreamWriter = lambda _: None,
) -> QueryExpansionUpdate:
    """
    LangGraph node to expand a question into multiple search queries.
    """
    # Sometimes we want to expand the original question, sometimes we want to expand a sub-question.
    # When we are running this node on the original question, no question is explictly passed in.
    # Instead, we use the original question from the search request.
    graph_config = cast(GraphConfig, config["metadata"]["config"])
    node_start_time = datetime.now()
    question = state.question

    llm = graph_config.tooling.fast_llm
    sub_question_id = state.sub_question_id
    if sub_question_id is None:
        level, question_num = 0, 0
    else:
        level, question_num = parse_question_id(sub_question_id)

    msg = [
        HumanMessage(
            content=QUERY_REWRITING_PROMPT.format(question=question),
        )
    ]

    agent_error: AgentError | None = None
    llm_response_list: list[BaseMessage_Content] = []

    try:
        llm_response_list = dispatch_separated(
            llm.stream(
                prompt=msg,
                timeout_overwrite=AGENT_TIMEOUT_OVERWRITE_LLM_QUERY_REWRITING_GENERATION,
            ),
            dispatch_subquery(level, question_num, writer),
        )
    except LLMTimeoutError:
        agent_error = AgentError(
            error_type="timeout",
            error_message=AGENT_LLM_TIMEOUT_MESSAGE,
            error_result="Query rewriting failed due to LLM timeout - use original question.",
        )
        logger.error("LLM Timeout Error - expand queries")

    except LLMRateLimitError:
        agent_error = AgentError(
            error_type="rate limit",
            error_message=AGENT_LLM_RATELIMIT_MESSAGE,
            error_result="LLM Rate Limit Error",
        )
        logger.error("LLM Rate Limit Error - expand queries")

    except Exception:
        agent_error = AgentError(
            error_type="LLM error",
            error_message=AGENT_LLM_ERROR_MESSAGE,
            error_result="Query rewriting failed due to LLM error - use question.",
        )
        logger.error("General LLM Error - expand queries")

    # use subquestion as query if query generation fails
    if agent_error:
        llm_response = ""
        rewritten_queries = [question]
        log_result = agent_error.error_result
    else:
        llm_response = merge_message_runs(llm_response_list, chunk_separator="")[
            0
        ].content
        rewritten_queries = llm_response.split("\n")
        log_result = f"Number of expanded queries: {len(rewritten_queries)}"

    return QueryExpansionUpdate(
        expanded_queries=rewritten_queries,
        log_messages=[
            get_langgraph_node_log_string(
                graph_component="shared - expanded retrieval",
                node_name="expand queries",
                node_start_time=node_start_time,
                result=log_result,
            )
        ],
    )
