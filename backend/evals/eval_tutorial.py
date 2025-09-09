from unittest.mock import MagicMock
from uuid import UUID

from braintrust import Eval
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from sqlalchemy.orm import Session

from onyx.chat.answer import Answer
from onyx.chat.models import AnswerStyleConfig
from onyx.chat.models import CitationConfig
from onyx.chat.models import PromptConfig
from onyx.chat.prompt_builder.answer_prompt_builder import AnswerPromptBuilder
from onyx.chat.prompt_builder.answer_prompt_builder import default_build_system_message
from onyx.chat.prompt_builder.answer_prompt_builder import default_build_user_message
from onyx.db.engine.sql_engine import get_session_with_current_tenant
from onyx.llm.factory import get_llm
from onyx.tools.force import ForceUseTool
from onyx.tools.tool import Tool


# Create a mock database session that passes type checking
def create_mock_db_session():
    """Create a mock database session for evaluation purposes"""
    mock_session = MagicMock(spec=Session)
    mock_session.commit.return_value = None
    mock_session.add.return_value = None
    mock_session.execute.return_value = MagicMock()
    mock_session.scalars.return_value = MagicMock()
    mock_session.query.return_value = MagicMock()
    return mock_session


# Initialize real LLMs for evaluation
def get_evaluation_llms():
    """Get real LLMs for evaluation purposes using OpenAI GPT-4.1"""
    try:
        # Create OpenAI GPT-4.1 LLM directly
        llm = get_llm(
            provider="openai",
            model="gpt-4.1",
            max_input_tokens=128000,  # GPT-4.1 context window
            deployment_name=None,
            api_key=None,  # Will use environment variable OPENAI_API_KEY
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
    except Exception as e:
        print(f"Warning: Could not create OpenAI GPT-4.1 LLM: {e}")
        print("Falling back to mock LLMs for evaluation")
        raise e
        # Fallback to mock if real LLMs are not available


# Mock objects for evaluation
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
llm, fast_llm = get_evaluation_llms()

# Additional mock objects needed for the evaluation
persona = None  # No persona for this evaluation
new_msg_req = type("MockRequest", (), {"llm_override": None})()
chat_session = type("MockChatSession", (), {"llm_override": None})()
litellm_additional_headers = None


def get_answer(input: str) -> str:
    load_dotenv()
    # TODO: Hardcode tools used
    tools: list[Tool] = []

    # Try to get a real database session, fall back to mock if not available
    try:
        with get_session_with_current_tenant() as db_session:
            return _get_answer_with_session(input, tools, db_session)
    except Exception as e:
        print(f"Warning: Could not get real database session: {e}")
        print("Using mock database session for evaluation")
        mock_db_session = create_mock_db_session()
        return _get_answer_with_session(input, tools, mock_db_session)


def _get_answer_with_session(input: str, tools: list[Tool], db_session: Session) -> str:
    prompt_builder = AnswerPromptBuilder(
        user_message=default_build_user_message(
            user_query=HumanMessage(content=input),
            prompt_config=prompt_config,
            files=[],
            single_message_history=None,
        ),
        system_message=default_build_system_message(prompt_config, llm.config),
        message_history=[],
        llm_config=llm.config,
        raw_user_query=input,
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
        chat_session_id=UUID("123e4567-e89b-12d3-a456-426614174000"),
        current_agent_message_id=0,
        tools=tools,
        db_session=db_session,
        use_agentic_search=False,
        skip_gen_ai_answer_generation=False,
    )

    # Extract text content from packets
    text_parts = []
    for packet in answer.processed_streamed_output:
        if hasattr(packet.obj, "content"):
            text_parts.append(packet.obj.content)

    return "".join(text_parts)


Eval(
    "Say Hi Bot",  # Replace with your project name
    data=lambda: [
        {
            "input": """
            What's a good mental model for reasoning about langgraph?
            It seems to be declarative, similar to react which makes it a bit tricky""",
        },
    ],  # Replace with your eval dataset
    task=get_answer,  # Replace with your LLM call
    scores=[],
)
