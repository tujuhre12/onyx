from onyx.agent_search.answer_question.states import RetrievalIngestionUpdate
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalOutput


def ingest_retrieval(state: ExpandedRetrievalOutput) -> RetrievalIngestionUpdate:
    sub_question_retrieval_stats = state[
        "expanded_retrieval_result"
    ].sub_question_retrieval_stats
    if sub_question_retrieval_stats is None:
        sub_question_retrieval_stats = []
    else:
        sub_question_retrieval_stats = [sub_question_retrieval_stats]

    return RetrievalIngestionUpdate(
        expanded_retrieval_results=state[
            "expanded_retrieval_result"
        ].expanded_queries_results,
        documents=state["expanded_retrieval_result"].all_documents,
        sub_question_retrieval_stats=sub_question_retrieval_stats,
    )
