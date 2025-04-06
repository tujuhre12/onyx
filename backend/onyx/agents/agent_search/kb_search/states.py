from enum import Enum
from operator import add
from typing import Annotated
from typing import TypedDict

from pydantic import BaseModel

from onyx.agents.agent_search.core_state import CoreState
from onyx.agents.agent_search.orchestration.states import ToolCallUpdate
from onyx.agents.agent_search.orchestration.states import ToolChoiceInput
from onyx.agents.agent_search.orchestration.states import ToolChoiceUpdate


### States ###
class LoggerUpdate(BaseModel):
    log_messages: Annotated[list[str], add] = []


class KGAnswerStrategy(Enum):
    DEEP = "DEEP"
    SIMPLE = "SIMPLE"


class KGAnswerFormat(Enum):
    LIST = "LIST"
    TEXT = "TEXT"


class AnalysisUpdate(LoggerUpdate):
    normalized_core_entities: list[str] = []
    normalized_core_relationships: list[str] = []
    query_graph_entities: list[str] = []
    query_graph_relationships: list[str] = []
    normalized_terms: list[str] = []
    normalized_time_filter: str | None = None
    strategy: KGAnswerStrategy | None = None
    output_format: KGAnswerFormat | None = None
    broken_down_question: str | None = None


class SQLSimpleGenerationUpdate(LoggerUpdate):
    sql_query: str | None = None
    individualized_sql_query: str | None = None
    results: list[dict] = []


class ERTExtractionUpdate(LoggerUpdate):
    entities_types_str: str = ""
    entities: list[str] = []
    relationships: list[str] = []
    terms: list[str] = []
    time_filter: str | None = None


## Graph Input State
class MainInput(CoreState):
    pass


## Graph State
class MainState(
    # This includes the core state
    MainInput,
    ToolChoiceInput,
    ToolCallUpdate,
    ToolChoiceUpdate,
    ERTExtractionUpdate,
    AnalysisUpdate,
    SQLSimpleGenerationUpdate,
):
    pass


## Graph Output State - presently not used
class MainOutput(TypedDict):
    log_messages: list[str]
