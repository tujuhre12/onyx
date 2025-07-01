from langgraph.graph import END
from langgraph.graph import START
from langgraph.graph import StateGraph

from onyx.agents.agent_search.naomi.conditional_edges import (
    route_after_decision,
)
from onyx.agents.agent_search.naomi.nodes.nodes import decision_node
from onyx.agents.agent_search.naomi.nodes.nodes import execute_basic_graph
from onyx.agents.agent_search.naomi.nodes.nodes import execute_kb_search_graph
from onyx.agents.agent_search.naomi.nodes.nodes import finalize_results
from onyx.agents.agent_search.naomi.states import NaomiInput
from onyx.agents.agent_search.naomi.states import NaomiState
from onyx.utils.logger import setup_logger

logger = setup_logger()


def naomi_graph_builder() -> StateGraph:
    """
    LangGraph graph builder for the naomi orchestration process.
    This graph orchestrates both basic and kb_search graphs with a decision node.
    """

    graph = StateGraph(
        state_schema=NaomiState,
        input=NaomiInput,
    )

    ### Add nodes ###

    graph.add_node(
        "decision_node",
        decision_node,
    )

    graph.add_node(
        "execute_basic_graph",
        execute_basic_graph,
    )

    graph.add_node(
        "execute_kb_search_graph",
        execute_kb_search_graph,
    )

    graph.add_node(
        "finalize_results",
        finalize_results,
    )

    ### Add edges ###

    # Start with decision node
    graph.add_edge(start_key=START, end_key="decision_node")

    # Decision node routes to appropriate execution node
    graph.add_conditional_edges(
        "decision_node",
        route_after_decision,
        ["execute_basic_graph", "execute_kb_search_graph", "finalize_results"],
    )

    # After executing basic graph, go back to decision node
    graph.add_edge(
        start_key="execute_basic_graph",
        end_key="decision_node",
    )

    # After executing kb_search graph, go back to decision node
    graph.add_edge(
        start_key="execute_kb_search_graph",
        end_key="decision_node",
    )

    # After finalizing results, check if we should continue or end
    graph.add_edge(start_key="finalize_results", end_key=END)

    return graph


if __name__ == "__main__":
    # Test the graph
    from onyx.db.engine.sql_engine import get_session_with_current_tenant
    from onyx.context.search.models import SearchRequest
    from onyx.llm.factory import get_default_llms
    from onyx.agents.agent_search.shared_graph_utils.utils import get_test_config

    graph = naomi_graph_builder()
    compiled_graph = graph.compile()

    # Create test input
    input_data = NaomiInput()

    # Get LLMs and config
    primary_llm, fast_llm = get_default_llms()

    with get_session_with_current_tenant() as db_session:
        config, _ = get_test_config(
            db_session=db_session,
            primary_llm=primary_llm,
            fast_llm=fast_llm,
            search_request=SearchRequest(query="How does onyx use FastAPI?"),
        )

        # Execute the graph
        result = compiled_graph.invoke(
            input_data, config={"metadata": {"config": config}}
        )

        print("Final Answer:", result.get("final_answer", ""))
        print("Basic Results:", result.get("basic_results", {}))
        print("KB Search Results:", result.get("kb_search_results", {}))
