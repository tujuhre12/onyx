from pydantic import BaseModel


class FollowUpSubQuestion(BaseModel):
    sub_question: str
    verified: bool
    answered: bool
    answer: str
