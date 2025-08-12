from collections import defaultdict
from collections.abc import Generator
from typing import cast
from typing import DefaultDict
from typing import Union

from sqlalchemy.orm import Session

from onyx.chat.models import AgenticMessageResponseIDInfo
from onyx.chat.models import AgentSearchPacket
from onyx.chat.models import AllCitations
from onyx.chat.models import AnswerPostInfo
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
from onyx.chat.models import SubQuestionKey
from onyx.chat.models import UserKnowledgeFilePacket
from onyx.chat.packet_proccessing.tool_processing import (
    handle_image_generation_tool_response,
)
from onyx.chat.packet_proccessing.tool_processing import (
    handle_internet_search_tool_response,
)
from onyx.chat.packet_proccessing.tool_processing import (
    handle_search_tool_response_summary,
)
from onyx.configs.constants import BASIC_KEY
from onyx.context.search.models import RetrievalDetails
from onyx.db.models import SearchDoc as DbSearchDoc
from onyx.file_store.models import ChatFileType
from onyx.server.query_and_chat.models import ChatMessageDetail
from onyx.server.query_and_chat.streaming_models import CitationDelta
from onyx.server.query_and_chat.streaming_models import CitationStart
from onyx.server.query_and_chat.streaming_models import CustomToolDelta
from onyx.server.query_and_chat.streaming_models import CustomToolStart
from onyx.server.query_and_chat.streaming_models import ImageGenerationToolStart
from onyx.server.query_and_chat.streaming_models import MessageDelta
from onyx.server.query_and_chat.streaming_models import MessageStart
from onyx.server.query_and_chat.streaming_models import OverallStop
from onyx.server.query_and_chat.streaming_models import Packet
from onyx.server.query_and_chat.streaming_models import SearchToolDelta
from onyx.server.query_and_chat.streaming_models import SearchToolStart
from onyx.server.query_and_chat.streaming_models import SectionEnd
from onyx.tools.models import ToolCallKickoff
from onyx.tools.models import ToolResponse
from onyx.tools.tool_implementations.custom.custom_tool import CUSTOM_TOOL_RESPONSE_ID
from onyx.tools.tool_implementations.custom.custom_tool import CustomToolCallSummary
from onyx.tools.tool_implementations.custom.custom_tool import (
    CustomToolUserFileSnapshot,
)
from onyx.tools.tool_implementations.images.image_generation_tool import (
    IMAGE_GENERATION_RESPONSE_ID,
)
from onyx.tools.tool_implementations.images.image_generation_tool import (
    ImageGenerationResponse,
)
from onyx.tools.tool_implementations.internet_search.internet_search_tool import (
    INTERNET_QUERY_FIELD,
)
from onyx.tools.tool_implementations.internet_search.internet_search_tool import (
    INTERNET_SEARCH_RESPONSE_SUMMARY_ID,
)
from onyx.tools.tool_implementations.internet_search.internet_search_tool import (
    InternetSearchResponseSummary,
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
    selected_db_search_docs: list[DbSearchDoc] | None,
    retrieval_options: RetrievalDetails | None,
    db_session: Session,
) -> Generator[ChatPacket, None, dict[SubQuestionKey, AnswerPostInfo]]:
    """Process the streamed output from the answer and yield chat packets."""
    has_transmitted_answer_piece = False
    packet_index = 0
    current_message_index: int | None = None
    current_tool_index: int | None = None
    current_citation_index: int | None = None

    # Track ongoing tool operations to prevent concurrent operations of the same type
    ongoing_search = False
    ongoing_image_generation = False
    ongoing_internet_search = False

    # Track citations
    citations_emitted = False
    collected_citations: list[CitationInfo] = []

    # Initialize info_by_subq mapping and temp citations storage
    info_by_subq: dict[SubQuestionKey, AnswerPostInfo] = defaultdict(
        lambda: AnswerPostInfo(ai_message_files=[])
    )
    citations_by_key: DefaultDict[SubQuestionKey, list[CitationInfo]] = defaultdict(
        list
    )

    for packet in answer_processed_output:
        # Determine the sub-question key context when applicable
        level = getattr(packet, "level", None)
        level_question_num = getattr(packet, "level_question_num", None)
        key = SubQuestionKey(
            level=level if level is not None else BASIC_KEY[0],
            question_num=(
                level_question_num if level_question_num is not None else BASIC_KEY[1]
            ),
        )

        if isinstance(packet, ToolCallFinalResult):
            info_by_subq[key].tool_result = packet

        # Original packet processing logic continues
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
                    obj=ImageGenerationToolStart(),
                )

            if packet.tool_name == "run_search" and not ongoing_search:
                ongoing_search = True
                yield Packet(
                    ind=current_tool_index,
                    obj=SearchToolStart(),
                )

                yield Packet(
                    ind=current_tool_index,
                    obj=SearchToolDelta(
                        queries=[packet.tool_args[QUERY_FIELD]],
                    ),
                )

            if (
                packet.tool_name == "run_internet_search"
                and not ongoing_internet_search
            ):
                ongoing_internet_search = True
                yield Packet(
                    ind=current_tool_index,
                    obj=SearchToolStart(
                        is_internet_search=True,
                    ),
                )

                yield Packet(
                    ind=current_tool_index,
                    obj=SearchToolDelta(
                        queries=[packet.tool_args[INTERNET_QUERY_FIELD]],
                    ),
                )

            # Fallback: treat unknown tool kickoffs as custom tool start
            elif packet.tool_name not in {
                "run_search",
                "run_internet_search",
                "run_image_generation",
            }:
                yield Packet(
                    ind=current_tool_index,
                    obj=CustomToolStart(tool_name=packet.tool_name),
                )

        elif isinstance(packet, ToolResponse):
            # Ensure we have a tool index; fallback to current packet_index if needed
            if current_tool_index is None:
                current_tool_index = packet_index
                packet_index += 1

            if packet.id == SEARCH_RESPONSE_SUMMARY_ID:
                search_response = cast(SearchResponseSummary, packet.response)
                saved_search_docs, dropped_inds = (
                    yield from handle_search_tool_response_summary(
                        current_ind=current_tool_index,
                        search_response=search_response,
                        selected_search_docs=selected_db_search_docs,
                        is_extended=False,
                        dedupe_docs=bool(
                            retrieval_options and retrieval_options.dedupe_docs
                        ),
                    )
                )
                info_by_subq[key].reference_db_search_docs = saved_search_docs
                info_by_subq[key].dropped_indices = dropped_inds
                ongoing_search = False  # Reset search state when tool ends

            elif packet.id == INTERNET_SEARCH_RESPONSE_SUMMARY_ID:
                internet_response = cast(InternetSearchResponseSummary, packet.response)
                saved_internet_docs = yield from handle_internet_search_tool_response(
                    current_tool_index, internet_response
                )
                info_by_subq[key].reference_db_search_docs = saved_internet_docs
                ongoing_internet_search = False

            elif packet.id == IMAGE_GENERATION_RESPONSE_ID:
                img_generation_response = cast(
                    list[ImageGenerationResponse], packet.response
                )
                yield from handle_image_generation_tool_response(
                    current_tool_index, img_generation_response
                )
                ongoing_image_generation = (
                    False  # Reset image generation state when tool ends
                )

            elif packet.id == CUSTOM_TOOL_RESPONSE_ID:
                summary = cast(CustomToolCallSummary, packet.response)
                # Emit start if not already started for this index
                # We emit start once per custom tool index
                yield Packet(
                    ind=current_tool_index,
                    obj=CustomToolStart(tool_name=summary.tool_name),
                )

                # Decide whether we have file outputs or data
                file_ids: list[str] | None = None
                data: dict | list | str | int | float | bool | None = None
                if summary.response_type in ("image", "csv"):
                    try:
                        snapshot = cast(CustomToolUserFileSnapshot, summary.tool_result)
                        file_ids = snapshot.file_ids
                    except Exception:
                        file_ids = None
                else:
                    data = summary.tool_result  # type: ignore[assignment]

                yield Packet(
                    ind=current_tool_index,
                    obj=CustomToolDelta(
                        tool_name=summary.tool_name,
                        response_type=summary.response_type,
                        data=data,
                        file_ids=file_ids,
                    ),
                )

                # End this tool section
                yield Packet(
                    ind=current_tool_index,
                    obj=SectionEnd(),
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
                            obj=SectionEnd(),
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
        yield Packet(ind=current_message_index, obj=SectionEnd())

    # Emit collected citations if any
    if collected_citations and current_citation_index is not None:
        yield Packet(ind=current_citation_index, obj=CitationStart())
        yield Packet(
            ind=current_citation_index, obj=CitationDelta(citations=collected_citations)
        )
        yield Packet(
            ind=current_citation_index,
            obj=SectionEnd(),
        )

    # Yield STOP packet to indicate streaming is complete
    yield Packet(ind=packet_index, obj=OverallStop())

    # Build citation maps per sub-question key using available docs
    for key, citation_list in citations_by_key.items():
        info = info_by_subq[key]
        if not citation_list:
            continue

        doc_id_to_saved_db_id = {
            doc.document_id: doc.id for doc in info.reference_db_search_docs or []
        }

        citation_map: dict[int, int] = {}
        for c in citation_list:
            mapped_db_id = doc_id_to_saved_db_id.get(c.document_id)
            if mapped_db_id is not None and c.citation_num not in citation_map:
                citation_map[c.citation_num] = mapped_db_id

        if citation_map:
            info.message_specific_citations = MessageSpecificCitations(
                citation_map=citation_map
            )

    return info_by_subq
