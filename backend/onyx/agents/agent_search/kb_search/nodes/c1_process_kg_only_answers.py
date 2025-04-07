from datetime import datetime
from typing import cast

from langchain_core.runnables import RunnableConfig
from langgraph.types import StreamWriter

from onyx.agents.agent_search.kb_search.states import MainState
from onyx.agents.agent_search.kb_search.states import ResultsDataUpdate
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.shared_graph_utils.utils import (
    get_langgraph_node_log_string,
)
from onyx.utils.logger import setup_logger

logger = setup_logger()


def process_kg_only_answers(
    state: MainState, config: RunnableConfig, writer: StreamWriter = lambda _: None
) -> ResultsDataUpdate:
    """
    LangGraph node to start the agentic search process.
    """
    node_start_time = datetime.now()

    graph_config = cast(GraphConfig, config["metadata"]["config"])
    graph_config.inputs.search_request.query
    state.entities_types_str
    state.query_results

    return ResultsDataUpdate(
        query_results_data_str="",
        log_messages=[
            get_langgraph_node_log_string(
                graph_component="main",
                node_name="kg query results data processing",
                node_start_time=node_start_time,
            )
        ],
    )
