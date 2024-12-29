from onyx.agent_search.core_state import extract_core_fields_for_subgraph
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalInput
from onyx.agent_search.main.states import MainState


def prep_for_initial_retrieval(state: MainState) -> ExpandedRetrievalInput:
    print("prepping")
    return ExpandedRetrievalInput(
        question=state["search_request"].query,
        dummy="0",
        **extract_core_fields_for_subgraph(state)
    )
