from typing import Literal

from onyx.agents.agent_search.kb_search.states import KGAnswerStrategy
from onyx.agents.agent_search.kb_search.states import MainState


def simple_vs_search(
    state: MainState,
) -> Literal["generate_answer", "construct_deep_search_filters"]:
    if state.strategy == KGAnswerStrategy.SIMPLE:
        return "generate_answer"
    else:
        return "construct_deep_search_filters"
