from collections.abc import Hashable

from langgraph.types import Send

from onyx.agent_search.answer_question.states import AnswerQuestionInput
from onyx.agent_search.core_state import in_subgraph_extract_core_fields
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalInput


def send_to_expanded_retrieval(state: AnswerQuestionInput) -> Send | Hashable:
    print("sending to expanded retrieval via edge")

    return Send(
        "decomped_expanded_retrieval",
        ExpandedRetrievalInput(
            **in_subgraph_extract_core_fields(state),
            question=state["question"],
            dummy="1",
            base_search=False
        ),
    )
