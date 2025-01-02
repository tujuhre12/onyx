from operator import add
from typing import Annotated
from typing import TypedDict

from onyx.agent_search.answer_question.states import QuestionAnswerResults
from onyx.agent_search.core_state import CoreState
from onyx.agent_search.expanded_retrieval.models import ExpandedRetrievalResult
from onyx.agent_search.expanded_retrieval.models import QueryResult
from onyx.agent_search.main.models import EntityRelationshipTermExtraction
from onyx.agent_search.refined_answers.models import FollowUpSubQuestion
from onyx.agent_search.shared_graph_utils.models import AgentChunkStats
from onyx.agent_search.shared_graph_utils.models import InitialAgentResultStats
from onyx.agent_search.shared_graph_utils.models import RefinedAgentStats
from onyx.agent_search.shared_graph_utils.operators import dedup_inference_sections
from onyx.context.search.models import InferenceSection

### States ###

## Update States


class BaseDecompUpdate(TypedDict):
    initial_decomp_questions: list[str]


class InitialAnswerBASEUpdate(TypedDict):
    initial_base_answer: str


class InitialAnswerUpdate(TypedDict):
    initial_answer: str
    initial_agent_stats: InitialAgentResultStats | None
    generated_sub_questions: list[str]


class RefinedAnswerUpdate(TypedDict):
    refined_answer: str
    refined_agent_stats: RefinedAgentStats | None
    refined_answer_quality: bool


class InitialAnswerQualityUpdate(TypedDict):
    initial_answer_quality: bool


class RequireRefinedAnswerUpdate(TypedDict):
    require_refined_answer: bool


class DecompAnswersUpdate(TypedDict):
    documents: Annotated[list[InferenceSection], dedup_inference_sections]
    decomp_answer_results: Annotated[list[QuestionAnswerResults], add]


class FollowUpDecompAnswersUpdate(TypedDict):
    follow_up_documents: Annotated[list[InferenceSection], dedup_inference_sections]
    follow_up_decomp_answer_results: Annotated[list[QuestionAnswerResults], add]


class ExpandedRetrievalUpdate(TypedDict):
    all_original_question_documents: Annotated[
        list[InferenceSection], dedup_inference_sections
    ]
    original_question_retrieval_results: list[QueryResult]
    original_question_retrieval_stats: AgentChunkStats


class EntityTermExtractionUpdate(TypedDict):
    entity_retlation_term_extractions: EntityRelationshipTermExtraction


class FollowUpSubQuestionsUpdate(TypedDict):
    follow_up_sub_questions: dict[int, FollowUpSubQuestion]


class FollowUpAnswerQuestionOutput(TypedDict):
    """
    This is a list of results even though each call of this subgraph only returns one result.
    This is because if we parallelize the answer query subgraph, there will be multiple
      results in a list so the add operator is used to add them together.
    """

    follow_up_answer_results: Annotated[list[QuestionAnswerResults], add]


## Graph Input State


class MainInput(CoreState):
    pass


## Graph State


class MainState(
    # This includes the core state
    MainInput,
    BaseDecompUpdate,
    InitialAnswerUpdate,
    InitialAnswerBASEUpdate,
    DecompAnswersUpdate,
    ExpandedRetrievalUpdate,
    EntityTermExtractionUpdate,
    InitialAnswerQualityUpdate,
    RequireRefinedAnswerUpdate,
    FollowUpSubQuestionsUpdate,
    FollowUpAnswerQuestionOutput,
    FollowUpDecompAnswersUpdate,
    RefinedAnswerUpdate,
):
    # expanded_retrieval_result: Annotated[list[ExpandedRetrievalResult], add]
    base_raw_search_result: Annotated[list[ExpandedRetrievalResult], add]


## Graph Output State


class MainOutput(TypedDict):
    initial_answer: str
    initial_base_answer: str
    initial_agent_stats: dict
    generated_sub_questions: list[str]
    require_refined_answer: bool
