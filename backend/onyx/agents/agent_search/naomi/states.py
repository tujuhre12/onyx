from enum import Enum
from operator import add
from typing import Annotated
from typing import Any
from typing import TypedDict

from onyx.agents.agent_search.basic.states import BasicState
from onyx.agents.agent_search.core_state import CoreState
from onyx.agents.agent_search.kb_search.states import MainState as KBMainState
from onyx.agents.agent_search.orchestration.states import ToolCallOutput
from onyx.agents.agent_search.orchestration.states import ToolChoice


class ExecutionStage(Enum):
    """Stages of execution for the orchestration graph"""

    BASIC = "basic"
    KB_SEARCH = "kb_search"
    COMPLETE = "complete"


class NaomiInput(CoreState):
    """Input state for the naomi orchestration graph"""


class NaomiOutput(TypedDict):
    log_messages: list[str]


class KBShortOutput(TypedDict):
    output: str


class BasicShortOutput(TypedDict):
    tool_call_output: ToolCallOutput | None = None
    tool_choice: ToolChoice | None = None


class NaomiState(NaomiInput, KBMainState, BasicState):
    """Main state for the naomi orchestration graph"""

    current_stage: ExecutionStage = ExecutionStage.BASIC
    input_state: NaomiInput | None = None
    basic_results: Annotated[list[dict[str, Any]], add] = []
    kb_search_results: Annotated[list[dict[str, Any]], add] = []
    final_answer: str | None = None
