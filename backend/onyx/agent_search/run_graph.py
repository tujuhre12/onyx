import asyncio
from collections import defaultdict
from collections.abc import AsyncIterable
from collections.abc import Iterable
from datetime import datetime
from typing import cast

from langchain_core.runnables.schema import StreamEvent
from langgraph.graph.state import CompiledStateGraph
from sqlalchemy.orm import Session

from onyx.agent_search.basic.graph_builder import basic_graph_builder
from onyx.agent_search.basic.states import BasicInput
from onyx.agent_search.models import AgentDocumentCitations
from onyx.agent_search.pro_search_a.main.graph_builder import main_graph_builder
from onyx.agent_search.pro_search_a.main.states import MainInput
from onyx.agent_search.shared_graph_utils.utils import get_test_config
from onyx.chat.llm_response_handler import LLMResponseHandlerManager
from onyx.chat.models import AgentAnswerPiece
from onyx.chat.models import AnswerPacket
from onyx.chat.models import AnswerStream
from onyx.chat.models import AnswerStyleConfig
from onyx.chat.models import ExtendedToolResponse
from onyx.chat.models import OnyxAnswerPiece
from onyx.chat.models import ProSearchConfig
from onyx.chat.models import SubQueryPiece
from onyx.chat.models import SubQuestionPiece
from onyx.chat.models import ToolResponse
from onyx.chat.prompt_builder.build import LLMCall
from onyx.context.search.models import SearchRequest
from onyx.db.engine import get_session_context_manager
from onyx.llm.interfaces import LLM
from onyx.tools.tool_implementations.search.search_tool import SearchTool
from onyx.tools.tool_runner import ToolCallKickoff
from onyx.utils.logger import setup_logger

logger = setup_logger()

_COMPILED_GRAPH: CompiledStateGraph | None = None


def _set_combined_token_value(
    combined_token: str, parsed_object: AgentAnswerPiece
) -> AgentAnswerPiece:
    parsed_object.answer_piece = combined_token

    return parsed_object


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
            return cast(SubQuestionPiece, event["data"])
        elif event["name"] == "subqueries":
            return cast(SubQueryPiece, event["data"])
        elif event["name"] == "sub_answers":
            return cast(AgentAnswerPiece, event["data"])
        elif event["name"] == "initial_agent_answer":
            return cast(AgentAnswerPiece, event["data"])
        elif event["name"] == "tool_response":
            return cast(ToolResponse, event["data"])
        elif event["name"] == "basic_response":
            return cast(AnswerPacket, event["data"])
    return None


def _manage_async_event_streaming(
    compiled_graph: CompiledStateGraph,
    graph_input: MainInput | BasicInput,
) -> Iterable[StreamEvent]:
    async def _run_async_event_stream() -> AsyncIterable[StreamEvent]:
        async for event in compiled_graph.astream_events(
            input=graph_input,
            # debug=True,
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
    input: MainInput | BasicInput,
) -> AnswerStream:
    agent_document_citations: dict[int, dict[int, list[AgentDocumentCitations]]] = {}
    agent_question_citations_used_docs: defaultdict[
        int, defaultdict[int, list[str]]
    ] = defaultdict(lambda: defaultdict(list))

    citation_potential: defaultdict[int, defaultdict[int, bool]] = defaultdict(
        lambda: defaultdict(lambda: False)
    )

    current_yield_components: defaultdict[
        int, defaultdict[int, list[str]]
    ] = defaultdict(lambda: defaultdict(list))
    current_yield_str: defaultdict[int, defaultdict[int, str]] = defaultdict(
        lambda: defaultdict(lambda: "")
    )

    # def _process_citation(current_yield_str: str) -> tuple[str, str]:
    #                 """Process a citation string and return the formatted citation and remaining text."""
    #                 section_split = current_yield_str.split(']', 1)
    #                 citation_part = section_split[0] + ']'
    #                 remaining_text = section_split[1] if len(section_split) > 1 else ''

    #                 if 'D' in citation_part:
    #                     citation_type = "Document"
    #                     formatted_citation = citation_part.replace('[D', '[[').replace(']', ']]')
    #                 else:  # Q case
    #                     citation_type = "Question"
    #                     formatted_citation = citation_part.replace('[Q', '{{').replace(']', '}}')

    #                 return f" --- CITATION: {citation_type} - {formatted_citation}", remaining_text

    for event in _manage_async_event_streaming(
        compiled_graph=compiled_graph, graph_input=input
    ):
        parsed_object = _parse_agent_event(event)
        if not parsed_object:
            continue
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
    input = MainInput(
        config=config,
        primary_llm=primary_llm,
        fast_llm=fast_llm,
        db_session=db_session,
        search_tool=search_tool,
    )
    return run_graph(compiled_graph, input)


def run_basic_graph(
    last_llm_call: LLMCall | None,
    primary_llm: LLM,
    answer_style_config: AnswerStyleConfig,
    response_handler_manager: LLMResponseHandlerManager,
) -> AnswerStream:
    graph = basic_graph_builder()
    compiled_graph = graph.compile()
    input = BasicInput(
        last_llm_call=last_llm_call,
        llm=primary_llm,
        answer_style_config=answer_style_config,
        response_handler_manager=response_handler_manager,
        calls=0,
    )
    return run_graph(compiled_graph, input)


if __name__ == "__main__":
    from onyx.llm.factory import get_default_llms

    now_start = datetime.now()
    logger.debug(f"Start at {now_start}")

    graph = main_graph_builder()
    compiled_graph = graph.compile()
    now_end = datetime.now()
    logger.debug(f"Graph compiled in {now_end - now_start} seconds")
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
        # search_request.persona = get_persona_by_id(1, None, db_session)
        config.use_persistence = True

        # with open("output.txt", "w") as f:
        tool_responses: list = []
        input = MainInput(
            config=config,
            primary_llm=primary_llm,
            fast_llm=fast_llm,
            db_session=db_session,
            search_tool=search_tool,
        )
        for output in run_graph(compiled_graph, input):
            # pass

            if isinstance(output, ToolCallKickoff):
                pass
            elif isinstance(output, ToolResponse):
                tool_responses.append(output.response)
            elif isinstance(output, SubQuestionPiece):
                logger.debug(
                    f"SQ {output.level} - {output.level_question_nr} - {output.sub_question} | "
                )
            elif (
                isinstance(output, AgentAnswerPiece)
                and output.answer_type == "agent_sub_answer"
            ):
                logger.debug(
                    f"   ---- SA {output.level} - {output.level_question_nr} {output.answer_piece} | "
                )
            elif (
                isinstance(output, AgentAnswerPiece)
                and output.answer_type == "agent_level_answer"
            ):
                logger.debug(f"   ---------- FA {output.answer_piece} | ")

        # for tool_response in tool_responses:
        #    logger.debug(tool_response)
