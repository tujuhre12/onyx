from typing import TypedDict

from langgraph.graph import END
from langgraph.graph import START
from langgraph.graph import StateGraph


# The overall state of the graph (this is the public state shared across nodes)
class OverallState(TypedDict):
    a: str


# Output from node_1 contains private data that is not part of the overall state
class Node1Output(TypedDict):
    private_data: str


# Node 2 input only requests the private data available after node_1
class Node2Input(TypedDict):
    private_data: str


# The private data is only shared between node_1 and node_2
def node_1(state: OverallState) -> Node2Input:
    output = {"private_data": "set by node_1"}
    print(f"Entered node `node_1`:\n\tInput: {state}.\n\tReturned: {output}")
    return output


def node_2(state: Node2Input) -> OverallState:
    output = {"a": "set by node_2"}
    print(f"Entered node `node_2`:\n\tInput: {state}.\n\tReturned: {output}")
    return output


# Node 3 only has access to the overall state (no access to private data from node_1)
def node_3(state: OverallState) -> OverallState:
    output = {"a": "set by node_3"}
    print(f"Entered node `node_3`:\n\tInput: {state}.\n\tReturned: {output}")
    return output


# Build the state graph
builder = StateGraph(OverallState)
builder.add_node(node_1)  # node_1 is the first node
builder.add_node(
    node_2
)  # node_2 is the second node and accepts private data from node_1
builder.add_node(node_3)  # node_3 is the third node and does not see the private data
builder.add_edge(START, "node_1")  # Start the graph with node_1
builder.add_edge("node_1", "node_2")  # Pass from node_1 to node_2
builder.add_edge(
    "node_2", "node_3"
)  # Pass from node_2 to node_3 (only overall state is shared)
builder.add_edge("node_3", END)  # End the graph after node_3
graph = builder.compile()

# Invoke the graph with the initial state
response = graph.invoke(
    {
        "a": "set at start",
    }
)

print()
print(f"Output of graph invocation: {response}")
