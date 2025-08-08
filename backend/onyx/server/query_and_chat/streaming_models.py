from pydantic import BaseModel

from onyx.chat.models import CitationInfo
from onyx.context.search.models import SavedSearchDoc


class BaseObj(BaseModel):
    type: str = ""


"""Basic Message Packets"""


class MessageStart(BaseObj):
    id: str
    type: str = "message_start"
    content: str


class MessageDelta(BaseObj):
    content: str
    type: str = "message_delta"


class MessageEnd(BaseObj):
    type: str = "message_end"


"""Control Packets"""


class Stop(BaseObj):
    type: str = "stop"


"""Tool Packets"""


class ToolStart(BaseObj):
    type: str = "tool_start"

    tool_name: str
    tool_icon: str

    # if left blank, we will use the tool name
    tool_main_description: str | None = None


class ToolDelta(BaseObj):
    type: str = "tool_delta"

    queries: list[str] | None = None
    documents: list[SavedSearchDoc] | None = None
    images: list[dict[str, str]] | None = None


class ToolEnd(BaseObj):
    type: str = "tool_end"


"""Citation Packets"""


class CitationStart(BaseObj):
    type: str = "citation_start"


class CitationDelta(BaseObj):
    type: str = "citation_delta"

    citations: list[CitationInfo] | None = None


class CitationEnd(BaseObj):
    type: str = "citation_end"

    # Total count of citations for reference
    total_citations: int | None = None


ObjTypes = (
    MessageStart
    | MessageDelta
    | MessageEnd
    | Stop
    | ToolStart
    | ToolDelta
    | ToolEnd
    | CitationStart
    | CitationDelta
    | CitationEnd
)


class Packet(BaseModel):
    ind: int
    obj: ObjTypes
