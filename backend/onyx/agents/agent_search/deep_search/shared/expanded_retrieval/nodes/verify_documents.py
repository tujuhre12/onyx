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
    trim_prompt_piece,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_LLM_ERROR_MESSAGE,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_LLM_RATELIMIT_MESSAGE,
)
from onyx.agents.agent_search.shared_graph_utils.constants import (
    AGENT_LLM_TIMEOUT_MESSAGE,
)
from onyx.agents.agent_search.shared_graph_utils.models import AgentError
from onyx.configs.agent_configs import AGENT_TIMEOUT_OVERWRITE_LLM_DOCUMENT_VERIFICATION
from onyx.llm.chat_llm import LLMRateLimitError
from onyx.llm.chat_llm import LLMTimeoutError
from onyx.prompts.agent_search import (
    DOCUMENT_VERIFICATION_PROMPT,
)
from onyx.utils.logger import setup_logger

logger = setup_logger()


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

    agent_error: AgentError | None = None
    response: BaseMessage | None = None

    try:
        response = fast_llm.invoke(
            msg, timeout_overwrite=AGENT_TIMEOUT_OVERWRITE_LLM_DOCUMENT_VERIFICATION
        )

    except LLMTimeoutError:
        # In this case, we decide to continue and don't raise an error, as
        # little harm in letting some docs through that are less relevant.
        agent_error = AgentError(
            error_type="timeout",
            error_message=AGENT_LLM_TIMEOUT_MESSAGE,
            error_result="The LLM timed out, and the document could not be verified.",
        )
        logger.error("LLM Timeout Error - verify documents")
    except LLMRateLimitError:
        # In this case, we decide to continue and don't raise an error, as
        # little harm in letting some docs through that are less relevant.
        agent_error = AgentError(
            error_type="timeout",
            error_message=AGENT_LLM_RATELIMIT_MESSAGE,
            error_result="The LLM timed out, and the document could not be verified.",
        )
        logger.error("LLM Rate Limit Error - verify documents")

    except Exception:
        # In this case, we also do not raise an error, as little harm in
        # letting some docs through that are less relevant.
        agent_error = AgentError(
            error_type="LLM error",
            error_message=AGENT_LLM_ERROR_MESSAGE,
            error_result="The LLM errored out, and the document could not be verified.",
        )
        logger.error("General LLM Error - verify documents")
    if agent_error or response is None:
        verified_documents = [retrieved_document_to_verify]

    else:
        verified_documents = []
        if isinstance(response.content, str) and "yes" in response.content.lower():
            verified_documents.append(retrieved_document_to_verify)

    return DocVerificationUpdate(
        verified_documents=verified_documents,
    )
