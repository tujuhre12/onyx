from typing import cast

from langchain_core.messages import HumanMessage
from langchain_core.messages import merge_message_runs
from langchain_core.runnables.config import RunnableConfig

from onyx.agent_search.models import ProSearchConfig
from onyx.agent_search.pro_search_a.answer_initial_sub_question.states import (
    AnswerQuestionState,
)
from onyx.agent_search.pro_search_a.answer_initial_sub_question.states import (
    QACheckUpdate,
)
from onyx.agent_search.shared_graph_utils.prompts import SUB_CHECK_NO
from onyx.agent_search.shared_graph_utils.prompts import SUB_CHECK_PROMPT
from onyx.agent_search.shared_graph_utils.prompts import UNKNOWN_ANSWER


def answer_check(state: AnswerQuestionState, config: RunnableConfig) -> QACheckUpdate:
    if state["answer"] == UNKNOWN_ANSWER:
        return QACheckUpdate(
            answer_quality=SUB_CHECK_NO,
        )
    msg = [
        HumanMessage(
            content=SUB_CHECK_PROMPT.format(
                question=state["question"],
                base_answer=state["answer"],
            )
        )
    ]

    pro_search_config = cast(ProSearchConfig, config["metadata"]["config"])
    fast_llm = pro_search_config.fast_llm
    response = list(
        fast_llm.stream(
            prompt=msg,
        )
    )

    quality_str = merge_message_runs(response, chunk_separator="")[0].content

    return QACheckUpdate(
        answer_quality=quality_str,
    )
