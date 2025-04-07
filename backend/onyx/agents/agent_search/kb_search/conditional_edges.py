from typing import Literal

from onyx.agents.agent_search.kb_search.states import KGAnswerStrategy
from onyx.agents.agent_search.kb_search.states import MainState


def simple_vs_search(
    state: MainState,
) -> Literal["process_kg_only_answers", "construct_deep_search_filters"]:
    if state.strategy == KGAnswerStrategy.SIMPLE:
        return "process_kg_only_answers"
    else:
        return "construct_deep_search_filters"
