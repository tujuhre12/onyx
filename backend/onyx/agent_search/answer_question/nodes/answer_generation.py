from typing import Any

from langchain_core.callbacks.manager import dispatch_custom_event
from langchain_core.messages import HumanMessage
from langchain_core.messages import merge_message_runs

from onyx.agent_search.answer_question.states import AnswerQuestionState
from onyx.agent_search.answer_question.states import QAGenerationUpdate
from onyx.agent_search.shared_graph_utils.prompts import BASE_RAG_PROMPT
from onyx.agent_search.shared_graph_utils.utils import format_docs


def answer_generation(state: AnswerQuestionState) -> QAGenerationUpdate:
    question = state["question"]
    docs = state["documents"]

    print(f"Number of verified retrieval docs: {len(docs)}")

    msg = [
        HumanMessage(
            content=BASE_RAG_PROMPT.format(
                question=question,
                context=format_docs(docs),
                original_question=state["subgraph_config"].search_request.query,
            )
        )
    ]

    fast_llm = state["subgraph_fast_llm"]
    response: list[str | list[str | dict[str, Any]]] = []
    for message in fast_llm.stream(
        prompt=msg,
    ):
        dispatch_custom_event(
            "sub_answers",
            message.content,
        )
        response.append(message.content)

    answer_str = merge_message_runs(response, chunk_separator="")[0].content

    if state["subgraph_config"].use_persistence:
        # Persist the sub-answer in the database
        # db_session = state["subgraph_db_session"]
        # chat_session_id = state["subgraph_config"].chat_session_id
        # primary_message_id = state["subgraph_config"].message_id
        # sub_question_id = state["sub_question_id"]

        # if chat_session_id is not None and primary_message_id is not None and sub_question_id is not None:
        #     create_sub_answer(
        #         db_session=db_session,
        #         chat_session_id=chat_session_id,
        #         primary_message_id=primary_message_id,
        #         sub_question_id=sub_question_id,
        #         answer=answer_str,
        #     )
        pass

    return QAGenerationUpdate(
        answer=answer_str,
    )
