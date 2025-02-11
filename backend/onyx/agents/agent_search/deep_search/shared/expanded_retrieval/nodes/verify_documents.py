from typing import cast

from langchain_core.messages import BaseMessage
from langchain_core.messages import HumanMessage
from langchain_core.runnables.config import RunnableConfig

from onyx.agents.agent_search.deep_search.shared.expanded_retrieval.states import (
    DocVerificationInput,
)
from onyx.agents.agent_search.deep_search.shared.expanded_retrieval.states import (
    DocVerificationUpdate,
)
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.shared_graph_utils.agent_prompt_ops import (
    binary_string_test,
)
from onyx.agents.agent_search.shared_graph_utils.agent_prompt_ops import (
    trim_prompt_piece,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_LLM_RATELIMIT_MESSAGE,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_LLM_TIMEOUT_MESSAGE,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_POSITIVE_VALUE_STR,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AgentLLMErrorType,
)
from onyx.agents.agent_search.shared_graph_utils.models import AgentErrorLoggingFormat
from onyx.agents.agent_search.shared_graph_utils.models import LLMNodeErrorStrings
from onyx.configs.agent_configs import AGENT_TIMEOUT_OVERRIDE_LLM_DOCUMENT_VERIFICATION
from onyx.llm.chat_llm import LLMRateLimitError
from onyx.llm.chat_llm import LLMTimeoutError
from onyx.prompts.agent_search import (
    DOCUMENT_VERIFICATION_PROMPT,
)
from onyx.utils.logger import setup_logger

logger = setup_logger()

_llm_node_error_strings = LLMNodeErrorStrings(
    timeout="The LLM timed out. The document could not be verified. The document will be treated as 'relevant'",
    rate_limit="The LLM encountered a rate limit. The document could not be verified. The document will be treated as 'relevant'",
    general_error="The LLM encountered an error. The document could not be verified. The document will be treated as 'relevant'",
)


def verify_documents(
    state: DocVerificationInput, config: RunnableConfig
) -> DocVerificationUpdate:
    """
    LangGraph node to check whether the document is relevant for the original user question

    Args:
        state (DocVerificationInput): The current state
        config (RunnableConfig): Configuration containing AgentSearchConfig

    Updates:
        verified_documents: list[InferenceSection]
    """

    question = state.question
    retrieved_document_to_verify = state.retrieved_document_to_verify
    document_content = retrieved_document_to_verify.combined_content

    graph_config = cast(GraphConfig, config["metadata"]["config"])
    fast_llm = graph_config.tooling.fast_llm

    document_content = trim_prompt_piece(
        fast_llm.config, document_content, DOCUMENT_VERIFICATION_PROMPT + question
    )

    msg = [
        HumanMessage(
            content=DOCUMENT_VERIFICATION_PROMPT.format(
                question=question, document_content=document_content
            )
        )
    ]

    agent_error: AgentErrorLoggingFormat | None = None
    response: BaseMessage | None = None

    try:
        response = fast_llm.invoke(
            msg, timeout_override=AGENT_TIMEOUT_OVERRIDE_LLM_DOCUMENT_VERIFICATION
        )

    except LLMTimeoutError:
        # In this case, we decide to continue and don't raise an error, as
        # little harm in letting some docs through that are less relevant.
        agent_error = AgentErrorLoggingFormat(
            error_type=AgentLLMErrorType.TIMEOUT,
            error_message=AGENT_LLM_TIMEOUT_MESSAGE,
            error_result=_llm_node_error_strings.timeout,
        )
        logger.error("LLM Timeout Error - verify documents")
    except LLMRateLimitError:
        # In this case, we decide to continue and don't raise an error, as
        # little harm in letting some docs through that are less relevant.
        agent_error = AgentErrorLoggingFormat(
            error_type=AgentLLMErrorType.RATE_LIMIT,
            error_message=AGENT_LLM_RATELIMIT_MESSAGE,
            error_result=_llm_node_error_strings.rate_limit,
        )
        logger.error("LLM Rate Limit Error - verify documents")

    if agent_error or response is None:
        verified_documents = [retrieved_document_to_verify]

    else:
        verified_documents = []
        if isinstance(response.content, str) and binary_string_test(
            text=response.content, positive_value=AGENT_POSITIVE_VALUE_STR
        ):
            verified_documents.append(retrieved_document_to_verify)

    return DocVerificationUpdate(
        verified_documents=verified_documents,
    )
