import asyncio
from collections.abc import AsyncIterable
from collections.abc import Iterable
from typing import cast

from langchain_core.runnables.schema import StreamEvent
from langgraph.graph.state import CompiledStateGraph
from sqlalchemy.orm import Session

from onyx.agent_search.main.graph_builder import main_graph_builder
from onyx.agent_search.main.states import MainInput
from onyx.agent_search.shared_graph_utils.utils import get_test_config
from onyx.chat.models import AnswerPacket
from onyx.chat.models import AnswerStream
from onyx.chat.models import OnyxAnswerPiece
from onyx.chat.models import ProSearchConfig
from onyx.chat.models import SubQuestion
from onyx.context.search.models import SearchRequest
from onyx.db.engine import get_session_context_manager
from onyx.db.persona import get_persona_by_id
from onyx.llm.interfaces import LLM
from onyx.tools.models import ToolResponse
from onyx.tools.tool_implementations.search.search_tool import SearchTool
from onyx.tools.tool_runner import ToolCallKickoff
from onyx.utils.logger import setup_logger

logger = setup_logger()

_COMPILED_GRAPH: CompiledStateGraph | None = None


def _parse_agent_event(
    event: StreamEvent,
) -> AnswerPacket | None:
    """
    Parse the event into a typed object.
    Return None if we are not interested in the event.
    """

    event_type = event["event"]

    if event_type == "on_custom_event":
        # TODO: different AnswerStream types for different events
        if event["name"] == "decomp_qs":
            # return OnyxAnswerPiece(answer_piece=cast(str, event["data"]))
            return cast(SubQuestion, event["data"])
        elif event["name"] == "subqueries":
            # return OnyxAnswerPiece(answer_piece=cast(str, event["data"]))
            return None
        elif event["name"] == "sub_answers":
            # return OnyxAnswerPiece(answer_piece=cast(str, event["data"]))
            return None
        elif event["name"] == "main_answer":
            return OnyxAnswerPiece(answer_piece=cast(str, event["data"]))
        elif event["name"] == "tool_response":
            return cast(ToolResponse, event["data"])
    return None


def _manage_async_event_streaming(
    compiled_graph: CompiledStateGraph,
    graph_input: MainInput,
) -> Iterable[StreamEvent]:
    async def _run_async_event_stream() -> AsyncIterable[StreamEvent]:
        async for event in compiled_graph.astream_events(
            input=graph_input,
            # indicating v2 here deserves further scrutiny
            version="v2",
        ):
            yield event

    # This might be able to be simplified
    def _yield_async_to_sync() -> Iterable[StreamEvent]:
        loop = asyncio.new_event_loop()
        try:
            # Get the async generator
            async_gen = _run_async_event_stream()
            # Convert to AsyncIterator
            async_iter = async_gen.__aiter__()
            while True:
                try:
                    # Create a coroutine by calling anext with the async iterator
                    next_coro = anext(async_iter)
                    # Run the coroutine to get the next event
                    event = loop.run_until_complete(next_coro)
                    yield event
                except StopAsyncIteration:
                    break
        finally:
            loop.close()

    return _yield_async_to_sync()


def run_graph(
    compiled_graph: CompiledStateGraph,
    config: ProSearchConfig,
    search_tool: SearchTool,
    primary_llm: LLM,
    fast_llm: LLM,
    db_session: Session,
) -> AnswerStream:
    input = MainInput(
        config=config,
        primary_llm=primary_llm,
        fast_llm=fast_llm,
        db_session=db_session,
        search_tool=search_tool,
    )
    for event in _manage_async_event_streaming(
        compiled_graph=compiled_graph, graph_input=input
    ):
        if parsed_object := _parse_agent_event(event):
            yield parsed_object


# TODO: call this once on startup, TBD where and if it should be gated based
# on dev mode or not
def load_compiled_graph() -> CompiledStateGraph:
    global _COMPILED_GRAPH
    if _COMPILED_GRAPH is None:
        graph = main_graph_builder()
        _COMPILED_GRAPH = graph.compile()
    return _COMPILED_GRAPH


def run_main_graph(
    config: ProSearchConfig,
    search_tool: SearchTool,
    primary_llm: LLM,
    fast_llm: LLM,
    db_session: Session,
) -> AnswerStream:
    compiled_graph = load_compiled_graph()
    return run_graph(
        compiled_graph, config, search_tool, primary_llm, fast_llm, db_session
    )


if __name__ == "__main__":
    from onyx.llm.factory import get_default_llms

    graph = main_graph_builder()
    compiled_graph = graph.compile()
    primary_llm, fast_llm = get_default_llms()
    search_request = SearchRequest(
        # query="what can you do with gitlab?",
        query="What are the guiding principles behind the development of cockroachDB?",
    )
    # Joachim custom persona

    with get_session_context_manager() as db_session:
        config, search_tool = get_test_config(
            db_session, primary_llm, fast_llm, search_request
        )

        search_request.persona = get_persona_by_id(1, None, db_session)

        with open("output.txt", "w") as f:
            tool_responses = []
            for output in run_graph(
                compiled_graph, config, search_tool, primary_llm, fast_llm, db_session
            ):
                if isinstance(output, OnyxAnswerPiece):
                    f.write(str(output.answer_piece) + "|")
                elif isinstance(output, ToolCallKickoff):
                    pass
                elif isinstance(output, ToolResponse):
                    tool_responses.append(output)
            for tool_response in tool_responses:
                f.write("tool response: " + str(tool_response.response) + "\n")
