from backend.onyx.agent_search.shared_graph_utils.calculations import (
    calculate_rank_shift,
)

from onyx.agent_search.expanded_retrieval.states import DocRetrievalUpdate
from onyx.agent_search.expanded_retrieval.states import QueryResult
from onyx.agent_search.expanded_retrieval.states import RetrievalInput
from onyx.context.search.models import InferenceSection
from onyx.context.search.models import SearchRequest
from onyx.context.search.pipeline import SearchPipeline


def doc_retrieval(state: RetrievalInput) -> DocRetrievalUpdate:
    """
    Retrieve documents

    Args:
        state (RetrievalInput): Primary state + the query to retrieve

    Updates:
        expanded_retrieval_results: list[ExpandedRetrievalResult]
        retrieved_documents: list[InferenceSection]
    """

    llm = state["primary_llm"]
    fast_llm = state["fast_llm"]
    query_to_retrieve = state["query_to_retrieve"]

    documents: list[InferenceSection] = SearchPipeline(
        search_request=SearchRequest(
            query=query_to_retrieve,
        ),
        user=None,
        llm=llm,
        fast_llm=fast_llm,
        db_session=state["db_session"],
    )

    # Initial calculations of scores for the retrieval quality

    ranked_sections = {
        "initial": documents.final_context_sections,
        "reranked": documents.reranked_sections,
    }

    fit_scores = {}

    for rank_type, docs in ranked_sections.items():
        fit_scores[rank_type] = {}
        for i in [1, 5, 10]:
            fit_scores[rank_type][i] = (
                sum([doc.center_chunk.score for doc in docs[:i]]) / i
            )

        fit_scores[rank_type]["fit_score"] = (
            1
            / 3
            * (
                fit_scores[rank_type][1]
                + fit_scores[rank_type][5]
                + fit_scores[rank_type][10]
            )
        )

        fit_scores[rank_type]["fit_score"] = fit_scores[rank_type][1]

        fit_scores[rank_type]["chunk_ids"] = [doc.center_chunk.chunk_id for doc in docs]

    fit_score_lift = (
        fit_scores["reranked"]["fit_score"] / fit_scores["initial"]["fit_score"]
    )

    average_rank_change = calculate_rank_shift(
        fit_scores["initial"]["chunk_ids"], fit_scores["reranked"]["chunk_ids"]
    )

    fit_scores["rerank_effect"] = average_rank_change
    fit_scores["fit_score_lift"] = fit_score_lift

    documents = documents.reranked_sections[:4]

    expanded_retrieval_result = QueryResult(
        query=query_to_retrieve,
        documents_for_query=documents,
        stats=fit_scores,
    )
    return DocRetrievalUpdate(
        expanded_retrieval_results=[expanded_retrieval_result],
        retrieved_documents=documents,
    )
