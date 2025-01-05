from onyx.agent_search.answer_question.states import AnswerQuestionOutput
from onyx.agent_search.answer_question.states import AnswerQuestionState
from onyx.agent_search.answer_question.states import QuestionAnswerResults


def format_answer(state: AnswerQuestionState) -> AnswerQuestionOutput:
    # sub_question_retrieval_stats = state["sub_question_retrieval_stats"]
    # if sub_question_retrieval_stats is None:
    #     sub_question_retrieval_stats = []
    # elif isinstance(sub_question_retrieval_stats, list):
    #     sub_question_retrieval_stats = sub_question_retrieval_stats
    #     if isinstance(sub_question_retrieval_stats[0], list):
    #         sub_question_retrieval_stats = sub_question_retrieval_stats[0]
    # else:
    #     sub_question_retrieval_stats = [sub_question_retrieval_stats]

    return AnswerQuestionOutput(
        answer_results=[
            QuestionAnswerResults(
                question=state["question"],
                question_nr=state["question_nr"],
                quality=state.get("answer_quality", "No"),
                answer=state["answer"],
                expanded_retrieval_results=state["expanded_retrieval_results"],
                documents=state["documents"],
                sub_question_retrieval_stats=state["sub_question_retrieval_stats"],
            )
        ],
    )
