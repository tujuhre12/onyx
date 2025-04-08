from datetime import datetime
from typing import cast

from langchain_core.runnables import RunnableConfig
from langgraph.types import StreamWriter

from onyx.agents.agent_search.dc_search_analysis.ops import research
from onyx.agents.agent_search.kb_search.states import ResearchObjectInput
from onyx.agents.agent_search.kb_search.states import ResearchObjectUpdate
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.shared_graph_utils.utils import (
    get_langgraph_node_log_string,
)
from onyx.utils.logger import setup_logger

logger = setup_logger()


def process_individual_deep_search(
    state: ResearchObjectInput,
    config: RunnableConfig,
    writer: StreamWriter = lambda _: None,
) -> ResearchObjectUpdate:
    """
    LangGraph node to start the agentic search process.
    """
    node_start_time = datetime.now()

    graph_config = cast(GraphConfig, config["metadata"]["config"])
    search_tool = graph_config.tooling.search_tool
    question = state.broken_down_question
    if not search_tool:
        raise ValueError("search_tool is not provided")

    object = state.entity

    kg_entity_filters = state.vespa_filter_results.entity_filters
    kg_relationship_filters = state.vespa_filter_results.relationship_filters

    results = research(
        question=question,
        kg_entities=kg_entity_filters,
        kg_relationships=kg_relationship_filters,
        search_tool=search_tool,
    )

    return ResearchObjectUpdate(
        research_object_results=[{"object": object, "results": results}],
        log_messages=[
            get_langgraph_node_log_string(
                graph_component="main",
                node_name="process individual deep search",
                node_start_time=node_start_time,
            )
        ],
    )
