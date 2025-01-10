from datetime import datetime
from typing import Literal
from typing import TypedDict

from pydantic import BaseModel

from onyx.context.search.models import InferenceSection
from onyx.tools.models import SearchQueryInfo


# Pydantic models for structured outputs
class RewrittenQueries(BaseModel):
    rewritten_queries: list[str]


class BinaryDecision(BaseModel):
    decision: Literal["yes", "no"]


class BinaryDecisionWithReasoning(BaseModel):
    reasoning: str
    decision: Literal["yes", "no"]


class RetrievalFitScoreMetrics(BaseModel):
    scores: dict[str, float]
    chunk_ids: list[str]


class RetrievalFitStats(BaseModel):
    fit_score_lift: float
    rerank_effect: float
    fit_scores: dict[str, RetrievalFitScoreMetrics]


class AgentChunkScores(BaseModel):
    scores: dict[str, dict[str, list[int | float]]]


class AgentChunkStats(BaseModel):
    verified_count: int | None
    verified_avg_scores: float | None
    rejected_count: int | None
    rejected_avg_scores: float | None
    verified_doc_chunk_ids: list[str]
    dismissed_doc_chunk_ids: list[str]


class InitialAgentResultStats(BaseModel):
    sub_questions: dict[str, float | int | None]
    original_question: dict[str, float | int | None]
    agent_effectiveness: dict[str, float | int | None]


class RefinedAgentStats(BaseModel):
    revision_doc_efficiency: float | None
    revision_question_efficiency: float | None


### Models ###


class Entity(BaseModel):
    entity_name: str
    entity_type: str


class Relationship(BaseModel):
    relationship_name: str
    relationship_type: str
    relationship_entities: list[str]


class Term(BaseModel):
    term_name: str
    term_type: str
    term_similar_to: list[str]


class EntityRelationshipTermExtraction(BaseModel):
    entities: list[Entity]
    relationships: list[Relationship]
    terms: list[Term]


class EntityTermExtractionUpdate(TypedDict):
    entity_retlation_term_extractions: EntityRelationshipTermExtraction


class AgentAdditionalMetrics(BaseModel):
    pass


class AgentRefinedMetrics(BaseModel):
    refined_doc_boost_factor: float | None
    refined_question_boost_factor: float | None
    duration__s: float | None


class AgentTimings(BaseModel):
    base_duration__s: float | None
    refined_duration__s: float | None
    full_duration__s: float | None


class AgentBaseMetrics(BaseModel):
    num_verified_documents_total: int | None
    num_verified_documents_core: int | None
    verified_avg_score_core: float | None
    num_verified_documents_base: int | float | None
    verified_avg_score_base: float | None
    base_doc_boost_factor: float | None
    support_boost_factor: float | None
    duration__s: float | None


class CombinedAgentMetrics(BaseModel):
    timings: AgentTimings
    base_metrics: AgentBaseMetrics
    refined_metrics: AgentRefinedMetrics
    additional_metrics: AgentAdditionalMetrics


### Models ###


class QueryResult(BaseModel):
    query: str
    search_results: list[InferenceSection]
    stats: RetrievalFitStats | None
    query_info: SearchQueryInfo | None


class QuestionAnswerResults(BaseModel):
    question: str
    question_id: str
    answer: str
    quality: str
    expanded_retrieval_results: list[QueryResult]
    documents: list[InferenceSection]
    sub_question_retrieval_stats: AgentChunkStats


class RefinedAgentEndStats(TypedDict):
    agent_refined_end_time: datetime | None
    agent_refined_metrics: AgentRefinedMetrics


### States ###

## Update States


class RefinedAgentStartStats(TypedDict):
    agent_refined_start_time: datetime | None
