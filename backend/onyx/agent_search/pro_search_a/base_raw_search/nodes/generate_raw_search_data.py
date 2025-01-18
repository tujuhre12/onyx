from typing import cast

from langchain_core.runnables.config import RunnableConfig

from onyx.agent_search.core_state import CoreState
from onyx.agent_search.models import ProSearchConfig
from onyx.agent_search.pro_search_a.expanded_retrieval.states import (
    ExpandedRetrievalInput,
)
from onyx.utils.logger import setup_logger

logger = setup_logger()


def generate_raw_search_data(
    state: CoreState, config: RunnableConfig
) -> ExpandedRetrievalInput:
    logger.debug("generate_raw_search_data")
    pro_search_config = cast(ProSearchConfig, config["metadata"]["config"])
    return ExpandedRetrievalInput(
        question=pro_search_config.search_request.query,
        base_search=True,
        sub_question_id=None,  # This graph is always and only used for the original question
    )
