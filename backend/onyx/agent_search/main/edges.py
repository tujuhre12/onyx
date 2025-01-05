from collections.abc import Hashable

from langgraph.types import Send

from onyx.agent_search.answer_question.states import AnswerQuestionInput
from onyx.agent_search.answer_question.states import AnswerQuestionOutput
from onyx.agent_search.core_state import extract_core_fields_for_subgraph
from onyx.agent_search.main.states import MainState


def parallelize_decompozed_answer_queries(state: MainState) -> list[Send | Hashable]:
    if len(state["initial_decomp_questions"]) > 0:
        # sub_question_record_ids = [subq_record.id for subq_record in state["sub_question_records"]]
        # if len(state["sub_question_records"]) == 0:
        #     if state["config"].use_persistence:
        #         raise ValueError("No sub-questions found for initial decompozed questions")
        #     else:
        #         # in this case, we are doing retrieval on the original question.
        #         # to make all the logic consistent, we create a new sub-question
        #         # with the same content as the original question
        #         sub_question_record_ids = [1] * len(state["initial_decomp_questions"])

        return [
            Send(
                "answer_query",
                AnswerQuestionInput(
                    **extract_core_fields_for_subgraph(state),
                    question=question,
                    # sub_question_id=sub_question_record_id,
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
