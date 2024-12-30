from onyx.agent_search.expanded_retrieval.states import DocRerankingUpdate
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalState
from onyx.agent_search.shared_graph_utils.calculations import get_fit_scores
from onyx.agent_search.shared_graph_utils.models import RetrievalFitStats
from onyx.configs.dev_configs import AGENT_RERANKING_MAX_QUERY_RETRIEVAL_RESULTS
from onyx.configs.dev_configs import AGENT_RERANKING_STATS
from onyx.context.search.pipeline import InferenceSection
from onyx.context.search.pipeline import retrieval_preprocessing
from onyx.context.search.pipeline import search_postprocessing
from onyx.context.search.pipeline import SearchRequest


def doc_reranking(state: ExpandedRetrievalState) -> DocRerankingUpdate:
    verified_documents = state["verified_documents"]

    # Rerank post retrieval and verification. First, create a search query
    # then create the list of reranked sections

    question = state.get("question", state["subgraph_search_request"].query)
    _search_query = retrieval_preprocessing(
        search_request=SearchRequest(query=question),
        user=None,
        llm=state["subgraph_fast_llm"],
        db_session=state["subgraph_db_session"],
    )

    reranked_documents = list(
        search_postprocessing(
            search_query=_search_query,
            retrieved_sections=verified_documents,
            llm=state["subgraph_fast_llm"],
        )
    )[
        0
    ]  # only get the reranked szections, not the SectionRelevancePiece

    if AGENT_RERANKING_STATS:
        fit_scores = get_fit_scores(verified_documents, reranked_documents)
    else:
        fit_scores = RetrievalFitStats(fit_score_lift=0, rerank_effect=0, fit_scores={})

    return DocRerankingUpdate(
        reranked_documents=[
            doc for doc in reranked_documents if type(doc) == InferenceSection
        ][:AGENT_RERANKING_MAX_QUERY_RETRIEVAL_RESULTS],
        sub_question_retrieval_stats=fit_scores,
    )
