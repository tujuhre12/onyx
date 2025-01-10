from pydantic import BaseModel


class FollowUpSubQuestion(BaseModel):
    sub_question: str
    sub_question_id: str
    verified: bool
    answered: bool
    answer: str
