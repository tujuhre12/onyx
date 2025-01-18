from onyx.agent_search.core_state import CoreState
from onyx.agent_search.pro_search_b.expanded_retrieval.states import (
    ExpandedRetrievalInput,
)
from onyx.utils.logger import setup_logger

logger = setup_logger()


def generate_raw_search_data(state: CoreState) -> ExpandedRetrievalInput:
    logger.debug("generate_raw_search_data")
    return ExpandedRetrievalInput(
        question=state["base_question"],
        base_search=True,
        sub_question_id=None,  # This graph is always and only used for the original question
    )
