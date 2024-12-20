from collections import defaultdict

import numpy as np

from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalOutput
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalResult
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalState
from onyx.agent_search.expanded_retrieval.states import InferenceSection
from onyx.agent_search.expanded_retrieval.states import QueryResult


def _calculate_sub_question_retrieval_stats(
    verified_documents: list[InferenceSection],
    expanded_retrieval_results: list[QueryResult],
) -> dict[str, float | int]:
    chunk_scores = defaultdict(lambda: defaultdict(list))
    for expanded_retrieval_result in expanded_retrieval_results:
        for doc in expanded_retrieval_result.documents_for_query:
            doc_chunk_id = f"{doc.center_chunk.document_id}_{doc.center_chunk.chunk_id}"
            chunk_scores[doc_chunk_id]["score"].append(doc.center_chunk.score)

    verified_doc_chunk_ids = [
        f"{verified_document.center_chunk.document_id}_{verified_document.center_chunk.chunk_id}"
        for verified_document in verified_documents
    ]
    dismissed_doc_chunk_ids = []

    raw_chunk_stats = defaultdict(float)
    for doc_chunk_id, chunk_data in chunk_scores.items():
        if doc_chunk_id in verified_doc_chunk_ids:
            raw_chunk_stats["verified_count"] += 1
            raw_chunk_stats["verified_scores"] += np.mean(chunk_data["score"])
        else:
            raw_chunk_stats["rejected_count"] += 1
            raw_chunk_stats["rejected_scores"] += np.mean(chunk_data["score"])
            dismissed_doc_chunk_ids.append(doc_chunk_id)

    if raw_chunk_stats["verified_count"] == 0:
        verified_avg_scores = 0
    else:
        verified_avg_scores = (
            raw_chunk_stats["verified_scores"] / raw_chunk_stats["verified_count"]
        )

    chunk_stats = {
        "verified_count": raw_chunk_stats["verified_count"],
        "verified_avg_scores": verified_avg_scores,
        "rejected_count": raw_chunk_stats["rejected_count"],
        "rejected_avg_scores": raw_chunk_stats["rejected_scores"]
        / raw_chunk_stats["rejected_count"],
        "verified_doc_chunk_ids": verified_doc_chunk_ids,
        "dismissed_doc_chunk_ids": dismissed_doc_chunk_ids,
    }

    return chunk_stats


def format_results(state: ExpandedRetrievalState) -> ExpandedRetrievalOutput:
    sub_question_retrieval_stats = _calculate_sub_question_retrieval_stats(
        verified_documents=state["verified_documents"],
        expanded_retrieval_results=state["expanded_retrieval_results"],
    )
    return ExpandedRetrievalOutput(
        expanded_retrieval_result=ExpandedRetrievalResult(
            expanded_queries_results=state["expanded_retrieval_results"],
            all_documents=state["reranked_documents"],
            sub_question_retrieval_stats=sub_question_retrieval_stats,
        ),
    )
