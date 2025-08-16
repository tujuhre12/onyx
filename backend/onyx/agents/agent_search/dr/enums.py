from enum import Enum


class ResearchType(str, Enum):
    """Research type options for agent search operations"""

    # BASIC = "BASIC"
    THOUGHTFUL = "THOUGHTFUL"
    DEEP = "DEEP"


class DRPath(str, Enum):
    CLARIFIER = "Clarifier"
    ORCHESTRATOR = "Orchestrator"
    INTERNAL_SEARCH = "Internal Search"
    GENERIC_TOOL = "Generic Tool"
    KNOWLEDGE_GRAPH = "Knowledge Graph"
    INTERNET_SEARCH = "Internet Search"
    IMAGE_GENERATION = "Image Generation"
    CLOSER = "Closer"
    END = "End"
