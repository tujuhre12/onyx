from collections.abc import Hashable
from typing import cast

from langchain_core.runnables.config import RunnableConfig
from langgraph.types import Send

from onyx.agent_search.models import ProSearchConfig
from onyx.agent_search.pro_search_a.expanded_retrieval.nodes import RetrievalInput
from onyx.agent_search.pro_search_a.expanded_retrieval.states import (
    ExpandedRetrievalState,
)


def parallel_retrieval_edge(
    state: ExpandedRetrievalState, config: RunnableConfig
) -> list[Send | Hashable]:
    pro_search_config = cast(ProSearchConfig, config["metadata"]["config"])
    question = state.get("question", pro_search_config.search_request.query)

    query_expansions = state.get("expanded_queries", []) + [question]
    return [
        Send(
            "doc_retrieval",
            RetrievalInput(
                query_to_retrieve=query,
                question=question,
                base_search=False,
                sub_question_id=state.get("sub_question_id"),
            ),
        )
        for query in query_expansions
    ]
