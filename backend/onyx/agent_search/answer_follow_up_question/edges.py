from collections.abc import Hashable

from langgraph.types import Send

from onyx.agent_search.answer_question.states import AnswerQuestionInput
from onyx.agent_search.core_state import in_subgraph_extract_core_fields
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalInput
from onyx.utils.logger import setup_logger

logger = setup_logger()


def send_to_expanded_refined_retrieval(state: AnswerQuestionInput) -> Send | Hashable:
    logger.info("sending to expanded retrieval for follow up question via edge")

    return Send(
        "decomposed_follow_up_retrieval",
        ExpandedRetrievalInput(
            **in_subgraph_extract_core_fields(state),
            question=state["question"],
            sub_question_id=state["question_id"],
            base_search=False
        ),
    )
