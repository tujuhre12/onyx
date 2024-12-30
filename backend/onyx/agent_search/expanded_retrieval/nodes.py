from collections import defaultdict
from typing import Literal

import numpy as np
from langchain_core.messages import HumanMessage
from langchain_core.messages import merge_message_runs
from langgraph.types import Command
from langgraph.types import Send

from onyx.agent_search.core_state import in_subgraph_extract_core_fields
from onyx.agent_search.expanded_retrieval.models import ExpandedRetrievalResult
from onyx.agent_search.expanded_retrieval.models import QueryResult
from onyx.agent_search.expanded_retrieval.states import DocRerankingUpdate
from onyx.agent_search.expanded_retrieval.states import DocRetrievalUpdate
from onyx.agent_search.expanded_retrieval.states import DocVerificationInput
from onyx.agent_search.expanded_retrieval.states import DocVerificationUpdate
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalInput
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalOutput
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalState
from onyx.agent_search.expanded_retrieval.states import InferenceSection
from onyx.agent_search.expanded_retrieval.states import QueryExpansionUpdate
from onyx.agent_search.expanded_retrieval.states import RetrievalInput
from onyx.agent_search.shared_graph_utils.calculations import get_fit_scores
from onyx.agent_search.shared_graph_utils.models import AgentChunkStats
from onyx.agent_search.shared_graph_utils.models import RetrievalFitStats
from onyx.agent_search.shared_graph_utils.prompts import REWRITE_PROMPT_MULTI_ORIGINAL
from onyx.agent_search.shared_graph_utils.prompts import VERIFIER_PROMPT
from onyx.configs.dev_configs import AGENT_MAX_QUERY_RETRIEVAL_RESULTS
from onyx.configs.dev_configs import AGENT_RERANKING_MAX_QUERY_RETRIEVAL_RESULTS
from onyx.configs.dev_configs import AGENT_RERANKING_STATS
from onyx.configs.dev_configs import AGENT_RETRIEVAL_STATS
from onyx.context.search.models import SearchRequest
from onyx.context.search.pipeline import retrieval_preprocessing
from onyx.context.search.pipeline import search_postprocessing
from onyx.context.search.pipeline import SearchPipeline
from onyx.llm.interfaces import LLM


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


def doc_retrieval(state: RetrievalInput) -> DocRetrievalUpdate:
    """
    Retrieve documents

    Args:
        state (RetrievalInput): Primary state + the query to retrieve

    Updates:
        expanded_retrieval_results: list[ExpandedRetrievalResult]
        retrieved_documents: list[InferenceSection]
    """

    llm = state["subgraph_primary_llm"]
    fast_llm = state["subgraph_fast_llm"]
    query_to_retrieve = state["query_to_retrieve"]

    search_results = SearchPipeline(
        search_request=SearchRequest(
            query=query_to_retrieve,
        ),
        user=None,
        llm=llm,
        fast_llm=fast_llm,
        db_session=state["subgraph_db_session"],
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


def doc_verification(state: DocVerificationInput) -> DocVerificationUpdate:
    """
    Check whether the document is relevant for the original user question

    Args:
        state (DocVerificationInput): The current state

    Updates:
        verified_documents: list[InferenceSection]
    """

    question = state["question"]
    doc_to_verify = state["doc_to_verify"]
    document_content = doc_to_verify.combined_content

    msg = [
        HumanMessage(
            content=VERIFIER_PROMPT.format(
                question=question, document_content=document_content
            )
        )
    ]

    fast_llm = state["subgraph_fast_llm"]

    response = fast_llm.invoke(msg)

    verified_documents = []
    if isinstance(response.content, str) and "yes" in response.content.lower():
        verified_documents.append(doc_to_verify)

    return DocVerificationUpdate(
        verified_documents=verified_documents,
    )


def expand_queries(state: ExpandedRetrievalInput) -> QueryExpansionUpdate:
    question = state.get("question")
    llm: LLM = state["subgraph_fast_llm"]

    msg = [
        HumanMessage(
            content=REWRITE_PROMPT_MULTI_ORIGINAL.format(question=question),
        )
    ]
    llm_response_list = list(
        llm.stream(
            prompt=msg,
        )
    )
    llm_response = merge_message_runs(llm_response_list, chunk_separator="")[0].content

    rewritten_queries = llm_response.split("--")

    return QueryExpansionUpdate(
        expanded_queries=rewritten_queries,
    )


def _calculate_sub_question_retrieval_stats(
    verified_documents: list[InferenceSection],
    expanded_retrieval_results: list[QueryResult],
) -> AgentChunkStats:
    chunk_scores: dict[str, dict[str, list[int | float]]] = defaultdict(
        lambda: defaultdict(list)
    )

    for expanded_retrieval_result in expanded_retrieval_results:
        for doc in expanded_retrieval_result.search_results:
            doc_chunk_id = f"{doc.center_chunk.document_id}_{doc.center_chunk.chunk_id}"
            if doc.center_chunk.score is not None:
                chunk_scores[doc_chunk_id]["score"].append(doc.center_chunk.score)

    verified_doc_chunk_ids = [
        f"{verified_document.center_chunk.document_id}_{verified_document.center_chunk.chunk_id}"
        for verified_document in verified_documents
    ]
    dismissed_doc_chunk_ids = []

    raw_chunk_stats_counts: dict[str, int] = defaultdict(int)
    raw_chunk_stats_scores: dict[str, float] = defaultdict(float)
    for doc_chunk_id, chunk_data in chunk_scores.items():
        if doc_chunk_id in verified_doc_chunk_ids:
            raw_chunk_stats_counts["verified_count"] += 1

            valid_chunk_scores = [
                score for score in chunk_data["score"] if score is not None
            ]
            raw_chunk_stats_scores["verified_scores"] += float(
                np.mean(valid_chunk_scores)
            )
        else:
            raw_chunk_stats_counts["rejected_count"] += 1
            valid_chunk_scores = [
                score for score in chunk_data["score"] if score is not None
            ]
            raw_chunk_stats_scores["rejected_scores"] += float(
                np.mean(valid_chunk_scores)
            )
            dismissed_doc_chunk_ids.append(doc_chunk_id)

    if raw_chunk_stats_counts["verified_count"] == 0:
        verified_avg_scores = 0.0
    else:
        verified_avg_scores = raw_chunk_stats_scores["verified_scores"] / float(
            raw_chunk_stats_counts["verified_count"]
        )

    rejected_scores = raw_chunk_stats_scores.get("rejected_scores", None)
    if rejected_scores is not None:
        rejected_avg_scores = rejected_scores / float(
            raw_chunk_stats_counts["rejected_count"]
        )
    else:
        rejected_avg_scores = None

    chunk_stats = AgentChunkStats(
        verified_count=raw_chunk_stats_counts["verified_count"],
        verified_avg_scores=verified_avg_scores,
        rejected_count=raw_chunk_stats_counts["rejected_count"],
        rejected_avg_scores=rejected_avg_scores,
        verified_doc_chunk_ids=verified_doc_chunk_ids,
        dismissed_doc_chunk_ids=dismissed_doc_chunk_ids,
    )

    return chunk_stats


def format_results(state: ExpandedRetrievalState) -> ExpandedRetrievalOutput:
    sub_question_retrieval_stats = _calculate_sub_question_retrieval_stats(
        verified_documents=state["verified_documents"],
        expanded_retrieval_results=state["expanded_retrieval_results"],
    )

    if sub_question_retrieval_stats is None:
        sub_question_retrieval_stats = AgentChunkStats()
    # else:
    #    sub_question_retrieval_stats = [sub_question_retrieval_stats]

    return ExpandedRetrievalOutput(
        expanded_retrieval_result=ExpandedRetrievalResult(
            expanded_queries_results=state["expanded_retrieval_results"],
            all_documents=state["reranked_documents"],
            sub_question_retrieval_stats=sub_question_retrieval_stats,
        ),
    )


def verification_kickoff(
    state: ExpandedRetrievalState,
) -> Command[Literal["doc_verification"]]:
    documents = state["retrieved_documents"]
    verification_question = state.get(
        "question", state["subgraph_search_request"].query
    )
    return Command(
        update={},
        goto=[
            Send(
                node="doc_verification",
                arg=DocVerificationInput(
                    doc_to_verify=doc,
                    question=verification_question,
                    **in_subgraph_extract_core_fields(state),
                ),
            )
            for doc in documents
        ],
    )
