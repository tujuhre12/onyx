from collections.abc import Generator
from typing import cast
from typing import Union

from onyx.chat.models import AgenticMessageResponseIDInfo
from onyx.chat.models import AgentSearchPacket
from onyx.chat.models import AllCitations
from onyx.chat.models import AnswerStream
from onyx.chat.models import CitationInfo
from onyx.chat.models import CustomToolResponse
from onyx.chat.models import FileChatDisplay
from onyx.chat.models import FinalUsedContextDocsResponse
from onyx.chat.models import LLMRelevanceFilterResponse
from onyx.chat.models import MessageResponseIDInfo
from onyx.chat.models import MessageSpecificCitations
from onyx.chat.models import OnyxAnswerPiece
from onyx.chat.models import QADocsResponse
from onyx.chat.models import StreamingError
from onyx.chat.models import StreamStopInfo
from onyx.chat.models import StreamStopReason
from onyx.chat.models import UserKnowledgeFilePacket
from onyx.context.search.utils import chunks_or_sections_to_search_docs
from onyx.db.chat import create_db_search_doc
from onyx.db.chat import translate_db_search_doc_to_server_search_doc
from onyx.db.engine.sql_engine import get_session_with_current_tenant
from onyx.file_store.models import ChatFileType
from onyx.file_store.utils import save_files
from onyx.server.query_and_chat.models import ChatMessageDetail
from onyx.server.query_and_chat.streaming_models import CitationDelta
from onyx.server.query_and_chat.streaming_models import CitationEnd
from onyx.server.query_and_chat.streaming_models import CitationStart
from onyx.server.query_and_chat.streaming_models import MessageDelta
from onyx.server.query_and_chat.streaming_models import MessageEnd
from onyx.server.query_and_chat.streaming_models import MessageStart
from onyx.server.query_and_chat.streaming_models import Packet
from onyx.server.query_and_chat.streaming_models import Stop
from onyx.server.query_and_chat.streaming_models import ToolDelta
from onyx.server.query_and_chat.streaming_models import ToolEnd
from onyx.server.query_and_chat.streaming_models import ToolStart
from onyx.tools.models import ToolCallKickoff
from onyx.tools.models import ToolResponse
from onyx.tools.tool_implementations.images.image_generation_tool import (
    IMAGE_GENERATION_RESPONSE_ID,
)
from onyx.tools.tool_implementations.images.image_generation_tool import (
    ImageGenerationResponse,
)
from onyx.tools.tool_implementations.search.search_tool import QUERY_FIELD
from onyx.tools.tool_implementations.search.search_tool import (
    SEARCH_RESPONSE_SUMMARY_ID,
)
from onyx.tools.tool_implementations.search.search_tool import SearchResponseSummary
from onyx.tools.tool_runner import ToolCallFinalResult
from onyx.utils.logger import setup_logger

logger = setup_logger()

COMMON_TOOL_RESPONSE_TYPES = {
    "image": ChatFileType.IMAGE,
    "csv": ChatFileType.CSV,
}

# Type definitions for packet processing
ChatPacket = Union[
    StreamingError,
    QADocsResponse,
    LLMRelevanceFilterResponse,
    FinalUsedContextDocsResponse,
    ChatMessageDetail,
    AllCitations,
    CitationInfo,
    FileChatDisplay,
    CustomToolResponse,
    MessageResponseIDInfo,
    MessageSpecificCitations,
    AgenticMessageResponseIDInfo,
    StreamStopInfo,
    AgentSearchPacket,
    UserKnowledgeFilePacket,
    Packet,
]


def process_streamed_packets(
    answer_processed_output: AnswerStream,
    reserved_message_id: int,
) -> Generator[ChatPacket, None, None]:
    """Process the streamed output from the answer and yield chat packets."""
    has_transmitted_answer_piece = False
    packet_index = 0
    current_message_index: int | None = None
    current_tool_index: int | None = None
    current_citation_index: int | None = None

    # Track ongoing tool operations to prevent concurrent operations of the same type
    ongoing_search = False
    ongoing_image_generation = False

    # Track citations
    citations_emitted = False
    collected_citations: list[CitationInfo] = []

    for packet in answer_processed_output:
        if isinstance(packet, ToolCallKickoff) and not isinstance(
            packet, ToolCallFinalResult
        ):
            # Allocate a new index for this tool call
            current_tool_index = packet_index
            packet_index += 1

            # Handle image generation tool start
            if (
                packet.tool_name == "run_image_generation"
                and not ongoing_image_generation
            ):
                ongoing_image_generation = True
                yield Packet(
                    ind=current_tool_index,
                    obj=ToolStart(
                        tool_name="image_generation",
                        tool_icon="🖼️",
                    ),
                )

            if packet.tool_name == "run_search" and not ongoing_search:
                ongoing_search = True
                yield Packet(
                    ind=current_tool_index,
                    obj=ToolStart(
                        tool_name="search",
                        tool_icon="🔍",
                        tool_main_description=packet.tool_args[QUERY_FIELD],
                    ),
                )

                yield Packet(
                    ind=current_tool_index,
                    obj=ToolDelta(
                        queries=[packet.tool_args[QUERY_FIELD]],
                    ),
                )

        elif isinstance(packet, ToolResponse):
            # Ensure we have a tool index; fallback to current packet_index if needed
            if current_tool_index is None:
                current_tool_index = packet_index
                packet_index += 1

            if packet.id == SEARCH_RESPONSE_SUMMARY_ID:
                search_response = cast(SearchResponseSummary, packet.response)

                with get_session_with_current_tenant() as db_session:
                    reference_db_search_docs = [
                        create_db_search_doc(
                            server_search_doc=doc, db_session=db_session
                        )
                        for doc in chunks_or_sections_to_search_docs(
                            search_response.top_sections
                        )
                    ]
                    response_docs = [
                        translate_db_search_doc_to_server_search_doc(db_search_doc)
                        for db_search_doc in reference_db_search_docs
                    ]

                yield Packet(
                    ind=current_tool_index,
                    obj=ToolDelta(
                        documents=response_docs,
                    ),
                )

                yield Packet(
                    ind=current_tool_index,
                    obj=ToolEnd(),
                )
                ongoing_search = False  # Reset search state when tool ends

            elif packet.id == IMAGE_GENERATION_RESPONSE_ID:
                img_generation_response = cast(
                    list[ImageGenerationResponse], packet.response
                )

                # Save files and get file IDs
                file_ids = save_files(
                    urls=[img.url for img in img_generation_response if img.url],
                    base64_files=[
                        img.image_data
                        for img in img_generation_response
                        if img.image_data
                    ],
                )

                yield Packet(
                    ind=current_tool_index,
                    obj=ToolDelta(
                        images=[
                            {
                                "id": str(file_id),
                                "url": "",  # URL will be constructed by frontend
                                "prompt": img.revised_prompt,
                            }
                            for file_id, img in zip(file_ids, img_generation_response)
                        ]
                    ),
                )

                # Emit ImageToolEnd packet with file information
                yield Packet(
                    ind=current_tool_index,
                    obj=ToolEnd(),
                )
                ongoing_image_generation = (
                    False  # Reset image generation state when tool ends
                )

        elif isinstance(packet, StreamStopInfo):
            if packet.stop_reason == StreamStopReason.FINISHED:
                yield packet
        elif isinstance(packet, OnyxAnswerPiece):
            if has_transmitted_answer_piece:
                if packet.answer_piece is None:
                    # Message is ending, use current message index
                    if current_message_index is not None:
                        yield Packet(
                            ind=current_message_index,
                            obj=MessageEnd(),
                        )
                    # Reset for next message
                    current_message_index = None
                    has_transmitted_answer_piece = False
                else:
                    # Continue with same index for message delta
                    if current_message_index is not None:
                        yield Packet(
                            ind=current_message_index,
                            obj=MessageDelta(
                                content=packet.answer_piece or "",
                            ),
                        )

            elif packet.answer_piece:
                # New message starting, allocate new index
                current_message_index = packet_index
                packet_index += 1
                yield Packet(
                    ind=current_message_index,
                    obj=MessageStart(
                        id=str(reserved_message_id),
                        content=packet.answer_piece,
                    ),
                )
                has_transmitted_answer_piece = True
        elif isinstance(packet, CitationInfo):
            # Collect citations for batch processing
            if not citations_emitted:
                # First citation - allocate index but don't emit yet
                if current_citation_index is None:
                    current_citation_index = packet_index
                    packet_index += 1

                # Collect citation info
                collected_citations.append(
                    CitationInfo(
                        citation_num=packet.citation_num,
                        document_id=packet.document_id,
                    )
                )

            yield cast(ChatPacket, packet)

    if current_message_index is not None:
        yield Packet(ind=current_message_index, obj=MessageEnd())

    # Emit collected citations if any
    if collected_citations and current_citation_index is not None:
        yield Packet(ind=current_citation_index, obj=CitationStart())
        yield Packet(
            ind=current_citation_index, obj=CitationDelta(citations=collected_citations)
        )
        yield Packet(
            ind=current_citation_index,
            obj=CitationEnd(total_citations=len(collected_citations)),
        )

    # Yield STOP packet to indicate streaming is complete
    yield Packet(ind=packet_index, obj=Stop())
