from onyx.db.models import UserRole
from tests.integration.common_utils.managers.user import UserManager
from tests.integration.common_utils.test_models import DATestUser


def test_user_invitation_flow(reset_multitenant: None) -> None:
    # Create first user (admin)
    admin_user: DATestUser = UserManager.create(name="admin", email="admin@test.com")
    assert UserManager.is_role(admin_user, UserRole.ADMIN)

    # Create second user
    invited_user: DATestUser = UserManager.create(
        name="invited", email="invited@test.com"
    )
    assert UserManager.is_role(invited_user, UserRole.ADMIN)

    # Admin user invites the second user
    UserManager.invite_user(invited_user.email, admin_user)

    # Verify the user is in the invited users list
    invited_users = UserManager.get_invited_users(admin_user)
    assert invited_user.email in [
        user.email for user in invited_users
    ], f"User {invited_user.email} not found in invited users list"

    # Get user info to check tenant information
    user_info = UserManager.get_user_info(invited_user)

    # Extract the tenant_id from the invitation
    invited_tenant_id = (
        user_info.tenant_info.invitation.tenant_id
        if user_info.tenant_info and user_info.tenant_info.invitation
        else None
    )
    assert invited_tenant_id is not None, "Expected to find an invitation tenant_id"

    UserManager.accept_invitation(invited_tenant_id, invited_user)

    # Verify the user is now a basic user in admin's tenant
    # Get updated user info after accepting invitation
    updated_user_info = UserManager.get_user_info(invited_user)

    # Verify the user is no longer in the invited users list
    updated_invited_users = UserManager.get_invited_users(admin_user)
    assert invited_user.email not in [
        user.email for user in updated_invited_users
    ], f"User {invited_user.email} should not be in invited users list after accepting"

    # Verify the user has BASIC role in the organization
    assert (
        updated_user_info.role == UserRole.BASIC
    ), f"Expected user to have BASIC role, but got {updated_user_info.role}"

    # Verify the user is now part of the admin's tenant
    assert (
        updated_user_info.tenant_info is not None
    ), "Expected tenant_info to be present"
    assert (
        updated_user_info.tenant_info.invitation is None
    ), "Expected no pending invitation"
