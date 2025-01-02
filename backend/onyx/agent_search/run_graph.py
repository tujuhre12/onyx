import asyncio
from collections.abc import AsyncIterable
from collections.abc import Iterable
from typing import cast

from langchain_core.runnables.schema import StreamEvent
from langgraph.graph.state import CompiledStateGraph

from onyx.agent_search.main.graph_builder import main_graph_builder
from onyx.agent_search.main.states import MainInput
from onyx.chat.models import AnswerPacket
from onyx.chat.models import AnswerStream
from onyx.chat.models import AnswerStyleConfig
from onyx.chat.models import CitationConfig
from onyx.chat.models import DocumentPruningConfig
from onyx.chat.models import OnyxAnswerPiece
from onyx.chat.models import PromptConfig
from onyx.configs.chat_configs import CHAT_TARGET_CHUNK_PERCENTAGE
from onyx.configs.chat_configs import MAX_CHUNKS_FED_TO_CHAT
from onyx.configs.constants import DEFAULT_PERSONA_ID
from onyx.context.search.enums import LLMEvaluationType
from onyx.context.search.models import RetrievalDetails
from onyx.context.search.models import SearchRequest
from onyx.db.engine import get_session_context_manager
from onyx.db.persona import get_persona_by_id
from onyx.llm.interfaces import LLM
from onyx.tools.models import ToolResponse
from onyx.tools.tool_constructor import SearchToolConfig
from onyx.tools.tool_implementations.search.search_tool import SearchTool
from onyx.tools.tool_runner import ToolCallKickoff


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
            return OnyxAnswerPiece(answer_piece=cast(str, event["data"]))
        elif event["name"] == "subqueries":
            return OnyxAnswerPiece(answer_piece=cast(str, event["data"]))
        elif event["name"] == "sub_answers":
            return OnyxAnswerPiece(answer_piece=cast(str, event["data"]))
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
    search_request: SearchRequest,
    search_tool: SearchTool,
    primary_llm: LLM,
    fast_llm: LLM,
) -> AnswerStream:
    with get_session_context_manager() as db_session:
        input = MainInput(
            search_request=search_request,
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


def run_main_graph(
    search_request: SearchRequest,
    search_tool: SearchTool,
    primary_llm: LLM,
    fast_llm: LLM,
) -> AnswerStream:
    graph = main_graph_builder()
    compiled_graph = graph.compile()
    return run_graph(compiled_graph, search_request, search_tool, primary_llm, fast_llm)


if __name__ == "__main__":
    from onyx.llm.factory import get_default_llms
    from onyx.context.search.models import SearchRequest

    graph = main_graph_builder()
    compiled_graph = graph.compile()
    primary_llm, fast_llm = get_default_llms()
    search_request = SearchRequest(
        query="what can you do with gitlab?",
    )
    with get_session_context_manager() as db_session:
        persona = get_persona_by_id(DEFAULT_PERSONA_ID, None, db_session)
        document_pruning_config = DocumentPruningConfig(
            max_chunks=int(
                persona.num_chunks
                if persona.num_chunks is not None
                else MAX_CHUNKS_FED_TO_CHAT
            ),
            max_window_percentage=CHAT_TARGET_CHUNK_PERCENTAGE,
        )

        answer_style_config = AnswerStyleConfig(
            citation_config=CitationConfig(
                # The docs retrieved by this flow are already relevance-filtered
                all_docs_useful=True
            ),
            document_pruning_config=document_pruning_config,
            structured_response_format=None,
        )

        search_tool_config = SearchToolConfig(
            answer_style_config=answer_style_config,
            document_pruning_config=document_pruning_config,
            retrieval_options=RetrievalDetails(),  # may want to set dedupe_docs=True
            rerank_settings=None,  # Can use this to change reranking model
            selected_sections=None,
            latest_query_files=None,
            bypass_acl=False,
        )

        prompt_config = PromptConfig.from_model(persona.prompts[0])

        search_tool = SearchTool(
            db_session=db_session,
            user=None,
            persona=persona,
            retrieval_options=search_tool_config.retrieval_options,
            prompt_config=prompt_config,
            llm=primary_llm,
            fast_llm=fast_llm,
            pruning_config=search_tool_config.document_pruning_config,
            answer_style_config=search_tool_config.answer_style_config,
            selected_sections=search_tool_config.selected_sections,
            chunks_above=search_tool_config.chunks_above,
            chunks_below=search_tool_config.chunks_below,
            full_doc=search_tool_config.full_doc,
            evaluation_type=(
                LLMEvaluationType.BASIC
                if persona.llm_relevance_filter
                else LLMEvaluationType.SKIP
            ),
            rerank_settings=search_tool_config.rerank_settings,
            bypass_acl=search_tool_config.bypass_acl,
        )

        with open("output.txt", "w") as f:
            tool_responses = []
            for output in run_graph(
                compiled_graph, search_request, search_tool, primary_llm, fast_llm
            ):
                if isinstance(output, OnyxAnswerPiece):
                    f.write(str(output.answer_piece) + "|")
                elif isinstance(output, ToolCallKickoff):
                    pass
                elif isinstance(output, ToolResponse):
                    tool_responses.append(output)
            for tool_response in tool_responses:
                f.write("tool response: " + str(tool_response.response) + "\n")
