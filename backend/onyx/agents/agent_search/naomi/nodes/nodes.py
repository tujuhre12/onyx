from typing import cast

from langchain_core.runnables.config import RunnableConfig

from onyx.agents.agent_search.basic.states import BasicInput
from onyx.agents.agent_search.kb_search.states import MainInput as KBMainInput
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.naomi.basic_graph_builder import basic_graph_builder
from onyx.agents.agent_search.naomi.kb_graph_builder import kb_graph_builder
from onyx.agents.agent_search.naomi.states import ExecutionStage
from onyx.agents.agent_search.naomi.states import NaomiState
from onyx.utils.logger import setup_logger

logger = setup_logger()


def decision_node(state: NaomiState) -> NaomiState:
    """
    Decision node that determines which graph to execute next based on current stage.
    """
    logger.info(f"Decision node: current stage is {state.current_stage}")

    # For now, we'll implement a simple flow: BASIC -> KB_SEARCH -> COMPLETE
    # This can be enhanced with more sophisticated logic later

    if state.input_state is None:
        state.input_state = state

    if state.current_stage == ExecutionStage.BASIC:
        # If basic stage is complete, move to kb_search
        if state.basic_results:
            state.current_stage = ExecutionStage.KB_SEARCH
            logger.info("Moving to KB_SEARCH stage")
        else:
            # Stay in BASIC stage to execute basic graph
            logger.info("Executing BASIC graph")
    if state.current_stage == ExecutionStage.KB_SEARCH:
        # If kb_search stage is complete, move to complete
        if state.kb_search_results:
            state.current_stage = ExecutionStage.COMPLETE
            logger.info("Moving to COMPLETE stage")
        else:
            # Stay in KB_SEARCH stage to execute kb_search graph
            logger.info("Executing KB_SEARCH graph")

    print(state.current_stage)

    return state


def execute_basic_graph(state: NaomiState, config: RunnableConfig) -> NaomiState:
    """
    Execute the basic graph and store results in state.
    """
    logger.info("Executing basic graph")

    try:
        # Extract GraphConfig from RunnableConfig
        graph_config = cast(GraphConfig, config["metadata"]["config"])

        # Get the basic graph
        basic_graph = basic_graph_builder()
        compiled_basic_graph = basic_graph.compile()

        basic_input = BasicInput(unused=True)

        # Execute the basic graph directly with invoke
        result = compiled_basic_graph.invoke(
            basic_input, config={"metadata": {"config": graph_config}}
        )

        agent_config = cast(GraphConfig, config["metadata"]["config"])

        tool_call_output = result["tool_call_output"]
        tool_call_summary = tool_call_output.tool_call_summary
        tool_call_responses = tool_call_output.tool_call_responses

        tool_choice = result["tool_choice"]
        if tool_choice is None:
            raise ValueError("Tool choice is None")
        tool = tool_choice.tool
        prompt_builder = agent_config.inputs.prompt_builder
        new_prompt_builder = tool.build_next_prompt(
            prompt_builder=prompt_builder,
            tool_call_summary=tool_call_summary,
            tool_responses=tool_call_responses,
            using_tool_calling_llm=agent_config.tooling.using_tool_calling_llm,
        )

        # Store results in state
        # The result should contain the tool_call_chunk from BasicOutput
        state.basic_results.append(
            {
                "output": new_prompt_builder.build(),
                "status": "completed",
            }
        )

        logger.info("Basic graph execution completed")
        state.log_messages.append("Basic graph execution completed")

    except Exception as e:
        logger.error(f"Error executing basic graph: {e}")
        state.basic_results.append({"error": str(e), "status": "failed"})

    return state


def execute_kb_search_graph(state: NaomiState, config: RunnableConfig) -> NaomiState:
    """
    Execute the kb_search graph and store results in state.
    """
    logger.info("Executing kb_search graph")

    try:
        # Extract GraphConfig from RunnableConfig
        graph_config = cast(GraphConfig, config["metadata"]["config"])

        # Get the kb_search graph
        kb_graph = kb_graph_builder()
        compiled_kb_graph = kb_graph.compile()

        input = KBMainInput(log_messages=[])

        # Execute the kb_search graph directly with invoke
        result = compiled_kb_graph.invoke(
            input, config={"metadata": {"config": graph_config}}
        )

        # Store results in state
        if out := result["output"]:
            state.kb_search_results.append({"output": out, "status": "completed"})
        else:
            state.kb_search_results.append(
                {"error": "No results found", "status": "failed"}
            )

        logger.info("KB search graph execution completed")

    except Exception as e:
        logger.error(f"Error executing kb_search graph: {e}")
        state.kb_search_results.append({"error": str(e), "status": "failed"})

    return state


def finalize_results(state: NaomiState, config: RunnableConfig) -> NaomiState:
    """
    Combine results from both graphs and create final answer.
    """
    logger.info("Finalizing results")

    # Combine results from both graphs
    basic_answers = []
    kb_answers = []

    for basic_result in state.basic_results:
        if basic_result.get("status") == "completed":
            basic_answers.append(basic_result.get("output", ""))

    for kb_result in state.kb_search_results:
        if kb_result.get("status") == "completed":
            kb_answers.append(kb_result.get("output", ""))

    # Create final answer by combining both results
    if basic_answers and kb_answers:
        state.final_answer = f"Basic Search Results: {basic_answers}\n\nKnowledge Graph Search Results: {kb_answers}"
    elif basic_answers:
        state.final_answer = f"Basic Search Results: {basic_answers}"
    elif kb_answers:
        state.final_answer = f"Knowledge Graph Search Results: {kb_answers}"
    else:
        state.final_answer = "No results available from either search method."

    logger.info("Results finalized")

    print("FINAL ANSWER", state.final_answer)

    return state
