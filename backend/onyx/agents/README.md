# Onyx Agents

This directory contains the implementation of Onyx's agent system, which uses [Langgraph](https://langchain-ai.github.io/langgraph/tutorials/introduction/) to handle complex search and tool-using workflows.

## Overview

We have two graphs: basic and deep search. The graphs share an identical framework for choosing 
which if any tools to use. In particular, _there is no difference between basic and agentic search
when doing anything but search_. When the LLM chooses to use the search tool, the basic graph
runs a single retrieval and uses the results to answer the question. The deep search graph expands
the original question into a series of sub-questions, runs a retrieval for each sub-question, and 
uses the answers and retrieved documents from the subquestions to construct an initial answer to
the original question. If the LLM decides that the answer is insufficient, the deep search graph
iterates upon the results by deciding to ask further questions incorporating information from the
previous (sub-)questions and answers.

## Input Structure

Langgraph has two ways of passing data into a graph: `inputs` and `config`.
We use `config` for everything that does not change during graph execution, which 
includes data such as the original user question. This allows us to avoid having to pass around
unchanged objects as state. 

### Core Configuration and Input Classes
- `GraphConfig`: Main container of data used for graph execution
  - `inputs`: Input data (type: GraphInputs)
  - `tooling`: Available tools and LLMs (type: GraphTooling)
  - `behavior`: Search behavior settings (type: GraphSearchConfig)
  - `persistence`: Data persistence configuration (type: GraphPersistence)

- `GraphTooling`: Tools and LLMs available to the graph
  - `primary_llm`: Main LLM for complex reasoning
  - `fast_llm`: Secondary LLM for simpler tasks
  - `search_tool`: Tool for querying the vector database
  - `tools`: List of available tools (must contain the search tool when running agentic search)
  - `force_use_tool`: Tool usage enforcement settings
  - `using_tool_calling_llm`: Flag for LLM tool-calling capability

- `GraphSearchConfig`: Controls search behavior
  - `use_agentic_search`: Whether to use agentic search capabilities IF the LLM chooses to use the search tool
  - `perform_initial_search_decomposition`: Whether to do initial search for question decomposition
  - `allow_refinement`: Whether to allow follow-up refinement questions
  - `skip_gen_ai_answer_generation`: Whether to skip AI answer generation (should only be used in basic search)

- `GraphPersistence`: Handles data persistence (only used in agentic search)
  - `chat_session_id`: UUID for the chat session
  - `message_id`: ID for the agent's response message
  - `db_session`: Database session for agentic search (the message_id field comes from a ChatMessage flushed to this session)

- `GraphInputs`:
  - `search_request`: Contains the user's query and search parameters
  - `prompt_builder`: Contains chat history and other information used to build the prompt
  - `files`: Optional list of files for context
  - `structured_response_format`: Optional format specification for structured outputs (currently used only in basic search)

### Running the Graph

The main entrypoint for the graph is the `run_graph` function in `run_graph.py`. This function
takes a `GraphConfig` object and streams out data [using the `stream` method in custom mode](https://langchain-ai.github.io/langgraph/how-tos/streaming/#custom).
Data to be streamed is emitted from inside nodes throughout the graph using the `write_custom_event`
function. Most data emitted by the graph is sent directly to the client (typically the frontend), 
but for citations and tool responses there are some changes made in the `Answer` class and
`process_message.py`.

## Graph Structure

### Main Components

1. **Basic Graph**
   - Handles straightforward tool usage
   - Components: prepare_tool_input → llm_tool_choice → tool_call → basic_use_tool_response

2. **Agentic Search Graph**
   - Manages complex search workflows
   - Key subgraphs:
     - Initial Answer Generation
     - Query Decomposition
     - Expanded Retrieval
     - Answer Refinement

See <TODO: link to graph png> for more details.

### Misc Details

- Parallelism is [handled by conditional edges](https://langchain-ai.github.io/langgraph/how-tos/branching/) in the graph. 
- Langgraph runs NODES in parallel, not branches. So if you want A followed by B to run in parallel with C, you need to wrap A and B in a subgraph D and have conditional edges into D and C.
- Nodes in the orchestration/ folder are used in both basic and agentic search. Both graphs have an input preparation node that packages data before the tool choice node.
- Sink nodes are nodes that handle aggregating data from parallelized branches. These nodes are typically titled with "ingest".
- Our naming convention for nodes is `{action}_{subject}`. I.e. for a node responsible for generating an answer, we would have a node called `generate_answer` rather than `answer_generation`.
- Langgraph states can be dictionaries or pydantic BaseModels; we use exclusively BaseModels for type safety and guarantees on the presence of fields.

## Common Pitfalls

1. **State Management**
The state of each (sub-)graph is a pydantic BaseModel that contains the union of the keys passed in to the (sub-)graph and the return type of each node in the (sub-)graph. We implement this by having the state inherit from the input type and node return types. This means that when you add a new node to the subgraph, you must also update the state type to subclass the new node return type. If you want to share a key between multiple node return types `A` and `B` in a (sub-)graph, you must define a new update type `C` that contains the shared key(s), then have `A` and `B` inherit `C`. 

An alternate way to manage state key collisions is for each node to update its own key in the graph state, This is especially useful for states with many keys, but adds some code bloat in the nodes  (every return effectively has to be wrapped). It is also not always possible to do this, as some keys such as those used to aggregate parallel results NEED to be shared between nodes.

2. **Graph Edges Weirdness**
Watch out for annotations of state keys! Type annotations have semantic meaning in langgraph, as they decide how to aggregate data from multiple incoming nodes. Annotations are necessary in places where state is aggregated, but in our opinion should not be used beyond that. If you don't already know to look, it can be very difficult to find out that i.e. so de-duplication is happening between two nodes due to a special `add_deduped` aggregation function.

## Debugging

### Logging
- All major components use the logger from `onyx.utils.logger`
- Key events are logged with appropriate levels
- Set the debug level in your launch.json with the LOG_LEVEL environment variable

### Debug Tools

Breakpoints are quite useful to allow inspecting of state at key points. We have found that sometimes it's useful to be able to set breakpoints inside langgraph library code; for that set justMyCode to false in your launch.json.

### Testing
- Use `get_test_config()` for a basic configuration: Must set environment variables to get the persistence portion to run corrctly.
- Utilize the test runner in `__main__` blocks for component testing. THese are not guaranteed to be up-to-date, but should not be extremely difficult to adapt.
