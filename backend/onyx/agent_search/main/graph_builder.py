from langgraph.graph import END
from langgraph.graph import START
from langgraph.graph import StateGraph

from onyx.agent_search.answer_question.graph_builder import answer_query_graph_builder
from onyx.agent_search.base_raw_search.graph_builder import (
    base_raw_search_graph_builder,
)
from onyx.agent_search.main.edges import parallelize_decompozed_answer_queries
from onyx.agent_search.main.nodes import generate_initial_answer
from onyx.agent_search.main.nodes import ingest_answers
from onyx.agent_search.main.nodes import ingest_initial_retrieval
from onyx.agent_search.main.nodes import main_decomp_base
from onyx.agent_search.main.states import MainInput
from onyx.agent_search.main.states import MainState


test_mode = False


def main_graph_builder(test_mode: bool = False) -> StateGraph:
    graph = StateGraph(
        state_schema=MainState,
        input=MainInput,
    )

    graph_component = "both"
    # graph_component = "right"
    # graph_component = "left"

    if graph_component == "left":
        ### Add nodes ###

        graph.add_node(
            node="base_decomp",
            action=main_decomp_base,
        )
        answer_query_subgraph = answer_query_graph_builder().compile()
        graph.add_node(
            node="answer_query",
            action=answer_query_subgraph,
        )

        # graph.add_node(
        #     node="prep_for_initial_retrieval",
        #     action=prep_for_initial_retrieval,
        # )

        # expanded_retrieval_subgraph = expanded_retrieval_graph_builder().compile()
        # graph.add_node(
        #     node="initial_retrieval",
        #     action=expanded_retrieval_subgraph,
        # )

        # base_raw_search_subgraph = base_raw_search_graph_builder().compile()
        # graph.add_node(
        #     node="base_raw_search_data",
        #     action=base_raw_search_subgraph,
        # )
        # graph.add_node(
        #     node="ingest_initial_retrieval",
        #     action=ingest_initial_retrieval,
        # )
        graph.add_node(
            node="ingest_answers",
            action=ingest_answers,
        )
        graph.add_node(
            node="generate_initial_answer",
            action=generate_initial_answer,
        )
        # if test_mode:
        #     graph.add_node(
        #         node="generate_initial_base_answer",
        #         action=generate_initial_base_answer,
        #     )

        ### Add edges ###

        # graph.add_conditional_edges(
        #     source=START,
        #     path=send_to_initial_retrieval,
        #     path_map=["initial_retrieval"],
        # )

        # graph.add_edge(
        #     start_key=START,
        #     end_key="prep_for_initial_retrieval",
        # )
        # graph.add_edge(
        #     start_key="prep_for_initial_retrieval",
        #     end_key="initial_retrieval",
        # )
        # graph.add_edge(
        #     start_key="initial_retrieval",
        #     end_key="ingest_initial_retrieval",
        # )

        # graph.add_edge(
        #     start_key=START,
        #     end_key="base_raw_search_data"
        # )

        # # graph.add_edge(
        # #     start_key="base_raw_search_data",
        # #     end_key=END
        # # )
        # graph.add_edge(
        #     start_key="base_raw_search_data",
        #     end_key="ingest_initial_retrieval",
        # )
        # graph.add_edge(
        #     start_key="ingest_initial_retrieval",
        #     end_key=END
        # )
        graph.add_edge(
            start_key=START,
            end_key="base_decomp",
        )
        graph.add_conditional_edges(
            source="base_decomp",
            path=parallelize_decompozed_answer_queries,
            path_map=["answer_query"],
        )
        graph.add_edge(
            start_key="answer_query",
            end_key="ingest_answers",
        )

        graph.add_edge(
            start_key="ingest_answers",
            end_key="generate_initial_answer",
        )

        # graph.add_edge(
        #     start_key=["ingest_answers", "ingest_initial_retrieval"],
        #     end_key="generate_initial_answer",
        # )

        graph.add_edge(
            start_key="generate_initial_answer",
            end_key=END,
        )
        # graph.add_edge(
        #     start_key="ingest_answers",
        #     end_key="generate_initial_answer",
        # )
        # if test_mode:
        #     graph.add_edge(
        #         start_key=["ingest_answers", "ingest_initial_retrieval"],
        #         end_key="generate_initial_base_answer",
        #     )
        #     graph.add_edge(
        #         start_key=["generate_initial_answer", "generate_initial_base_answer"],
        #         end_key=END,
        #     )
        # else:
        #     graph.add_edge(
        #         start_key="generate_initial_answer",
        #         end_key=END,
        #     )

    elif graph_component == "right":
        ### Add nodes ###

        # graph.add_node(
        #     node="base_decomp",
        #     action=main_decomp_base,
        # )
        # answer_query_subgraph = answer_query_graph_builder().compile()
        # graph.add_node(
        #     node="answer_query",
        #     action=answer_query_subgraph,
        # )

        # graph.add_node(
        #     node="prep_for_initial_retrieval",
        #     action=prep_for_initial_retrieval,
        # )

        # expanded_retrieval_subgraph = expanded_retrieval_graph_builder().compile()
        # graph.add_node(
        #     node="initial_retrieval",
        #     action=expanded_retrieval_subgraph,
        # )

        base_raw_search_subgraph = base_raw_search_graph_builder().compile()
        graph.add_node(
            node="base_raw_search_data",
            action=base_raw_search_subgraph,
        )
        graph.add_node(
            node="ingest_initial_retrieval",
            action=ingest_initial_retrieval,
        )
        # graph.add_node(
        #     node="ingest_answers",
        #     action=ingest_answers,
        # )
        graph.add_node(
            node="generate_initial_answer",
            action=generate_initial_answer,
        )
        # if test_mode:
        #     graph.add_node(
        #         node="generate_initial_base_answer",
        #         action=generate_initial_base_answer,
        #     )

        ### Add edges ###

        # graph.add_conditional_edges(
        #     source=START,
        #     path=send_to_initial_retrieval,
        #     path_map=["initial_retrieval"],
        # )

        # graph.add_edge(
        #     start_key=START,
        #     end_key="prep_for_initial_retrieval",
        # )
        # graph.add_edge(
        #     start_key="prep_for_initial_retrieval",
        #     end_key="initial_retrieval",
        # )
        # graph.add_edge(
        #     start_key="initial_retrieval",
        #     end_key="ingest_initial_retrieval",
        # )

        graph.add_edge(start_key=START, end_key="base_raw_search_data")

        # # graph.add_edge(
        # #     start_key="base_raw_search_data",
        # #     end_key=END
        # # )
        graph.add_edge(
            start_key="base_raw_search_data",
            end_key="ingest_initial_retrieval",
        )
        # graph.add_edge(
        #     start_key="ingest_initial_retrieval",
        #     end_key=END
        # )
        # graph.add_edge(
        #     start_key=START,
        #     end_key="base_decomp",
        # )
        # graph.add_conditional_edges(
        #     source="base_decomp",
        #     path=parallelize_decompozed_answer_queries,
        #     path_map=["answer_query"],
        # )
        # graph.add_edge(
        #     start_key="answer_query",
        #     end_key="ingest_answers",
        # )

        # graph.add_edge(
        #     start_key="ingest_answers",
        #     end_key="generate_initial_answer",
        # )

        graph.add_edge(
            start_key="ingest_initial_retrieval",
            end_key="generate_initial_answer",
        )

        # graph.add_edge(
        #     start_key=["ingest_answers", "ingest_initial_retrieval"],
        #     end_key="generate_initial_answer",
        # )

        graph.add_edge(
            start_key="generate_initial_answer",
            end_key=END,
        )
        # graph.add_edge(
        #     start_key="ingest_answers",
        #     end_key="generate_initial_answer",
        # )
        # if test_mode:
        #     graph.add_edge(
        #         start_key=["ingest_answers", "ingest_initial_retrieval"],
        #         end_key="generate_initial_base_answer",
        #     )
        #     graph.add_edge(
        #         start_key=["generate_initial_answer", "generate_initial_base_answer"],
        #         end_key=END,
        #     )
        # else:
        #     graph.add_edge(
        #         start_key="generate_initial_answer",
        #         end_key=END,
        #     )

    else:
        graph.add_node(
            node="base_decomp",
            action=main_decomp_base,
        )
        answer_query_subgraph = answer_query_graph_builder().compile()
        graph.add_node(
            node="answer_query",
            action=answer_query_subgraph,
        )

        # graph.add_node(
        #     node="prep_for_initial_retrieval",
        #     action=prep_for_initial_retrieval,
        # )

        # expanded_retrieval_subgraph = expanded_retrieval_graph_builder().compile()
        # graph.add_node(
        #     node="initial_retrieval",
        #     action=expanded_retrieval_subgraph,
        # )

        base_raw_search_subgraph = base_raw_search_graph_builder().compile()
        graph.add_node(
            node="base_raw_search_data",
            action=base_raw_search_subgraph,
        )
        graph.add_node(
            node="ingest_initial_retrieval",
            action=ingest_initial_retrieval,
        )
        graph.add_node(
            node="ingest_answers",
            action=ingest_answers,
        )
        graph.add_node(
            node="generate_initial_answer",
            action=generate_initial_answer,
        )
        # if test_mode:
        #     graph.add_node(
        #         node="generate_initial_base_answer",
        #         action=generate_initial_base_answer,
        #     )

        ### Add edges ###

        # graph.add_conditional_edges(
        #     source=START,
        #     path=send_to_initial_retrieval,
        #     path_map=["initial_retrieval"],
        # )

        # graph.add_edge(
        #     start_key=START,
        #     end_key="prep_for_initial_retrieval",
        # )
        # graph.add_edge(
        #     start_key="prep_for_initial_retrieval",
        #     end_key="initial_retrieval",
        # )
        # graph.add_edge(
        #     start_key="initial_retrieval",
        #     end_key="ingest_initial_retrieval",
        # )

        graph.add_edge(start_key=START, end_key="base_raw_search_data")

        # # graph.add_edge(
        # #     start_key="base_raw_search_data",
        # #     end_key=END
        # # )
        graph.add_edge(
            start_key="base_raw_search_data",
            end_key="ingest_initial_retrieval",
        )
        # graph.add_edge(
        #     start_key="ingest_initial_retrieval",
        #     end_key=END
        # )
        graph.add_edge(
            start_key=START,
            end_key="base_decomp",
        )
        graph.add_conditional_edges(
            source="base_decomp",
            path=parallelize_decompozed_answer_queries,
            path_map=["answer_query"],
        )
        graph.add_edge(
            start_key="answer_query",
            end_key="ingest_answers",
        )

        # graph.add_edge(
        #     start_key="ingest_answers",
        #     end_key="generate_initial_answer",
        # )

        graph.add_edge(
            start_key=["ingest_answers", "ingest_initial_retrieval"],
            end_key="generate_initial_answer",
        )

        graph.add_edge(
            start_key="generate_initial_answer",
            end_key=END,
        )
        # graph.add_edge(
        #     start_key="ingest_answers",
        #     end_key="generate_initial_answer",
        # )
        # if test_mode:
        #     graph.add_edge(
        #         start_key=["ingest_answers", "ingest_initial_retrieval"],
        #         end_key="generate_initial_base_answer",
        #     )
        #     graph.add_edge(
        #         start_key=["generate_initial_answer", "generate_initial_base_answer"],
        #         end_key=END,
        #     )
        # else:
        #     graph.add_edge(
        #         start_key="generate_initial_answer",
        #         end_key=END,
        #     )

    return graph


if __name__ == "__main__":
    pass

    from onyx.db.engine import get_session_context_manager
    from onyx.llm.factory import get_default_llms
    from onyx.context.search.models import SearchRequest

    graph = main_graph_builder()
    compiled_graph = graph.compile()
    primary_llm, fast_llm = get_default_llms()

    with get_session_context_manager() as db_session:
        search_request = SearchRequest(query="Who created Excel?")

        inputs = MainInput(
            search_request=search_request,
            primary_llm=primary_llm,
            fast_llm=fast_llm,
            db_session=db_session,
        )

        for thing in compiled_graph.stream(
            input=inputs,
            # stream_mode="debug",
            # debug=True,
            subgraphs=True,
        ):
            # print(thing)
            print()
