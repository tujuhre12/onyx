"""
Periodic tasks for tenant pre-provisioning.
"""
import asyncio
import datetime
import logging
import uuid

from celery import shared_task
from celery import Task
from redis.lock import Lock as RedisLock
from sqlalchemy.orm import Session

from onyx.background.celery.celery_utils import get_redis_client
from onyx.configs.app_configs import TARGET_AVAILABLE_TENANTS
from onyx.configs.constants import OnyxCeleryPriority
from onyx.configs.constants import OnyxCeleryQueues
from onyx.configs.constants import OnyxCeleryTask
from onyx.configs.constants import OnyxRedisLocks
from onyx.db.engine import get_sqlalchemy_engine
from onyx.db.models import NewAvailableTenant
from shared_configs.configs import MULTI_TENANT
from shared_configs.configs import TENANT_ID_PREFIX
from shared_configs.enums import EmbeddingProvider

# Default number of pre-provisioned tenants to maintain
DEFAULT_TARGET_AVAILABLE_TENANTS = 5

# Soft time limit for tenant pre-provisioning tasks (in seconds)
_TENANT_PROVISIONING_SOFT_TIME_LIMIT = 60 * 5  # 5 minutes
# Hard time limit for tenant pre-provisioning tasks (in seconds)
_TENANT_PROVISIONING_TIME_LIMIT = 60 * 10  # 10 minutes

logger = logging.getLogger(__name__)


@shared_task(
    name=OnyxCeleryTask.CHECK_AVAILABLE_TENANTS,
    ignore_result=True,
    soft_time_limit=_TENANT_PROVISIONING_SOFT_TIME_LIMIT,
    time_limit=_TENANT_PROVISIONING_TIME_LIMIT,
    queue=OnyxCeleryQueues.PRIMARY,
    bind=True,
)
def check_available_tenants(self: Task) -> None:
    """
    Check if we have enough pre-provisioned tenants available.
    If not, trigger the pre-provisioning of new tenants.
    """
    if not MULTI_TENANT:
        logger.debug("Multi-tenancy is not enabled, skipping tenant pre-provisioning")
        return

    r = get_redis_client()
    lock_check: RedisLock = r.lock(
        OnyxRedisLocks.CHECK_AVAILABLE_TENANTS_LOCK,
        timeout=_TENANT_PROVISIONING_SOFT_TIME_LIMIT,
    )

    # These tasks should never overlap
    if not lock_check.acquire(blocking=False):
        logger.debug(
            "Skipping check_available_tenants task because it is already running"
        )
        return

    try:
        # Get the current count of available tenants
        with Session(get_sqlalchemy_engine()) as db_session:
            available_tenants_count = db_session.query(NewAvailableTenant).count()

        # Get the target number of available tenants
        target_available_tenants = getattr(
            TARGET_AVAILABLE_TENANTS, "value", DEFAULT_TARGET_AVAILABLE_TENANTS
        )

        # Calculate how many new tenants we need to provision
        tenants_to_provision = max(
            0, target_available_tenants - available_tenants_count
        )

        logger.info(
            f"Available tenants: {available_tenants_count}, "
            f"Target: {target_available_tenants}, "
            f"To provision: {tenants_to_provision}"
        )

        # Trigger pre-provisioning tasks for each tenant needed
        for _ in range(tenants_to_provision):
            pre_provision_tenant.apply_async(
                priority=OnyxCeleryPriority.LOW,
            )

    except Exception as e:
        logger.exception(f"Error in check_available_tenants task: {e}")
    finally:
        lock_check.release()


@shared_task(
    name=OnyxCeleryTask.PRE_PROVISION_TENANT,
    ignore_result=True,
    soft_time_limit=_TENANT_PROVISIONING_SOFT_TIME_LIMIT,
    time_limit=_TENANT_PROVISIONING_TIME_LIMIT,
    queue=OnyxCeleryQueues.PRIMARY,
    bind=True,
)
def pre_provision_tenant(self: Task) -> None:
    """
    Pre-provision a new tenant and store it in the NewAvailableTenant table.
    This function fully sets up the tenant with all necessary configurations,
    so it's ready to be assigned to a user immediately.
    """
    if not MULTI_TENANT:
        logger.debug("Multi-tenancy is not enabled, skipping tenant pre-provisioning")
        return

    r = get_redis_client()
    lock_provision: RedisLock = r.lock(
        OnyxRedisLocks.PRE_PROVISION_TENANT_LOCK,
        timeout=_TENANT_PROVISIONING_SOFT_TIME_LIMIT,
    )

    # Allow multiple pre-provisioning tasks to run, but ensure they don't overlap
    if not lock_provision.acquire(blocking=False):
        logger.debug("Skipping pre_provision_tenant task because it is already running")
        return

    try:
        # Generate a new tenant ID
        tenant_id = TENANT_ID_PREFIX + str(uuid.uuid4())
        token = None

        # Import here to avoid circular imports
        from ee.onyx.server.tenants.schema_management import create_schema_if_not_exists
        from ee.onyx.server.tenants.schema_management import run_alembic_migrations
        from ee.onyx.server.tenants.schema_management import get_current_alembic_version
        from ee.onyx.server.tenants.provisioning import configure_default_api_keys
        from onyx.setup import setup_onyx
        from onyx.db.models import SearchSettings, IndexModelStatus
        from shared_configs.contextvars import CURRENT_TENANT_ID_CONTEXTVAR
        from onyx.db.engine import get_session_with_tenant

        # Create the schema for the new tenant
        if not create_schema_if_not_exists(tenant_id):
            logger.debug(f"Created schema for tenant {tenant_id}")
        else:
            logger.debug(f"Schema already exists for tenant {tenant_id}")

        try:
            # Set the tenant context
            token = CURRENT_TENANT_ID_CONTEXTVAR.set(tenant_id)

            # Run Alembic migrations
            asyncio.run(asyncio.to_thread(run_alembic_migrations, tenant_id))

            # Configure the tenant with default settings
            with get_session_with_tenant(tenant_id=tenant_id) as db_session:
                # Configure default API keys
                configure_default_api_keys(db_session)

                # Set up Onyx with appropriate settings
                current_search_settings = (
                    db_session.query(SearchSettings)
                    .filter_by(status=IndexModelStatus.FUTURE)
                    .first()
                )
                cohere_enabled = (
                    current_search_settings is not None
                    and current_search_settings.provider_type
                    == EmbeddingProvider.COHERE
                )
                setup_onyx(db_session, tenant_id, cohere_enabled=cohere_enabled)

            # Get the current Alembic version
            alembic_version = get_current_alembic_version(tenant_id)

            # Store the pre-provisioned tenant in the database
            with Session(get_sqlalchemy_engine()) as db_session:
                new_tenant = NewAvailableTenant(
                    tenant_id=tenant_id,
                    alembic_version=alembic_version,
                    date_created=datetime.datetime.now(),
                )
                db_session.add(new_tenant)
                db_session.commit()

            logger.info(f"Successfully pre-provisioned tenant {tenant_id}")

        finally:
            if token is not None:
                CURRENT_TENANT_ID_CONTEXTVAR.reset(token)

    except Exception as e:
        logger.exception(f"Error in pre_provision_tenant task: {e}")
    finally:
        lock_provision.release()
