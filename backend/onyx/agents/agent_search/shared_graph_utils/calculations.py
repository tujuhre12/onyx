import numpy as np

from onyx.agents.agent_search.shared_graph_utils.models import RetrievalFitScoreMetrics
from onyx.agents.agent_search.shared_graph_utils.models import RetrievalFitStats
from onyx.chat.models import SectionRelevancePiece
from onyx.context.search.models import InferenceSection
from onyx.utils.logger import setup_logger

logger = setup_logger()


def unique_chunk_id(doc: InferenceSection) -> str:
    return f"{doc.center_chunk.document_id}_{doc.center_chunk.chunk_id}"


def calculate_rank_shift(list1: list, list2: list, top_n: int = 20) -> float:
    shift = 0
    for rank_first, doc_id in enumerate(list1[:top_n], 1):
        try:
            rank_second = list2.index(doc_id) + 1
        except ValueError:
            rank_second = len(list2)  # Document not found in second list

        shift += np.abs(rank_first - rank_second) / np.log(1 + rank_first * rank_second)

    return shift / top_n


def get_fit_scores(
    pre_reranked_results: list[InferenceSection],
    post_reranked_results: list[InferenceSection] | list[SectionRelevancePiece],
) -> RetrievalFitStats | None:
    """
    Calculate retrieval metrics for search purposes
    """

    if len(pre_reranked_results) == 0 or len(post_reranked_results) == 0:
        return None

    ranked_sections = {
        "initial": pre_reranked_results,
        "reranked": post_reranked_results,
    }

    fit_eval: RetrievalFitStats = RetrievalFitStats(
        fit_score_lift=0,
        rerank_effect=0,
        fit_scores={
            "initial": RetrievalFitScoreMetrics(scores={}, chunk_ids=[]),
            "reranked": RetrievalFitScoreMetrics(scores={}, chunk_ids=[]),
        },
    )

    for rank_type, docs in ranked_sections.items():
        logger.debug(f"rank_type: {rank_type}")

        for i in [1, 5, 10]:
            fit_eval.fit_scores[rank_type].scores[str(i)] = (
                sum(
                    [
                        float(doc.center_chunk.score)
                        for doc in docs[:i]
                        if type(doc) == InferenceSection
                        and doc.center_chunk.score is not None
                    ]
                )
                / i
            )

        fit_eval.fit_scores[rank_type].scores["fit_score"] = (
            1
            / 3
            * (
                fit_eval.fit_scores[rank_type].scores["1"]
                + fit_eval.fit_scores[rank_type].scores["5"]
                + fit_eval.fit_scores[rank_type].scores["10"]
            )
        )

        fit_eval.fit_scores[rank_type].scores["fit_score"] = fit_eval.fit_scores[
            rank_type
        ].scores["1"]

        fit_eval.fit_scores[rank_type].chunk_ids = [
            unique_chunk_id(doc) for doc in docs if type(doc) == InferenceSection
        ]

    fit_eval.fit_score_lift = (
        fit_eval.fit_scores["reranked"].scores["fit_score"]
        / fit_eval.fit_scores["initial"].scores["fit_score"]
    )

    fit_eval.rerank_effect = calculate_rank_shift(
        fit_eval.fit_scores["initial"].chunk_ids,
        fit_eval.fit_scores["reranked"].chunk_ids,
    )

    return fit_eval


def get_streaming_documents(
    relevant_docs: list[InferenceSection],
    context_documents: list[InferenceSection],
    original_question_docs: list[InferenceSection],
    max_docs: int,
) -> list[InferenceSection]:
    """
    Create a deduplicated list of documents to stream, prioritizing relevant docs.

    Args:
        relevant_docs: Primary documents to include
        context_documents: Additional context documents to append
        original_question_docs: Original question documents to append
        max_docs: Maximum number of documents to return

    Returns:
        List of deduplicated documents, limited to max_docs
    """
    # Start with relevant docs or fallback to original question docs
    streaming_documents = (
        relevant_docs if relevant_docs else original_question_docs[:15]
    )

    # Use a set for O(1) lookups of document IDs
    seen_doc_ids = {doc.center_chunk.document_id for doc in streaming_documents}

    # Combine additional documents to check in one iteration
    additional_docs = context_documents + original_question_docs
    for doc in additional_docs:
        doc_id = doc.center_chunk.document_id
        if doc_id not in seen_doc_ids:
            streaming_documents.append(doc)
            seen_doc_ids.add(doc_id)

    return streaming_documents[:max_docs]
