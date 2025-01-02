from typing import TypedDict

from onyx.agent_search.main.states import MainState


class RefinedAnswerInput(MainState):
    pass


class RefinedAnswerOutput(TypedDict):
    dummy_output: str


class FollowUpSubQuestionsUpdate(TypedDict):
    follow_up_sub_question_dict: dict[str, dict[str, str]]


class RefinedAnswerState(RefinedAnswerInput, RefinedAnswerOutput):
    pass
