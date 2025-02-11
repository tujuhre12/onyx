from datetime import datetime
from typing import cast

from langchain_core.messages import BaseMessage
from langchain_core.messages import HumanMessage
from langchain_core.runnables.config import RunnableConfig

from onyx.agents.agent_search.deep_search.initial.generate_individual_sub_answer.states import (
    AnswerQuestionState,
)
from onyx.agents.agent_search.deep_search.initial.generate_individual_sub_answer.states import (
    SubQuestionAnswerCheckUpdate,
)
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.shared_graph_utils.agent_prompt_ops import (
    binary_string_test,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_LLM_RATELIMIT_MESSAGE,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_LLM_TIMEOUT_MESSAGE,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_POSITIVE_VALUE_STR,
)
from onyx.agents.agent_search.shared_graph_utils.constants import AgentLLMErrorType
from onyx.agents.agent_search.shared_graph_utils.models import AgentError
from onyx.agents.agent_search.shared_graph_utils.utils import (
    get_langgraph_node_log_string,
)
from onyx.agents.agent_search.shared_graph_utils.utils import parse_question_id
from onyx.configs.agent_configs import AGENT_TIMEOUT_OVERRIDE_LLM_SUBANSWER_CHECK
from onyx.llm.chat_llm import LLMRateLimitError
from onyx.llm.chat_llm import LLMTimeoutError
from onyx.prompts.agent_search import SUB_ANSWER_CHECK_PROMPT
from onyx.prompts.agent_search import UNKNOWN_ANSWER
from onyx.utils.logger import setup_logger

logger = setup_logger()


def check_sub_answer(
    state: AnswerQuestionState, config: RunnableConfig
) -> SubQuestionAnswerCheckUpdate:
    """
    LangGraph node to check the quality of the sub-answer. The answer
    is represented as a boolean value.
    """
    node_start_time = datetime.now()

    level, question_num = parse_question_id(state.question_id)
    if state.answer == UNKNOWN_ANSWER:
        return SubQuestionAnswerCheckUpdate(
            answer_quality=False,
            log_messages=[
                get_langgraph_node_log_string(
                    graph_component="initial  - generate individual sub answer",
                    node_name="check sub answer",
                    node_start_time=node_start_time,
                    result="unknown answer",
                )
            ],
        )
    msg = [
        HumanMessage(
            content=SUB_ANSWER_CHECK_PROMPT.format(
                question=state.question,
                base_answer=state.answer,
            )
        )
    ]

    graph_config = cast(GraphConfig, config["metadata"]["config"])
    fast_llm = graph_config.tooling.fast_llm
    agent_error: AgentError | None = None
    response: BaseMessage | None = None
    try:
        response = fast_llm.invoke(
            prompt=msg,
            timeout_override=AGENT_TIMEOUT_OVERRIDE_LLM_SUBANSWER_CHECK,
        )

    except LLMTimeoutError:
        agent_error = AgentError(
            error_type=AgentLLMErrorType.TIMEOUT,
            error_message=AGENT_LLM_TIMEOUT_MESSAGE,
            error_result="LLM Timeout Error",
        )
        logger.error("LLM Timeout Error - check sub answer")

    except LLMRateLimitError:
        agent_error = AgentError(
            error_type=AgentLLMErrorType.RATE_LIMIT,
            error_message=AGENT_LLM_RATELIMIT_MESSAGE,
            error_result="LLM Rate Limit Error",
        )
        logger.error("LLM Rate Limit Error - check sub answer")

    if agent_error:
        answer_quality = True
        log_result = agent_error.error_result

    else:
        if response:
            quality_str: str = cast(str, response.content)
            answer_quality = binary_string_test(
                text=quality_str, positive_value=AGENT_POSITIVE_VALUE_STR
            )

        else:
            answer_quality = True
            quality_str = "yes - because LLM error"

        log_result = f"Answer quality: {quality_str}"

    return SubQuestionAnswerCheckUpdate(
        answer_quality=answer_quality,
        log_messages=[
            get_langgraph_node_log_string(
                graph_component="initial  - generate individual sub answer",
                node_name="check sub answer",
                node_start_time=node_start_time,
                result=log_result,
            )
        ],
    )
