from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi_users.exceptions import InvalidPasswordException
from sqlalchemy.orm import Session

from onyx.auth.users import current_admin_user
from onyx.auth.users import current_user
from onyx.auth.users import get_user_manager
from onyx.auth.users import User
from onyx.auth.users import UserManager
from onyx.db.engine import get_session
from onyx.db.users import get_user_by_email
from onyx.server.features.password.models import ChangePasswordRequest
from onyx.server.features.password.models import UserResetRequest
from onyx.server.features.password.models import UserResetResponse

router = APIRouter(prefix="/password")


@router.post("/change-password")
async def change_my_password(
    form_data: ChangePasswordRequest,
    user_manager: UserManager = Depends(get_user_manager),
    current_user: User = Depends(current_user),
) -> None:
    """A user can change their own password by submitting old & new passwords."""
    try:
        await user_manager.change_password_if_old_matches(
            user=current_user,
            old_password=form_data.old_password,
            new_password=form_data.new_password,
        )
    except InvalidPasswordException as e:
        raise HTTPException(status_code=400, detail=str(e.reason))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"An error occurred: {str(e)}")


@router.post("/reset_password")
async def admin_reset_user_password(
    user_reset_request: UserResetRequest,
    user_manager: UserManager = Depends(get_user_manager),
    db_session: Session = Depends(get_session),
    _: User = Depends(current_admin_user),
) -> UserResetResponse:
    user = get_user_by_email(user_reset_request.user_email, db_session)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_password = await user_manager.reset_password_as_admin(user.id)
    return UserResetResponse(
        user_id=str(user.id),
        new_password=new_password,
    )
