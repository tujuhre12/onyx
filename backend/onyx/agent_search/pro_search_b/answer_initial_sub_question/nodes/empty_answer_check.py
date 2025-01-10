from onyx.agent_search.pro_search_b.answer_initial_sub_question.states import (
    AnswerQuestionState,
)
from onyx.agent_search.pro_search_b.answer_initial_sub_question.states import (
    QACheckUpdate,
)


def answer_check(state: AnswerQuestionState) -> QACheckUpdate:
    # msg = [
    #     HumanMessage(
    #         content=SUB_CHECK_PROMPT.format(
    #             question=state["question"],
    #             base_answer=state["answer"],
    #         )
    #     )
    # ]

    # fast_llm = state["subgraph_fast_llm"]
    # response = list(
    #     fast_llm.stream(
    #         prompt=msg,
    #     )
    # )

    # quality_str = merge_message_runs(response, chunk_separator="")[0].content

    quality_str = "yes"

    return QACheckUpdate(
        answer_quality=quality_str,
    )
