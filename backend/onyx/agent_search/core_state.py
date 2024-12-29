from operator import add
from typing import Annotated
from typing import TypedDict
from typing import TypeVar

from sqlalchemy.orm import Session

from onyx.context.search.models import SearchRequest
from onyx.llm.interfaces import LLM


class CoreState(TypedDict, total=False):
    """
    This is the core state that is shared across all subgraphs.
    """

    search_request: SearchRequest
    primary_llm: LLM
    fast_llm: LLM
    # a single session for the entire agent search
    # is fine if we are only reading
    db_session: Session
    log_messages: Annotated[list[str], add]
    dummy: str


class SubgraphCoreState(TypedDict, total=False):
    """
    This is the core state that is shared across all subgraphs.
    """

    subgraph_search_request: SearchRequest
    subgraph_primary_llm: LLM
    subgraph_fast_llm: LLM
    # a single session for the entire agent search
    # is fine if we are only reading
    subgraph_db_session: Session


# This ensures that the state passed in extends the CoreState
T = TypeVar("T", bound=CoreState)
T_SUBGRAPH = TypeVar("T_SUBGRAPH", bound=SubgraphCoreState)


def extract_core_fields(state: T) -> CoreState:
    filtered_dict = {k: v for k, v in state.items() if k in CoreState.__annotations__}
    return CoreState(**dict(filtered_dict))  # type: ignore


def extract_core_fields_for_subgraph(state: T) -> SubgraphCoreState:
    filtered_dict = {
        "subgraph_" + k: v for k, v in state.items() if k in CoreState.__annotations__
    }
    return SubgraphCoreState(**dict(filtered_dict))  # type: ignore


def in_subgraph_extract_core_fields(state: T_SUBGRAPH) -> SubgraphCoreState:
    filtered_dict = {
        k: v for k, v in state.items() if k in SubgraphCoreState.__annotations__
    }
    return SubgraphCoreState(**dict(filtered_dict))
