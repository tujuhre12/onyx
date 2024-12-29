from onyx.agent_search.base_raw_search.states import BaseRawSearchOutput
from onyx.agent_search.main.states import ExpandedRetrievalUpdate


def ingest_initial_retrieval(state: BaseRawSearchOutput) -> ExpandedRetrievalUpdate:
    sub_question_retrieval_stats = state[
        "base_expanded_retrieval_result"
    ].sub_question_retrieval_stats
    if sub_question_retrieval_stats is None:
        sub_question_retrieval_stats = []
    else:
        sub_question_retrieval_stats = [sub_question_retrieval_stats]

    return ExpandedRetrievalUpdate(
        original_question_retrieval_results=state[
            "base_expanded_retrieval_result"
        ].expanded_queries_results,
        all_original_question_documents=state[
            "base_expanded_retrieval_result"
        ].all_documents,
        sub_question_retrieval_stats=sub_question_retrieval_stats,
    )
