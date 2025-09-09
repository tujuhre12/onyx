from sqlalchemy.orm import Session

from onyx.chat.chat_utils import combine_message_thread
from onyx.chat.chat_utils import prepare_chat_message_request
from onyx.chat.models import AnswerStream
from onyx.chat.models import ChatBasicResponse
from onyx.chat.models import ThreadMessage
from onyx.chat.process_message import gather_stream
from onyx.chat.process_message import stream_chat_message_objects
from onyx.configs.app_configs import POSTGRES_API_SERVER_POOL_OVERFLOW
from onyx.configs.app_configs import POSTGRES_API_SERVER_POOL_SIZE
from onyx.configs.constants import POSTGRES_WEB_APP_NAME
from onyx.configs.onyxbot_configs import MAX_THREAD_CONTEXT_PERCENTAGE
from onyx.context.search.models import RetrievalDetails
from onyx.db.engine.sql_engine import get_session_with_current_tenant
from onyx.db.engine.sql_engine import SqlEngine
from onyx.llm.factory import get_llms_for_persona
from onyx.llm.factory import get_main_llm_from_tuple
from onyx.natural_language_processing.utils import get_tokenizer


def get_answer_stream(
    message: str,
    db_session: Session,
) -> AnswerStream:
    llm = get_main_llm_from_tuple(get_llms_for_persona(None))

    llm_tokenizer = get_tokenizer(
        model_name=llm.config.model_name,
        provider_type=llm.config.model_provider,
    )

    max_history_tokens = int(
        llm.config.max_input_tokens * MAX_THREAD_CONTEXT_PERCENTAGE
    )

    combined_message = combine_message_thread(
        messages=[ThreadMessage(message=message)],
        max_tokens=max_history_tokens,
        llm_tokenizer=llm_tokenizer,
    )

    # Also creates a new chat session
    request = prepare_chat_message_request(
        message_text=combined_message,
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

    packets = stream_chat_message_objects(
        new_msg_req=request,
        user=None,
        db_session=db_session,
    )

    return packets


def get_answer(input: str) -> ChatBasicResponse:
    with get_session_with_current_tenant() as db_session:
        packets = get_answer_stream(input, db_session)
        answer = gather_stream(packets)
    return answer


SqlEngine.set_app_name(POSTGRES_WEB_APP_NAME)
SqlEngine.init_engine(
    pool_size=POSTGRES_API_SERVER_POOL_SIZE,
    max_overflow=POSTGRES_API_SERVER_POOL_OVERFLOW,
)
print(get_answer("What is the capital of France?"))
