from collections.abc import Hashable

from langgraph.types import Send

from onyx.agent_search.core_state import extract_core_fields
from onyx.agent_search.expanded_retrieval.nodes.doc_retrieval import RetrievalInput
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalState


def parallel_retrieval_edge(state: ExpandedRetrievalState) -> list[Send | Hashable]:
    question = state.get("question", state["search_request"].query)

    query_expansions = state.get("expanded_queries", []) + [question]
    return [
        Send(
            "doc_retrieval",
            RetrievalInput(
                query_to_retrieve=query,
                question=question,
                **extract_core_fields(state),
            ),
        )
        for query in query_expansions
    ]
