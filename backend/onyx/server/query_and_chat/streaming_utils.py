from onyx.chat.models import CitationInfo
from onyx.configs.constants import MessageType
from onyx.file_store.models import ChatFileType
from onyx.server.query_and_chat.models import ChatMessageDetail
from onyx.server.query_and_chat.streaming_models import CitationDelta
from onyx.server.query_and_chat.streaming_models import CitationEnd
from onyx.server.query_and_chat.streaming_models import CitationStart
from onyx.server.query_and_chat.streaming_models import ImageGenerationToolDelta
from onyx.server.query_and_chat.streaming_models import ImageGenerationToolStart
from onyx.server.query_and_chat.streaming_models import MessageDelta
from onyx.server.query_and_chat.streaming_models import MessageEnd
from onyx.server.query_and_chat.streaming_models import MessageStart
from onyx.server.query_and_chat.streaming_models import OverallStop
from onyx.server.query_and_chat.streaming_models import Packet
from onyx.server.query_and_chat.streaming_models import SearchToolDelta
from onyx.server.query_and_chat.streaming_models import SearchToolStart
from onyx.server.query_and_chat.streaming_models import SectionEnd


def create_simplified_packets_for_message(
    message: ChatMessageDetail, packet_index_start: int = 0
) -> list[Packet]:
    """
    Convert a ChatMessageDetail into simplified streaming packets that represent
    what would have been sent during the original streaming response.

    Args:
        message: The chat message to convert to packets
        packet_index_start: Starting index for packet numbering

    Returns:
        List of simplified packets representing the message
    """
    packets: list[Packet] = []
    current_index = packet_index_start

    # Only create packets for assistant messages
    if message.message_type != MessageType.ASSISTANT:
        return packets

    # Create SearchTool packets if there are context docs
    if message.context_docs and message.context_docs.top_documents:
        search_docs = message.context_docs.top_documents

        # Start search tool
        packets.append(
            Packet(
                ind=current_index,
                obj=SearchToolStart(),
            )
        )

        # Include queries and documents in the delta
        if message.rephrased_query and message.rephrased_query.strip():
            # Cast to str to satisfy type checker since rephrased_query is Optional[str]
            queries = [str(message.rephrased_query)]
        else:
            queries = [message.message]
        packets.append(
            Packet(
                ind=current_index,
                obj=SearchToolDelta(
                    queries=queries,
                    documents=search_docs,
                ),
            )
        )

        # End search tool
        packets.append(
            Packet(
                ind=current_index,
                obj=SectionEnd(),
            )
        )
        current_index += 1

    # Create ImageTool packets if there are image files
    if message.files:
        image_files = [f for f in message.files if f["type"] == ChatFileType.IMAGE]
        if image_files:
            # Start image tool
            image_tool_start = ImageGenerationToolStart()
            packets.append(Packet(ind=current_index, obj=image_tool_start))

            # Send images via tool delta
            images = []
            for file in image_files:
                images.append(
                    {
                        "id": file["id"],
                        "url": "",  # URL will be constructed by frontend
                        "prompt": file.get("name") or "Generated image",
                    }
                )

            image_tool_delta = ImageGenerationToolDelta(images=images)
            packets.append(Packet(ind=current_index, obj=image_tool_delta))

            # End image tool
            image_tool_end = SectionEnd()
            packets.append(Packet(ind=current_index, obj=image_tool_end))
            current_index += 1

    # Create Citation packets if there are citations
    if message.citations:
        # Start citation flow
        citation_start = CitationStart()
        packets.append(Packet(ind=current_index, obj=citation_start))

        # Create citation data
        # Convert dict[int, int] to list[StreamingCitation] format
        citations_list: list[CitationInfo] = []
        for citation_num, doc_id in message.citations.items():
            citation = CitationInfo(citation_num=citation_num, document_id=str(doc_id))
            citations_list.append(citation)

        # Send citations via citation delta
        citation_delta = CitationDelta(citations=citations_list)
        packets.append(Packet(ind=current_index, obj=citation_delta))

        # End citation flow
        citation_end = CitationEnd()
        packets.append(Packet(ind=current_index, obj=citation_end))
        current_index += 1

    # Create MESSAGE_START packet
    message_start = MessageStart(id=str(message.message_id), content="")
    packets.append(Packet(ind=current_index, obj=message_start))

    # Create MESSAGE_DELTA packet with the full message content
    # In a real streaming scenario, this would be broken into multiple deltas
    if message.message:
        message_delta = MessageDelta(content=message.message)
        packets.append(Packet(ind=current_index, obj=message_delta))

    # Create MESSAGE_END packet
    message_end = MessageEnd()
    packets.append(Packet(ind=current_index, obj=message_end))
    current_index += 1

    # Create STOP packet
    stop = OverallStop()
    packets.append(Packet(ind=current_index, obj=stop))

    return packets


def create_simplified_packets_for_session(
    messages: list[ChatMessageDetail],
) -> list[list[Packet]]:
    """
    Convert a list of chat messages into simplified streaming packets organized by message.
    Each inner list contains packets for a single assistant message.

    Args:
        messages: List of chat messages from the session

    Returns:
        List of lists of simplified packets, where each inner list represents one assistant message
    """
    packets_by_message: list[list[Packet]] = []

    for message in messages:
        if message.message_type == MessageType.ASSISTANT:
            message_packets = create_simplified_packets_for_message(message, 0)
            if message_packets:  # Only add if there are actual packets
                packets_by_message.append(message_packets)

    return packets_by_message
