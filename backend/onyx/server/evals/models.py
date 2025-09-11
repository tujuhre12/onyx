from typing import Any
from typing import TypeAlias

from braintrust import Dataset
from pydantic import BaseModel

Data: TypeAlias = list[Any] | Dataset


class EvalRunRequest(BaseModel):
    """Request model for evaluation runs"""

    impersonation_email: str | None = (
        None  # if none, then will run as a cloud superuser
    )


class EvalRunResponse(BaseModel):
    """Response model for evaluation runs"""

    success: bool
