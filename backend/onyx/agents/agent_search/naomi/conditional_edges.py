from onyx.agents.agent_search.naomi.states import ExecutionStage
from onyx.agents.agent_search.naomi.states import NaomiState


def route_after_decision(state: NaomiState) -> str:
    """
    Route to the appropriate node based on the current stage after decision node.
    """
    if state.current_stage == ExecutionStage.BASIC:
        return "execute_basic_graph"
    if state.current_stage == ExecutionStage.KB_SEARCH:
        return "execute_kb_search_graph"
    elif state.current_stage == ExecutionStage.COMPLETE:
        return "finalize_results"
    else:
        raise ValueError(f"Invalid stage: {state.current_stage}")
