from collections import defaultdict

import numpy as np

from onyx.agent_search.expanded_retrieval.models import ExpandedRetrievalResult
from onyx.agent_search.expanded_retrieval.models import QueryResult
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalOutput
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalState
from onyx.agent_search.expanded_retrieval.states import InferenceSection
from onyx.agent_search.shared_graph_utils.models import AgentChunkStats


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
        sub_question_retrieval_stats = []
    else:
        sub_question_retrieval_stats = [sub_question_retrieval_stats]

    return ExpandedRetrievalOutput(
        expanded_retrieval_result=ExpandedRetrievalResult(
            expanded_queries_results=state["expanded_retrieval_results"],
            all_documents=state["reranked_documents"],
            sub_question_retrieval_stats=sub_question_retrieval_stats,
        ),
    )
