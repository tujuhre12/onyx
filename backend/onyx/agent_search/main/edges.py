from collections.abc import Hashable
from typing import Literal

from langgraph.types import Send

from onyx.agent_search.answer_question.states import AnswerQuestionInput
from onyx.agent_search.answer_question.states import AnswerQuestionOutput
from onyx.agent_search.core_state import extract_core_fields_for_subgraph
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalInput
from onyx.agent_search.main.states import MainInput
from onyx.agent_search.main.states import MainState
from onyx.agent_search.main.states import RequireRefinedAnswerUpdate
from onyx.utils.logger import setup_logger

logger = setup_logger()


def parallelize_decompozed_answer_queries(state: MainState) -> list[Send | Hashable]:
    if len(state["initial_decomp_questions"]) > 0:
        return [
            Send(
                "answer_query",
                AnswerQuestionInput(
                    **extract_core_fields_for_subgraph(state),
                    question=question,
                    question_nr="0_" + str(question_nr),
                ),
            )
            for question_nr, question in enumerate(state["initial_decomp_questions"])
        ]

    else:
        return [
            Send(
                "ingest_answers",
                AnswerQuestionOutput(
                    answer_results=[],
                ),
            )
        ]


def send_to_initial_retrieval(state: MainInput) -> list[Send | Hashable]:
    logger.info("sending to initial retrieval via edge")
    return [
        Send(
            "initial_retrieval",
            ExpandedRetrievalInput(
                question=state["search_request"].query,
                **extract_core_fields_for_subgraph(state),
                base_search=False,
            ),
        )
    ]


# Define the function that determines whether to continue or not
def continue_to_refined_answer_or_end(
    state: RequireRefinedAnswerUpdate,
) -> Literal["follow_up_decompose", "logging_node"]:
    if state["require_refined_answer"]:
        return "follow_up_decompose"
    else:
        return "logging_node"


def parallelize_follow_up_answer_queries(state: MainState) -> list[Send | Hashable]:
    if len(state["follow_up_sub_questions"]) > 0:
        return [
            Send(
                "answer_follow_up_question",
                AnswerQuestionInput(
                    **extract_core_fields_for_subgraph(state),
                    question=question_data.sub_question,
                    question_nr="1_" + str(question_nr),
                ),
            )
            for question_nr, question_data in state["follow_up_sub_questions"].items()
        ]

    else:
        return [
            Send(
                "ingest_follow_up_answers",
                AnswerQuestionOutput(
                    answer_results=[],
                ),
            )
        ]
