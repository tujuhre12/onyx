from fastapi import APIRouter
from fastapi import Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from onyx.auth.users import current_admin_user
from onyx.auth.users import current_user
from onyx.auth.users import get_user_manager
from onyx.auth.users import User
from onyx.auth.users import UserManager
from onyx.db.engine import get_session
from onyx.db.users import get_user_by_email
from onyx.server.features.password.models import UserResetRequest

router = APIRouter(prefix="/password")


class ChangePasswordPayload(BaseModel):
    old_password: str
    new_password: str


@router.post("/change-password")
async def change_my_password(
    form_data: ChangePasswordPayload,
    user_manager: UserManager = Depends(get_user_manager),
    current_user: User = Depends(current_user),
):
    """
    A user can change their own password by submitting old & new passwords.
    """
    await user_manager.change_password_if_old_matches(
        user=current_user,
        old_password=form_data.old_password,
        new_password=form_data.new_password,
    )
    return {"status": "success"}


@router.post("/reset_password")
async def admin_reset_user_password(
    user_reset_request: UserResetRequest,
    user_manager: UserManager = Depends(get_user_manager),
    db_session: Session = Depends(get_session),
    _: User = Depends(current_admin_user),
    # you might have a custom "is_admin" dependency, e.g.:
    # current_admin: User = Depends(require_admin_user),
):
    user = get_user_by_email(user_reset_request.user_email, db_session)
    # This calls the method we added
    new_password = await user_manager.reset_password_as_admin(user.id)
    return {
        "user_id": str(user.id),
        "new_password": new_password,  # Admin can give this to the user out-of-band
    }
