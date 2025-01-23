from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.orm import Session

from onyx.auth.users import current_admin_user
from onyx.background.indexing.models import IndexAttemptErrorPydantic
from onyx.db.engine import get_session
from onyx.db.index_attempt import (
    get_index_attempt_errors,
)
from onyx.db.models import User

router = APIRouter(prefix="/manage")


@router.get("/admin/index-attempt/{index_attempt_id}/errors")
def get_indexing_errors(
    index_attempt_id: int,
    _: User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> list[IndexAttemptErrorPydantic]:
    indexing_errors = get_index_attempt_errors(index_attempt_id, db_session)
    return [IndexAttemptErrorPydantic.from_model(e) for e in indexing_errors]
