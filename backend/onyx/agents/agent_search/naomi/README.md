# Naomi Orchestration Graph

The Naomi orchestration graph is designed to execute both basic and kb_search graphs with a decision node that determines which graph to run based on the current execution stage.

## Overview

The graph follows this flow:
1. **Decision Node**: Determines which stage to execute (BASIC, KB_SEARCH, or COMPLETE)
2. **Basic Graph Execution**: Runs the basic search graph and stores results
3. **KB Search Graph Execution**: Runs the knowledge graph search and stores results
4. **Finalization**: Combines results from both graphs into a final answer
5. **Loop Back**: Returns to decision node to determine next steps

## Architecture

### State Management
- `NaomiState`: Main state that tracks current stage and stores results from both graphs
- `ExecutionStage`: Enum defining the three stages (BASIC, KB_SEARCH, COMPLETE)
- Results from each graph are stored separately and combined at the end

### Nodes
- `decision_node`: Determines which graph to execute next
- `execute_basic_graph`: Runs the basic search graph
- `execute_kb_search_graph`: Runs the knowledge graph search
- `finalize_results`: Combines results and creates final answer

### Conditional Edges
- `route_after_decision`: Routes to appropriate execution node based on current stage
- `should_continue`: Determines if graph should continue or end

## Usage

### Basic Usage
```python
from onyx.agents.agent_search.naomi import naomi_graph_builder, NaomiInput

# Build the graph
graph = naomi_graph_builder()
compiled_graph = graph.compile()

# Create input
input_data = NaomiInput()

# Execute with proper config
result = compiled_graph.invoke(input_data, config={"metadata": {"config": config}})

# Access results
final_answer = result.get("final_answer")
basic_results = result.get("basic_results")
kb_search_results = result.get("kb_search_results")
```

### Testing
Run the test script to see the graph in action:
```bash
cd backend/onyx/agents/agent_search/naomi
python test_naomi.py
```

## Execution Flow

1. **Start**: Graph begins with decision node
2. **Stage Check**: Decision node checks current stage
3. **Graph Execution**: 
   - If BASIC stage: Execute basic graph
   - If KB_SEARCH stage: Execute kb_search graph
   - If COMPLETE stage: Finalize results
4. **Result Storage**: Results are stored in state
5. **Loop**: Return to decision node
6. **Completion**: When COMPLETE stage has results, graph ends

## Customization

### Modifying Decision Logic
Edit the `decision_node` function in `nodes.py` to implement custom decision logic based on:
- Query complexity
- Previous results quality
- User preferences
- Performance requirements

### Adding New Stages
1. Add new stage to `ExecutionStage` enum in `states.py`
2. Update decision logic in `nodes.py`
3. Add routing logic in `conditional_edges.py`
4. Update graph builder in `graph_builder.py`

### Config Integration
The current implementation is simplified. In production, you'll need to:
- Pass proper config with LLMs and database session
- Handle authentication and permissions
- Implement proper error handling and retry logic
- Add monitoring and logging

## Dependencies

- `langgraph`: For graph construction and execution
- `pydantic`: For state validation
- `onyx.agents.agent_search.basic`: Basic search graph
- `onyx.agents.agent_search.kb_search`: Knowledge graph search
- `onyx.utils.logger`: For logging

## File Structure

```
naomi/
├── __init__.py              # Package initialization
├── states.py                # State definitions
├── nodes.py                 # Node functions
├── conditional_edges.py     # Conditional edge logic
├── graph_builder.py         # Main graph builder
├── test_naomi.py           # Test script
└── README.md               # This file
``` 