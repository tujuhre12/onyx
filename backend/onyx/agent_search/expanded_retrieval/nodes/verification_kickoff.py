from typing import Literal

from langgraph.types import Command
from langgraph.types import Send

from onyx.agent_search.core_state import in_subgraph_extract_core_fields
from onyx.agent_search.expanded_retrieval.nodes.doc_verification import (
    DocVerificationInput,
)
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalState


def verification_kickoff(
    state: ExpandedRetrievalState,
) -> Command[Literal["doc_verification"]]:
    documents = state["retrieved_documents"]
    verification_question = state.get(
        "question", state["subgraph_search_request"].query
    )
    return Command(
        update={},
        goto=[
            Send(
                node="doc_verification",
                arg=DocVerificationInput(
                    doc_to_verify=doc,
                    question=verification_question,
                    **in_subgraph_extract_core_fields(state),
                ),
            )
            for doc in documents
        ],
    )
