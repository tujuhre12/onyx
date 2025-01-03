from collections.abc import Hashable
from typing import Literal

from langgraph.graph import END
from langgraph.types import Send

from onyx.agent_search.answer_question.states import AnswerQuestionInput
from onyx.agent_search.answer_question.states import AnswerQuestionOutput
from onyx.agent_search.core_state import extract_core_fields_for_subgraph
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalInput
from onyx.agent_search.main.states import MainInput
from onyx.agent_search.main.states import MainState
from onyx.agent_search.main.states import RequireRefinedAnswerUpdate


def parallelize_decompozed_answer_queries(state: MainState) -> list[Send | Hashable]:
    if len(state["initial_decomp_questions"]) > 0:
        return [
            Send(
                "answer_query",
                AnswerQuestionInput(
                    **extract_core_fields_for_subgraph(state),
                    question=question,
                ),
            )
            for question in state["initial_decomp_questions"]
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
    print("sending to initial retrieval via edge")
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
) -> Literal["follow_up_decompose", "END"]:
    if state["require_refined_answer"]:
        return "follow_up_decompose"
    else:
        return END


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


# def continue_to_answer_sub_questions(state: QAState) -> Union[Hashable, list[Hashable]]:
#     # Routes re-written queries to the (parallel) retrieval steps
#     # Notice the 'Send()' API that takes care of the parallelization
#     return [
#         Send(
#             "sub_answers_graph",
#             ResearchQAState(
#                 sub_question=sub_question["sub_question_str"],
#                 sub_question_nr=sub_question["sub_question_nr"],
#                 graph_start_time=state["graph_start_time"],
#                 primary_llm=state["primary_llm"],
#                 fast_llm=state["fast_llm"],
#             ),
#         )
#         for sub_question in state["sub_questions"]
#     ]


# def continue_to_deep_answer(state: QAState) -> Union[Hashable, list[Hashable]]:
#     print("---GO TO DEEP ANSWER OR END---")

#     base_answer = state["base_answer"]

#     question = state["original_question"]

#     BASE_CHECK_MESSAGE = [
#         HumanMessage(
#             content=BASE_CHECK_PROMPT.format(question=question, base_answer=base_answer)
#         )
#     ]

#     model = state["fast_llm"]
#     response = model.invoke(BASE_CHECK_MESSAGE)

#     print(f"CAN WE CONTINUE W/O GENERATING A DEEP ANSWER? - {response.pretty_repr()}")

#     if response.pretty_repr() == "no":
#         return "decompose"
#     else:
#         return "end"
