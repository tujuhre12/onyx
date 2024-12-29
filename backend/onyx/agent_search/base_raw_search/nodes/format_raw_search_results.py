from onyx.agent_search.base_raw_search.states import BaseRawSearchOutput
from onyx.agent_search.expanded_retrieval.states import ExpandedRetrievalOutput


def format_raw_search_results(state: ExpandedRetrievalOutput) -> BaseRawSearchOutput:
    print("format_raw_search_results")
    return BaseRawSearchOutput(
        base_expanded_retrieval_result=state["expanded_retrieval_result"],
        # base_retrieval_results=[state["expanded_retrieval_result"]],
        # base_search_documents=[],
    )
