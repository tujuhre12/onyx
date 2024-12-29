from onyx.agent_search.core_state import CoreState
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalInput


def generate_raw_search_data(state: CoreState) -> ExpandedRetrievalInput:
    print("generate_raw_search_data")
    return ExpandedRetrievalInput(
        subgraph_search_request=state["search_request"],
        subgraph_primary_llm=state["primary_llm"],
        subgraph_fast_llm=state["fast_llm"],
        subgraph_db_session=state["db_session"],
        question=state["search_request"].query,
        dummy="7",
    )
