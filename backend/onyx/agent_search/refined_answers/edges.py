from collections.abc import Hashable

from langgraph.types import Send

from onyx.agent_search.answer_question.states import AnswerQuestionInput
from onyx.agent_search.answer_question.states import AnswerQuestionOutput
from onyx.agent_search.core_state import extract_core_fields_for_subgraph
from onyx.agent_search.main.states import MainState


def parallelize_follow_up_answer_queries(state: MainState) -> list[Send | Hashable]:
    if len(state["follow_up_sub_questions"]) > 0:
        return [
            Send(
                "answer_follow_up_question",
                AnswerQuestionInput(
                    **extract_core_fields_for_subgraph(state),
                    question=question_data.sub_question,
                    question_nr=question_nr,
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
