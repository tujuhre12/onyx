from collections import defaultdict
from typing import Any
from typing import cast
from typing import Literal

import numpy as np
from langchain_core.callbacks.manager import dispatch_custom_event
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
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalState
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalUpdate
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
from onyx.llm.interfaces import LLM
from onyx.tools.tool_implementations.search.search_tool import (
    SEARCH_RESPONSE_SUMMARY_ID,
)


def expand_queries(state: ExpandedRetrievalInput) -> QueryExpansionUpdate:
    # Sometimes we want to expand the original question, sometimes we want to expand a sub-question.
    # When we are running this node on the original question, no question is explictly passed in.
    # Instead, we use the original question from the search request.
    question = state.get("question", state["subgraph_config"].search_request.query)
    llm: LLM = state["subgraph_fast_llm"]
    state["subgraph_db_session"]
    chat_session_id = state["subgraph_config"].chat_session_id
    sub_question_id = state.get("sub_question_id")

    if chat_session_id is None:
        raise ValueError("chat_session_id must be provided for agent search")

    if sub_question_id is None:
        if state["subgraph_config"].use_persistence:
            # in this case, we are doing retrieval on the original question.
            # to make all the logic consistent (i.e. all subqueries have a
            # subquestion as a parent), we create a new sub-question
            # with the same content as the original question.
            # if state["subgraph_config"].message_id is None:
            #     raise ValueError("message_id must be provided for agent search with persistence")
            # sub_question_id = create_sub_question(db_session,
            #                                       chat_session_id,
            #                                       state["subgraph_config"].message_id,
            #                                       question).id
            pass
        else:
            sub_question_id = 1

    msg = [
        HumanMessage(
            content=REWRITE_PROMPT_MULTI_ORIGINAL.format(question=question),
        )
    ]
    llm_response_list: list[str | list[str | dict[str, Any]]] = []
    for message in llm.stream(
        prompt=msg,
    ):
        dispatch_custom_event(
            "subqueries",
            message.content,
        )
        llm_response_list.append(message.content)

    llm_response = merge_message_runs(llm_response_list, chunk_separator="")[0].content

    rewritten_queries = llm_response.split("--")

    if state["subgraph_config"].use_persistence:
        # Persist sub-queries to database

        # for query in rewritten_queries:
        #     sub_queries.append(
        #         create_sub_query(
        #             db_session=db_session,
        #             chat_session_id=chat_session_id,
        #             parent_question_id=sub_question_id,
        #             sub_query=query.strip(),
        #             )
        #         )
        pass

    return QueryExpansionUpdate(
        expanded_queries=rewritten_queries,
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
    query_to_retrieve = state["query_to_retrieve"]
    search_tool = state["subgraph_search_tool"]

    retrieved_docs: list[InferenceSection] = []
    for tool_response in search_tool.run(query=query_to_retrieve):
        if tool_response.id == SEARCH_RESPONSE_SUMMARY_ID:
            retrieved_docs = cast(
                list[InferenceSection], tool_response.response.top_sections
            )
        dispatch_custom_event(
            "tool_response",
            tool_response,
        )

    retrieved_docs = retrieved_docs[:AGENT_MAX_QUERY_RETRIEVAL_RESULTS]
    pre_rerank_docs = retrieved_docs
    if search_tool.search_pipeline is not None:
        pre_rerank_docs = (
            search_tool.search_pipeline._retrieved_sections or retrieved_docs
        )

    if AGENT_RETRIEVAL_STATS:
        fit_scores = get_fit_scores(
            pre_rerank_docs,
            retrieved_docs,
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


def verification_kickoff(
    state: ExpandedRetrievalState,
) -> Command[Literal["doc_verification"]]:
    # TODO: stream deduped docs?
    documents = state["retrieved_documents"]
    verification_question = state.get(
        "question", state["subgraph_config"].search_request.query
    )
    return Command(
        update={},
        goto=[
            Send(
                node="doc_verification",
                arg=DocVerificationInput(
                    doc_to_verify=doc,
                    question=verification_question,
                    base_search=False,
                    **in_subgraph_extract_core_fields(state),
                ),
            )
            for doc in documents
        ],
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


def doc_reranking(state: ExpandedRetrievalState) -> DocRerankingUpdate:
    verified_documents = state["verified_documents"]

    # Rerank post retrieval and verification. First, create a search query
    # then create the list of reranked sections

    question = state.get("question", state["subgraph_config"].search_request.query)
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


def format_results(state: ExpandedRetrievalState) -> ExpandedRetrievalUpdate:
    sub_question_retrieval_stats = _calculate_sub_question_retrieval_stats(
        verified_documents=state["verified_documents"],
        expanded_retrieval_results=state["expanded_retrieval_results"],
    )

    if sub_question_retrieval_stats is None:
        sub_question_retrieval_stats = AgentChunkStats()
    # else:
    #    sub_question_retrieval_stats = [sub_question_retrieval_stats]

    return ExpandedRetrievalUpdate(
        expanded_retrieval_result=ExpandedRetrievalResult(
            expanded_queries_results=state["expanded_retrieval_results"],
            all_documents=state["reranked_documents"],
            sub_question_retrieval_stats=sub_question_retrieval_stats,
        ),
    )
