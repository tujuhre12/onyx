from datetime import datetime
from typing import cast

import openai
from langchain_core.messages import BaseMessage
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from langgraph.types import StreamWriter

from onyx.agents.agent_search.deep_search.main.states import (
    InitialRefinedAnswerComparisonUpdate,
)
from onyx.agents.agent_search.deep_search.main.states import MainState
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.shared_graph_utils.models import AgentError
from onyx.agents.agent_search.shared_graph_utils.utils import (
    get_langgraph_node_log_string,
)
from onyx.agents.agent_search.shared_graph_utils.utils import write_custom_event
from onyx.chat.models import RefinedAnswerImprovement
from onyx.configs.agent_configs import AGENT_TIMEOUT_OVERWRITE_LLM_COMPARE_ANSWERS
from onyx.prompts.agent_search import AGENT_LLM_ERROR_MESSAGE
from onyx.prompts.agent_search import AGENT_LLM_TIMEOUT_MESSAGE
from onyx.prompts.agent_search import (
    INITIAL_REFINED_ANSWER_COMPARISON_PROMPT,
)


def compare_answers(
    state: MainState, config: RunnableConfig, writer: StreamWriter = lambda _: None
) -> InitialRefinedAnswerComparisonUpdate:
    """
    LangGraph node to compare the initial answer and the refined answer and determine if the
    refined answer is sufficiently better than the initial answer.
    """
    node_start_time = datetime.now()

    graph_config = cast(GraphConfig, config["metadata"]["config"])
    question = graph_config.inputs.search_request.query
    initial_answer = state.initial_answer
    refined_answer = state.refined_answer

    compare_answers_prompt = INITIAL_REFINED_ANSWER_COMPARISON_PROMPT.format(
        question=question, initial_answer=initial_answer, refined_answer=refined_answer
    )

    msg = [HumanMessage(content=compare_answers_prompt)]

    agent_error: AgentError | None = None
    # Get the rewritten queries in a defined format
    model = graph_config.tooling.fast_llm
    resp: BaseMessage | None = None
    refined_answer_improvement: bool | None = None
    # no need to stream this
    try:
        resp = model.invoke(
            msg, timeout_overwrite=AGENT_TIMEOUT_OVERWRITE_LLM_COMPARE_ANSWERS
        )

    except openai.APITimeoutError:
        agent_error = AgentError(
            error_type="timeout",
            error_message=AGENT_LLM_TIMEOUT_MESSAGE,
            error_result="The LLM timed out, and the answers could not be compared.",
        )

    except Exception:
        agent_error = AgentError(
            error_type="LLM error",
            error_message=AGENT_LLM_ERROR_MESSAGE,
            error_result="The LLM errored out, and the answers could not be compared.",
        )

    if agent_error or resp is None:
        refined_answer_improvement = True
        if agent_error:
            log_result = agent_error.error_result
        else:
            log_result = "An answer could not be generated."

    else:
        refined_answer_improvement = (
            isinstance(resp.content, str) and "yes" in resp.content.lower()
        )
        log_result = f"Answer comparison: {refined_answer_improvement}"

    write_custom_event(
        "refined_answer_improvement",
        RefinedAnswerImprovement(
            refined_answer_improvement=refined_answer_improvement,
        ),
        writer,
    )

    return InitialRefinedAnswerComparisonUpdate(
        refined_answer_improvement_eval=refined_answer_improvement,
        log_messages=[
            get_langgraph_node_log_string(
                graph_component="main",
                node_name="compare answers",
                node_start_time=node_start_time,
                result=log_result,
            )
        ],
    )
