import os


SKIP_CONNECTION_POOL_WARM_UP = (
    os.environ.get("SKIP_CONNECTION_POOL_WARM_UP", "").lower() == "true"
)
