from operator import add
from typing import Annotated
from typing import TypedDict

from pydantic import BaseModel

from onyx.agent_search.answer_question.states import QuestionAnswerResults
from onyx.agent_search.core_state import CoreState
from onyx.agent_search.expanded_retrieval.states import QueryResult
from onyx.agent_search.shared_graph_utils.operators import dedup_inference_sections
from onyx.context.search.models import InferenceSection

## Models


class AgentStats(BaseModel):
    sub_question_stats: list[dict[str, float | int]]
    original_question_stats: dict[str, float | int]
    agent_stats: dict[str, float | int]


### States ###

## Update States


class BaseDecompUpdate(TypedDict):
    initial_decomp_questions: list[str]


class InitialAnswerBASEUpdate(TypedDict):
    initial_base_answer: str


class InitialAnswerUpdate(TypedDict):
    initial_answer: str
    initial_agent_stats: dict
    generated_sub_questions: list[str]


class DecompAnswersUpdate(TypedDict):
    documents: Annotated[list[InferenceSection], dedup_inference_sections]
    decomp_answer_results: Annotated[list[QuestionAnswerResults], add]


class ExpandedRetrievalUpdate(TypedDict):
    all_original_question_documents: Annotated[
        list[InferenceSection], dedup_inference_sections
    ]
    original_question_retrieval_results: list[QueryResult]
    sub_question_retrieval_stats: dict


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
):
    pass


## Graph Output State


class MainOutput(TypedDict):
    initial_answer: str
    initial_base_answer: str
    initial_agent_stats: dict
    generated_sub_questions: list[str]
