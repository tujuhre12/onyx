from datetime import datetime
from typing import cast

import openai
from langchain_core.messages import HumanMessage
from langchain_core.messages import merge_message_runs
from langchain_core.runnables.config import RunnableConfig

from onyx.agents.agent_search.deep_search.initial.generate_individual_sub_answer.states import (
    AnswerQuestionState,
)
from onyx.agents.agent_search.deep_search.initial.generate_individual_sub_answer.states import (
    SubQuestionAnswerCheckUpdate,
)
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.shared_graph_utils.models import AgentError
from onyx.agents.agent_search.shared_graph_utils.utils import (
    get_langgraph_node_log_string,
)
from onyx.agents.agent_search.shared_graph_utils.utils import parse_question_id
from onyx.configs.agent_configs import AGENT_TIMEOUT_OVERWRITE_LLM_SUBANSWER_CHECK
from onyx.prompts.agent_search import AGENT_LLM_ERROR_MESSAGE
from onyx.prompts.agent_search import AGENT_LLM_TIMEOUT_MESSAGE
from onyx.prompts.agent_search import SUB_ANSWER_CHECK_PROMPT
from onyx.prompts.agent_search import UNKNOWN_ANSWER


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
    response: list | None = None
    try:
        response = list(
            fast_llm.stream(
                prompt=msg,
                timeout_overwrite=AGENT_TIMEOUT_OVERWRITE_LLM_SUBANSWER_CHECK,
            )
        )

    except openai.APITimeoutError:
        agent_error = AgentError(
            error_type="timeout",
            error_message=AGENT_LLM_TIMEOUT_MESSAGE,
            error_result="LLM Timeout Error",
        )

    except Exception:
        agent_error = AgentError(
            error_type="LLM error",
            error_message=AGENT_LLM_ERROR_MESSAGE,
            error_result="LLM Error",
        )

    if agent_error:
        answer_quality = True
        log_result = agent_error.error_result

    else:
        if response:
            quality_str: str = merge_message_runs(response, chunk_separator="")[
                0
            ].content
            answer_quality = "yes" in quality_str.lower()

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
