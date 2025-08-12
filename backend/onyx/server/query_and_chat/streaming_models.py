from typing import Annotated
from typing import Literal
from typing import Union

from pydantic import BaseModel
from pydantic import Field

from onyx.chat.models import CitationInfo
from onyx.context.search.models import SavedSearchDoc


class BaseObj(BaseModel):
    type: str = ""


"""Basic Message Packets"""


class MessageStart(BaseObj):
    id: str
    type: Literal["message_start"] = "message_start"
    content: str


class MessageDelta(BaseObj):
    content: str
    type: Literal["message_delta"] = "message_delta"


"""Control Packets"""


class OverallStop(BaseObj):
    type: Literal["stop"] = "stop"


class SectionEnd(BaseObj):
    type: Literal["section_end"] = "section_end"


"""Tool Packets"""


class SearchToolStart(BaseObj):
    type: Literal["internal_search_tool_start"] = "internal_search_tool_start"

    is_internet_search: bool = False


class SearchToolDelta(BaseObj):
    type: Literal["internal_search_tool_delta"] = "internal_search_tool_delta"

    queries: list[str] | None = None
    documents: list[SavedSearchDoc] | None = None


class ImageGenerationToolStart(BaseObj):
    type: Literal["image_generation_tool_start"] = "image_generation_tool_start"


class ImageGenerationToolDelta(BaseObj):
    type: Literal["image_generation_tool_delta"] = "image_generation_tool_delta"

    images: list[dict[str, str]] | None = None


class CustomToolStart(BaseObj):
    type: Literal["custom_tool_start"] = "custom_tool_start"

    tool_name: str


class CustomToolDelta(BaseObj):
    type: Literal["custom_tool_delta"] = "custom_tool_delta"

    tool_name: str
    response_type: str
    # For non-file responses
    data: dict | list | str | int | float | bool | None = None
    # For file-based responses like image/csv
    file_ids: list[str] | None = None


"""Reasoning Packets"""


class ReasoningStart(BaseObj):
    type: Literal["reasoning_start"] = "reasoning_start"


class ReasoningDelta(BaseObj):
    type: Literal["reasoning_delta"] = "reasoning_delta"

    reasoning: str


"""Citation Packets"""


class CitationStart(BaseObj):
    type: Literal["citation_start"] = "citation_start"


class CitationDelta(BaseObj):
    type: Literal["citation_delta"] = "citation_delta"

    citations: list[CitationInfo] | None = None


"""Packet"""

# Discriminated union of all possible packet object types
PacketObj = Annotated[
    Union[
        MessageStart,
        MessageDelta,
        OverallStop,
        SectionEnd,
        SearchToolStart,
        SearchToolDelta,
        ImageGenerationToolStart,
        ImageGenerationToolDelta,
        CustomToolStart,
        CustomToolDelta,
        ReasoningStart,
        ReasoningDelta,
        CitationStart,
        CitationDelta,
    ],
    Field(discriminator="type"),
]


class Packet(BaseModel):
    ind: int
    obj: PacketObj
