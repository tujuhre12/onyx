from dataclasses import dataclass

from onyx.chat.turn.infra.chat_turn_event_stream import Emitter
from onyx.llm.interfaces import LLM
from onyx.tools.tool_implementations.search.search_tool import SearchTool


@dataclass
class RunDependencies:
    llm: LLM
    emitter: Emitter | None = None
    search_tool: SearchTool | None = None


@dataclass
class MyContext:
    """Context class to hold search tool and other dependencies"""

    run_dependencies: RunDependencies | None = None
    needs_compaction: bool = False
    current_run_step: int = 0
