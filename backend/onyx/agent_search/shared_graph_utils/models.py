from typing import Literal

from pydantic import BaseModel


# Pydantic models for structured outputs
class RewrittenQueries(BaseModel):
    rewritten_queries: list[str]


class BinaryDecision(BaseModel):
    decision: Literal["yes", "no"]


class BinaryDecisionWithReasoning(BaseModel):
    reasoning: str
    decision: Literal["yes", "no"]


class FitScoreMetrics(BaseModel):
    scores: dict[str, float]
    chunk_ids: list[str]


class FitScores(BaseModel):
    fit_score_lift: float
    rerank_effect: float
    fit_scores: dict[str, FitScoreMetrics]
