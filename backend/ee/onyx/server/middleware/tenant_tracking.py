import json
import logging
from collections.abc import Awaitable
from collections.abc import Callable

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi import Request
from fastapi import Response

from onyx.auth.api_key import extract_tenant_from_api_key_header
from onyx.db.engine import is_valid_schema_name
from onyx.redis.redis_pool import get_async_redis_connection
from shared_configs.configs import MULTI_TENANT
from shared_configs.configs import POSTGRES_DEFAULT_SCHEMA
from shared_configs.contextvars import CURRENT_TENANT_ID_CONTEXTVAR

# Import your Redis instance from wherever it is created
# In your snippet, it's in onyx/auth/users.py as "redis"


def add_tenant_id_middleware(app: FastAPI, logger: logging.LoggerAdapter) -> None:
    @app.middleware("http")
    async def set_tenant_id(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        try:
            # Instead of a single ternary expression, split the logic
            if MULTI_TENANT:
                tenant_id = await _get_tenant_id_from_request(request, logger)
            else:
                tenant_id = POSTGRES_DEFAULT_SCHEMA

            CURRENT_TENANT_ID_CONTEXTVAR.set(tenant_id)
            return await call_next(request)

        except Exception as e:
            logger.error(f"Error in tenant ID middleware: {str(e)}")
            raise


KEY_PREFIX = "fastapi_users_token:"  # Matches default in RedisStrategy


async def _get_tenant_id_from_request(
    request: Request, logger: logging.LoggerAdapter
) -> str:
    """
    Attempt to extract tenant_id from:
    1) The API key header
    2) The Redis-based token (stored in Cookie: fastapiusersauth)
    Fallback: POSTGRES_DEFAULT_SCHEMA
    """
    # Check for API key
    tenant_id = extract_tenant_from_api_key_header(request)
    if tenant_id:
        return tenant_id

    # Check for Redis-based token in cookie
    token = request.cookies.get("fastapiusersauth")
    if not token:
        logger.debug(
            "No auth token cookie found, defaulting to POSTGRES_DEFAULT_SCHEMA"
        )
        return POSTGRES_DEFAULT_SCHEMA

    try:
        # Look up token data in Redis
        redis = await get_async_redis_connection()
        # IMPORTANT: Use the same prefix as RedisStrategy
        redis_key = KEY_PREFIX + token
        token_data_str = await redis.get(redis_key)
        if not token_data_str:
            logger.debug(
                f"Token key {redis_key} not found or expired in Redis, defaulting to POSTGRES_DEFAULT_SCHEMA"
            )
            return POSTGRES_DEFAULT_SCHEMA

        token_data = json.loads(token_data_str)
        tenant_id_from_payload = token_data.get("tenant_id", POSTGRES_DEFAULT_SCHEMA)

        # Since token_data.get() can return None, ensure we have a string
        tenant_id = (
            str(tenant_id_from_payload)
            if tenant_id_from_payload is not None
            else POSTGRES_DEFAULT_SCHEMA
        )

        if not is_valid_schema_name(tenant_id):
            raise HTTPException(status_code=400, detail="Invalid tenant ID format")

        return tenant_id

    except Exception as e:
        logger.error(f"Unexpected error in _get_tenant_id_from_request: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
