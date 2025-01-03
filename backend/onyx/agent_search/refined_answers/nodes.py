from onyx.agent_search.answer_question.states import AnswerQuestionState
from onyx.agent_search.answer_question.states import QuestionAnswerResults
from onyx.agent_search.main.states import FollowUpAnswerQuestionOutput


def format_follow_up_answer(state: AnswerQuestionState) -> FollowUpAnswerQuestionOutput:
    return FollowUpAnswerQuestionOutput(
        follow_up_answer_results=[
            QuestionAnswerResults(
                question=state["question"],
                quality=state.get("answer_quality", "No"),
                answer=state["answer"],
                # expanded_retrieval_results=state["expanded_retrieval_results"],
                documents=state["documents"],
                sub_question_retrieval_stats=state["sub_question_retrieval_stats"],
            )
        ],
    )


# def ingest_follow_up_answers(state: AnswerQuestionOutput) -> DecompAnswersUpdate:
#     documents = []
#     answer_results = state.get("answer_results", [])
#     for answer_result in answer_results:
#         documents.extend(answer_result.documents)
#     return DecompAnswersUpdate(
#         # Deduping is done by the documents operator for the main graph
#         # so we might not need to dedup here
#         documents=dedup_inference_sections(documents, []),
#         decomp_answer_results=answer_results,
#     )
