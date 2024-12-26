from onyx.agent_search.expanded_retrieval.states import DocRetrievalUpdate
from onyx.agent_search.expanded_retrieval.states import QueryResult
from onyx.agent_search.expanded_retrieval.states import RetrievalInput
from onyx.agent_search.shared_graph_utils.calculations import get_fit_scores
from onyx.configs.dev_configs import AGENT_MAX_QUERY_RETRIEVAL_RESULTS
from onyx.configs.dev_configs import AGENT_RETRIEVAL_STATS
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

    search_results = SearchPipeline(
        search_request=SearchRequest(
            query=query_to_retrieve,
        ),
        user=None,
        llm=llm,
        fast_llm=fast_llm,
        db_session=state["db_session"],
    )

    retrieved_docs = search_results._get_sections()[:AGENT_MAX_QUERY_RETRIEVAL_RESULTS]

    if AGENT_RETRIEVAL_STATS:
        fit_scores = get_fit_scores(
            retrieved_docs,
            search_results.reranked_sections[:AGENT_MAX_QUERY_RETRIEVAL_RESULTS],
        )
    else:
        fit_scores = None

    expanded_retrieval_result = QueryResult(
        query=query_to_retrieve,
        search_results=retrieved_docs,
        stats=fit_scores,
    )
    return DocRetrievalUpdate(
        expanded_retrieval_results=[expanded_retrieval_result],
        retrieved_documents=retrieved_docs,
    )
