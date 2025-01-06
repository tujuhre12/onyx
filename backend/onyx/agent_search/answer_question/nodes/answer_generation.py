from typing import Any

from langchain_core.callbacks.manager import dispatch_custom_event
from langchain_core.messages import merge_message_runs

from onyx.agent_search.answer_question.states import AnswerQuestionState
from onyx.agent_search.answer_question.states import QAGenerationUpdate
from onyx.agent_search.shared_graph_utils.agent_prompt_ops import (
    build_sub_question_answer_prompt,
)
from onyx.agent_search.shared_graph_utils.prompts import ASSISTANT_SYSTEM_PROMPT_DEFAULT
from onyx.agent_search.shared_graph_utils.prompts import ASSISTANT_SYSTEM_PROMPT_PERSONA
from onyx.agent_search.shared_graph_utils.utils import get_persona_prompt
from onyx.chat.models import SubAnswer
from onyx.utils.logger import setup_logger

logger = setup_logger()


def answer_generation(state: AnswerQuestionState) -> QAGenerationUpdate:
    question = state["question"]
    docs = state["documents"]
    persona_prompt = get_persona_prompt(state["subgraph_config"].search_request.persona)

    if len(persona_prompt) > 0:
        persona_specification = ASSISTANT_SYSTEM_PROMPT_DEFAULT
    else:
        persona_specification = ASSISTANT_SYSTEM_PROMPT_PERSONA.format(
            persona_prompt=persona_prompt
        )

    logger.info(f"Number of verified retrieval docs: {len(docs)}")

    msg = build_sub_question_answer_prompt(
        question=question,
        original_question=state["subgraph_config"].search_request.query,
        docs=docs,
        persona_specification=persona_specification,
    )

    # msg = [
    #     HumanMessage(
    #         content=BASE_RAG_PROMPT.format(
    #             question=question,
    #             context=format_docs(docs),
    #             original_question=state["subgraph_search_request"].query,
    #             persona_specification=persona_specification,
    #         )
    #     )
    # ]

    fast_llm = state["subgraph_fast_llm"]
    response: list[str | list[str | dict[str, Any]]] = []
    for message in fast_llm.stream(
        prompt=msg,
    ):
        # TODO: in principle, the answer here COULD contain images, but we don't support that yet
        content = message.content
        if not isinstance(content, str):
            raise ValueError(
                f"Expected content to be a string, but got {type(content)}"
            )
        dispatch_custom_event(
            "sub_answers",
            SubAnswer(
                sub_answer=content,
                sub_question_id=state["question_id"],
            ),
        )
        response.append(content)

    answer_str = merge_message_runs(response, chunk_separator="")[0].content

    return QAGenerationUpdate(
        answer=answer_str,
    )
