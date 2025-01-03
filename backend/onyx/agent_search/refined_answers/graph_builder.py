from langgraph.graph import END
from langgraph.graph import START
from langgraph.graph import StateGraph

from onyx.agent_search.answer_follow_up_question.graph_builder import (
    answer_follow_up_query_graph_builder,
)
from onyx.agent_search.main.edges import parallelize_follow_up_answer_queries
from onyx.agent_search.main.nodes import dummy_node
from onyx.agent_search.main.nodes import follow_up_decompose
from onyx.agent_search.main.nodes import ingest_follow_up_answers
from onyx.agent_search.main.states import RefinedAnswerInput
from onyx.agent_search.main.states import RefinedAnswerOutput
from onyx.agent_search.main.states import RefinedAnswerState


def refined_answers_graph_builder() -> StateGraph:
    graph = StateGraph(
        state_schema=RefinedAnswerState,
        input=RefinedAnswerInput,
        output=RefinedAnswerOutput,
    )

    ### Add nodes ###

    graph.add_node(
        node="dummy_node",
        action=dummy_node,
    )

    graph.add_node(
        node="follow_up_decompose",
        action=follow_up_decompose,
    )

    answer_follow_up_question = answer_follow_up_query_graph_builder().compile()
    graph.add_node(
        node="answer_follow_up_question",
        action=answer_follow_up_question,
    )

    graph.add_node(
        node="ingest_follow_up_answers",
        action=ingest_follow_up_answers,
    )

    # graph.add_node(
    #     node="format_follow_up_answer",
    #     action=format_follow_up_answer,
    # )

    ### Add edges ###

    graph.add_edge(start_key=START, end_key="dummy_node")

    graph.add_edge(
        start_key="dummy_node",
        end_key="follow_up_decompose",
    )

    graph.add_conditional_edges(
        source="follow_up_decompose",
        path=parallelize_follow_up_answer_queries,
        path_map=["answer_follow_up_question"],
    )
    graph.add_edge(
        start_key="answer_follow_up_question",
        end_key="ingest_follow_up_answers",
    )

    # graph.add_conditional_edges(
    #         start_key="answer_follow_up_question",
    #         end_key="ingest_follow_up_answers",
    #     )

    # graph.add_conditional_edges(
    #         start_key="ingest_follow_up_answers",
    #         end_key="format_follow_up_answer",
    #     )

    # graph.add_edge(
    #         start_key="format_follow_up_answer",
    #         end_key="generate_refined_answer",
    #     )

    # graph.add_edge(
    #         start_key="generate_refined_answer",
    #         end_key="refined_answer_quality_check",
    #     )

    # graph.add_edge(
    #     start_key="refined_answer_quality_check",
    #     end_key=END,
    # )

    # graph.add_edge(
    #     start_key="ingest_follow_up_answers",
    #     end_key="format_follow_up_answer",
    # )
    # graph.add_edge(
    #     start_key="format_follow_up_answer",
    #     end_key=END,
    # )

    graph.add_edge(
        start_key="ingest_follow_up_answers",
        end_key=END,
    )

    return graph


if __name__ == "__main__":
    pass
