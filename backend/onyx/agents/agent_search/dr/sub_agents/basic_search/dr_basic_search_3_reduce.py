from datetime import datetime

from langchain_core.runnables import RunnableConfig
from langgraph.types import StreamWriter

from onyx.agents.agent_search.dr.sub_agents.states import SubAgentMainState
from onyx.agents.agent_search.dr.sub_agents.states import SubAgentUpdate
from onyx.agents.agent_search.shared_graph_utils.utils import (
    get_langgraph_node_log_string,
)
from onyx.agents.agent_search.shared_graph_utils.utils import write_custom_event
from onyx.context.search.models import SavedSearchDoc
from onyx.context.search.utils import chunks_or_sections_to_search_docs
from onyx.server.query_and_chat.streaming_models import SearchToolDelta
from onyx.server.query_and_chat.streaming_models import SearchToolStart
from onyx.utils.logger import setup_logger


logger = setup_logger()


def is_reducer(
    state: SubAgentMainState,
    config: RunnableConfig,
    writer: StreamWriter = lambda _: None,
) -> SubAgentUpdate:
    """
    LangGraph node to perform a standard search as part of the DR process.
    """

    node_start_time = datetime.now()

    branch_updates = state.iteration_responses
    current_iteration = state.iteration_nr

    new_updates = [
        update for update in branch_updates if update.iteration_nr == current_iteration
    ]

    queries = [update.question for update in new_updates]
    doc_lists = [list(update.cited_documents.values()) for update in new_updates]

    doc_list = []

    for xs in doc_lists:
        for x in xs:
            doc_list.append(x)

    # Convert InferenceSections to SavedSearchDocs
    search_docs = chunks_or_sections_to_search_docs(doc_list)
    retrieved_saved_search_docs = [
        SavedSearchDoc.from_search_doc(search_doc, db_doc_id=0)
        for search_doc in search_docs
    ]

    # Write the results to the stream
    write_custom_event(
        "basic_search",
        SearchToolStart(
            type="internal_search_tool_start",
        ),
        writer,
    )

    write_custom_event(
        "basic_search",
        SearchToolDelta(
            queries=queries,
            documents=retrieved_saved_search_docs,
            type="internal_search_tool_delta",
        ),
        writer,
    )

    return SubAgentUpdate(
        iteration_responses=new_updates,
        log_messages=[
            get_langgraph_node_log_string(
                graph_component="basic_search",
                node_name="consolidation",
                node_start_time=node_start_time,
            )
        ],
    )
