from operator import add
from typing import Annotated
from typing import TypedDict

from onyx.agents.agent_search.core_state import SubgraphCoreState
from onyx.agents.agent_search.deep_search_a.expanded_retrieval.models import (
    ExpandedRetrievalResult,
)
from onyx.agents.agent_search.shared_graph_utils.models import QueryResult
from onyx.agents.agent_search.shared_graph_utils.models import RetrievalFitStats
from onyx.agents.agent_search.shared_graph_utils.operators import (
    dedup_inference_sections,
)
from onyx.context.search.models import InferenceSection


### States ###

## Graph Input State


class ExpandedRetrievalInput(SubgraphCoreState):
    question: str
    base_search: bool
    sub_question_id: str | None


## Update/Return States


class QueryExpansionUpdateBase(TypedDict):
    expanded_queries: list[str]


class QueryExpansionUpdate(QueryExpansionUpdateBase):
    log_messages: list[str]


class DocVerificationUpdate(TypedDict):
    verified_documents: Annotated[list[InferenceSection], dedup_inference_sections]


class DocRetrievalUpdateBase(TypedDict):
    expanded_retrieval_results: Annotated[list[QueryResult], add]
    retrieved_documents: Annotated[list[InferenceSection], dedup_inference_sections]


class DocRetrievalUpdate(DocRetrievalUpdateBase):
    log_messages: list[str]


class DocRerankingUpdateBase(TypedDict):
    reranked_documents: Annotated[list[InferenceSection], dedup_inference_sections]
    sub_question_retrieval_stats: RetrievalFitStats | None


class DocRerankingUpdate(DocRerankingUpdateBase):
    log_messages: list[str]


class ExpandedRetrievalUpdate(TypedDict):
    expanded_retrieval_result: ExpandedRetrievalResult


## Graph Output State


class ExpandedRetrievalOutputBase(TypedDict):
    expanded_retrieval_result: ExpandedRetrievalResult
    base_expanded_retrieval_result: ExpandedRetrievalResult


class ExpandedRetrievalOutput(ExpandedRetrievalOutputBase):
    log_messages: list[str]


## Graph State


class ExpandedRetrievalState(
    # This includes the core state
    ExpandedRetrievalInput,
    QueryExpansionUpdateBase,
    DocRetrievalUpdateBase,
    DocVerificationUpdate,
    DocRerankingUpdateBase,
    ExpandedRetrievalOutputBase,
):
    pass


## Conditional Input States


class DocVerificationInput(ExpandedRetrievalInput):
    doc_to_verify: InferenceSection


class RetrievalInput(ExpandedRetrievalInput):
    query_to_retrieve: str
