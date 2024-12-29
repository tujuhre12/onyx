from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalOutput
from onyx.agent_search.main.states import ExpandedRetrievalUpdate


def ingest_initial_retrieval(state: ExpandedRetrievalOutput) -> ExpandedRetrievalUpdate:
    sub_question_retrieval_stats = state[
        "expanded_retrieval_result"
    ].sub_question_retrieval_stats
    if sub_question_retrieval_stats is None:
        sub_question_retrieval_stats = []
    else:
        sub_question_retrieval_stats = [sub_question_retrieval_stats]

    return ExpandedRetrievalUpdate(
        original_question_retrieval_results=state[
            "expanded_retrieval_result"
        ].expanded_queries_results,
        all_original_question_documents=state[
            "expanded_retrieval_result"
        ].all_documents,
        sub_question_retrieval_stats=sub_question_retrieval_stats,
    )
