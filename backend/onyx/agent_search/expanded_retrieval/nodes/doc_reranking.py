from onyx.agent_search.expanded_retrieval.states import DocRerankingUpdate
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalState
from onyx.agent_search.shared_graph_utils.calculations import get_fit_scores
from onyx.context.search.pipeline import retrieval_preprocessing
from onyx.context.search.pipeline import search_postprocessing
from onyx.context.search.pipeline import SearchRequest


def doc_reranking(state: ExpandedRetrievalState) -> DocRerankingUpdate:
    AGENT_TEST = True
    AGENT_TEST_MAX_QUERY_RETRIEVAL_RESULTS = 10

    verified_documents = state["verified_documents"]

    # Rerank post retrieval and verification. First, create a search query
    # then create the list of reranked sections

    _search_query = retrieval_preprocessing(
        search_request=SearchRequest(query=state["question"]),
        user=None,
        llm=state["fast_llm"],
        db_session=state["db_session"],
    )

    reranked_documents = list(
        search_postprocessing(
            search_query=_search_query,
            retrieved_sections=verified_documents,
            llm=state["fast_llm"],
        )
    )[
        0
    ]  # only get the reranked szections, not the SectionRelevancePiece

    if AGENT_TEST:
        fit_scores = get_fit_scores(verified_documents, reranked_documents)
    else:
        fit_scores = None

    return DocRerankingUpdate(
        reranked_documents=reranked_documents[:AGENT_TEST_MAX_QUERY_RETRIEVAL_RESULTS],
        fit_scores=fit_scores,
    )
