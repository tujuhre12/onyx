import os
from typing import Any

from braintrust import Eval
from braintrust.logger import Dataset
from sqlalchemy.orm import Session

from onyx.chat.chat_utils import prepare_chat_message_request
from onyx.chat.process_message import gather_stream
from onyx.chat.process_message import stream_chat_message_objects
from onyx.context.search.models import RetrievalDetails
from onyx.llm.override_models import LLMOverride


def _get_answer(
    message: str,
    db_session: Session,
) -> str:
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
        llm_override=LLMOverride(
            name="Default",
            model_version="gpt-4.1",
            temperature=0.7,
        ),
    )
    # can do tool / llm configuration here
    packets = stream_chat_message_objects(
        new_msg_req=request,
        user=None,
        db_session=db_session,
    )
    answer = gather_stream(packets)
    return answer.answer
    # answer = list(answer.processed_streamed_output)
    # return " ".join([packet.obj.content for packet in answer])


def eval(db_session: Session, data: list[Any] | Dataset) -> float:
    braintrust_project = os.environ.get("BRAINTRUST_PROJECT")
    if not braintrust_project:
        raise ValueError("BRAINTRUST_PROJECT is not set")
    data = [
        {"input": "What is the capital of France?"},
        {"input": "What is the capital of Spain?"},
    ]
    # some weird concurrency or something?
    # but transactions should be isolated from concurrency
    Eval(
        name=braintrust_project,
        data=data,
        task=lambda input: _get_answer(input, db_session),
        scores=[],
        max_concurrency=1,
    )
    return 1.0
