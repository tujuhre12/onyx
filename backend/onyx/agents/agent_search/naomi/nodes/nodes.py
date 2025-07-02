import json
from typing import cast

from langchain_core.runnables.config import RunnableConfig
from langgraph.types import StreamWriter

from onyx.agents.agent_search.basic.states import BasicInput
from onyx.agents.agent_search.basic.utils import process_llm_stream
from onyx.agents.agent_search.kb_search.states import MainInput as KBMainInput
from onyx.agents.agent_search.models import GraphConfig
from onyx.agents.agent_search.naomi.basic_graph_builder import basic_graph_builder
from onyx.agents.agent_search.naomi.kb_graph_builder import kb_graph_builder
from onyx.agents.agent_search.naomi.states import ExecutionStage
from onyx.agents.agent_search.naomi.states import NaomiState
from onyx.utils.logger import setup_logger

logger = setup_logger()


def decision_node(state: NaomiState, config: RunnableConfig) -> NaomiState:
    """
    Decision node that determines which graph to execute next based on current stage.
    """
    logger.info(f"Decision node: current stage is {state.current_stage}")
    structured_output_format= \
        {
            "type": "json_schema",
            "json_schema": {
                "name": "execution_stage_enum",
                "schema": {
                    "type": "object",
                    "properties": {
                        "execution_stage": {
                            "type": "string",
                            "enum": ["BASIC", "KB_SEARCH", "COMPLETE"],
                            "description": "The current execution stage of the process"
                        }
                    },
                    "required": ["execution_stage"],
                    "additionalProperties": False
                },
                "strict": True
            }
        }

    # For now, we'll implement a simple flow: BASIC -> KB_SEARCH -> COMPLETE
    # This can be enhanced with more sophisticated logic later

    agent_config = cast(GraphConfig, config["metadata"]["config"])
    llm = agent_config.tooling.primary_llm

    prompt =  f"""You are an agent with access to a basic search tool and a knowledge graph search tool. You are given a question and you need to decide whether you neeed to use a tool and if so, which tool to use. Both tools have access to the same base information (which is currently Linear tickets for the Onyx team). However, basic search performs information retrieval from these sources while using the knowledge graph takes the query and performs a relevant SQL query in a postgres database with tables of identified entities and their relationships. Select the tool you believe will be most effective for answering the question. If both tools could be effective, you should use the basic search tool. Return "BASIC" if you need to use the basic search tool, "KB_SEARCH" if you need to use the knowledge graph search tool, and "COMPLETE" if you don't need to use any tool. After each tool is used, you will see the results of from your previous tool calls. You should use the results of your previous tool calls to decide which tool to use next. "COMPLETE" should only be returned if you have already used at least one of the tools and have no more information to gather.
        
Here is the query: <START_OF_QUERY>{agent_config.inputs.prompt_builder.raw_user_query}<END_OF_QUERY>

This is the information you've already collected on previous steps:

Basic Search Results: 

{[result["short_output"] for result in state.basic_results]}

----------------------------------

KB Search Results: 

{state.kb_search_results}

----------------------------------

Please make your selection:
"""
    
    output = llm.invoke(
        prompt,
        structured_response_format=structured_output_format
    )


    print(prompt)
    # When using structured_response_format, the content is a JSON string
    # that needs to be parsed
    parsed_content = json.loads(output.content)
    execution_stage = parsed_content["execution_stage"]

    print("EXECUTION STAGE:", execution_stage)

    if execution_stage == ExecutionStage.BASIC:
    # If basic stage is complete, move to kb_search
        state.current_stage = ExecutionStage.BASIC
        logger.info("Moving to BASIC stage")
    elif execution_stage == ExecutionStage.KB_SEARCH:
        state.current_stage = ExecutionStage.KB_SEARCH
        logger.info("Moving to KB_SEARCH stage")
    elif execution_stage == ExecutionStage.COMPLETE:
        state.current_stage = ExecutionStage.COMPLETE
        logger.info("Moving to COMPLETE stage")
    else:
        raise ValueError(f"Invalid stage: {state.current_stage}")

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

        tool_call_output = result["tool_call_output"]
        tool_call_responses = tool_call_output.tool_call_responses

        tool_choice = result["tool_choice"]
        if tool_choice is None:
            raise ValueError("Tool choice is None")
        tool = tool_choice.tool

        # Store results in state
        # The result should contain the tool_call_chunk from BasicOutput
        state.basic_results.append(
            {
                "output": tool.build_tool_message_content(*tool_call_responses),
                "short_output": tool_call_output.tool_call_summary,
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


def finalize_results(state: NaomiState, config: RunnableConfig, writer: StreamWriter = lambda _: None) -> NaomiState:
    """
    Combine results from both graphs and create final answer.
    """
    logger.info("Finalizing results")

    # Combine results from both graphs
    basic_answers = []
    kb_answers = []

    for basic_result in state.basic_results:
        if basic_result.get("status") == "completed":
            basic_answers.append(basic_result.get("short_output", ""))

    for kb_result in state.kb_search_results:
        if kb_result.get("status") == "completed":
            kb_answers.append(kb_result.get("output", ""))


    agent_config = cast(GraphConfig, config["metadata"]["config"])
    llm = agent_config.tooling.primary_llm

    prompt =  f"""You are an agent with access to a basic search tool and a knowledge graph search tool. You are given a question and you need to decide whether you neeed to use a tool and if so, which tool to use. Both tools have access to the same base information (which is currently Linear tickets for the Onyx team). However, basic search performs information retrieval from these sources while using the knowledge graph takes the query and performs a relevant SQL query in a postgres database with tables of identified entities and their relationships. The following is the information you've already collected on previous steps:

Basic Search Results: 

{basic_answers}

----------------------------------

KB Search Results: 

{kb_answers}

----------------------------------

Here is the original user query: <START_OF_QUERY>{agent_config.inputs.prompt_builder.raw_user_query}<END_OF_QUERY>

Please answer the question based on the information you've collected:
"""
    
    output = llm.invoke(prompt)


    state.final_answer = output.content

    stream = llm.stream(prompt)

    process_llm_stream(
            stream,
            True,
            writer,
        )

    return state
