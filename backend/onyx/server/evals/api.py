import os

import braintrust
from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.orm import Session

from onyx.auth.users import current_user
from onyx.db.engine.sql_engine import get_session
from onyx.db.models import User
from onyx.evals.eval import eval
from onyx.server.evals.models import EvalRunResponse
from onyx.utils.logger import setup_logger

# from onyx.server.evals.models import EvalRunRequest

logger = setup_logger()

router = APIRouter(prefix="/evals")


@router.post("/eval_run", response_model=EvalRunResponse)
def eval_run(
    # user: User | None = Depends(api_key_dep),
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> EvalRunResponse:
    """
    Run an evaluation with the given message and optional dataset.
    This endpoint requires a valid API key for authentication.
    """
    dataset = braintrust.init_dataset(
        project=os.environ["BRAINTRUST_PROJECT"], name="Thoughtful Mode Evals"
    )
    eval(dataset)
    return EvalRunResponse(success=True)
