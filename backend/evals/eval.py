import os
from typing import Any

from braintrust import Eval
from braintrust.logger import Dataset
from sqlalchemy.orm import Session

from onyx.chat.answer import Answer
from onyx.chat.chat_utils import prepare_chat_message_request
from onyx.chat.models import AnswerStyleConfig
from onyx.chat.models import ChatBasicResponse
from onyx.chat.models import CitationConfig
from onyx.chat.models import PromptConfig
from onyx.chat.prompt_builder.answer_prompt_builder import AnswerPromptBuilder
from onyx.chat.prompt_builder.answer_prompt_builder import default_build_system_message
from onyx.chat.prompt_builder.answer_prompt_builder import default_build_user_message
from onyx.configs.constants import MessageType
from onyx.context.search.models import RetrievalDetails
from onyx.db.chat import create_new_chat_message
from onyx.db.chat import get_or_create_root_message
from onyx.llm.factory import get_llm
from onyx.natural_language_processing.utils import get_tokenizer
from onyx.tools.force import ForceUseTool


def _get_evaluation_llms():
    """Get real LLMs for evaluation purposes using OpenAI GPT-4.1"""
    api_key = os.environ.get("OPEN_AI_API_KEY")
    llm = get_llm(
        provider="openai",
        model="gpt-4.1",
        max_input_tokens=128000,  # GPT-4.1 context window
        deployment_name=None,
        api_key=api_key,  # Will use environment variable OPENAI_API_KEY
        api_base=None,
        api_version=None,
        custom_config=None,
        temperature=0.7,
        timeout=None,
        additional_headers=None,
        long_term_logger=None,
    )

    # Use the same LLM for both primary and fast LLM
    fast_llm = llm

    print("Successfully created OpenAI GPT-4.1 LLM for evaluation")
    return llm, fast_llm


def _get_answer(
    message: str,
    db_session: Session,
) -> ChatBasicResponse:
    prompt_config = PromptConfig(
        system_prompt="You are a helpful AI assistant. Answer questions clearly and concisely.",
        task_prompt="Please provide a helpful response to the user's question.",
        datetime_aware=True,
    )

    answer_style_config = AnswerStyleConfig(
        citation_config=CitationConfig(all_docs_useful=False),
        structured_response_format=None,
    )

    # Initialize real LLMs for evaluation
    llm, fast_llm = _get_evaluation_llms()
    llm_tokenizer = get_tokenizer(
        model_name=llm.config.model_name,
        provider_type=llm.config.model_provider,
    )

    persona = None  # No persona for this evaluation

    request = prepare_chat_message_request(
        message_text=message,
        user=None,
        persona_id=None,
        persona_override_config=None,
        prompt=None,
        message_ts_to_respond_to=None,
        retrieval_details=RetrievalDetails(),
        rerank_settings=None,
        db_session=db_session,
        use_agentic_search=False,
        skip_gen_ai_answer_generation=False,
    )
    chat_session_id = request.chat_session_id
    root_message = get_or_create_root_message(
        chat_session_id=chat_session_id, db_session=db_session
    )
    new_message = create_new_chat_message(
        chat_session_id=chat_session_id,
        parent_message=root_message,
        prompt_id=None,
        message=message,
        token_count=len(llm_tokenizer.encode(message)),
        message_type=MessageType.USER,
        files=None,  # Need to attach later for optimization to only load files once in parallel
        db_session=db_session,
        commit=True,
    )

    prompt_builder = AnswerPromptBuilder(
        user_message=default_build_user_message(
            user_query=message,
            prompt_config=prompt_config,
            files=[],
            single_message_history=None,
        ),
        system_message=default_build_system_message(prompt_config, llm.config),
        message_history=[],
        llm_config=llm.config,
        raw_user_query=message,
        raw_user_uploaded_files=[],
        single_message_history=None,
    )

    # LLM prompt building, response capturing, etc.
    answer = Answer(
        prompt_builder=prompt_builder,
        is_connected=lambda: True,
        latest_query_files=[],
        answer_style_config=answer_style_config,
        llm=llm,
        fast_llm=fast_llm,
        force_use_tool=ForceUseTool(force_use=False, tool_name="", args=None),
        persona=persona,
        rerank_settings=None,
        chat_session_id=chat_session_id,
        current_agent_message_id=new_message.id,
        tools=[],
        db_session=db_session,
        use_agentic_search=False,
        skip_gen_ai_answer_generation=False,
    )
    answer = list(answer.processed_streamed_output)
    return " ".join([packet.obj.content for packet in answer])


def eval(db_session: Session, data: list[Any] | Dataset) -> float:
    braintrust_project = os.environ.get("BRAINTRUST_PROJECT")
    if not braintrust_project:
        raise ValueError("BRAINTRUST_PROJECT is not set")
    Eval(
        name=braintrust_project,
        data=data,
        task=lambda input: _get_answer(input, db_session),
        scores=[],
    )
    return 1.0
