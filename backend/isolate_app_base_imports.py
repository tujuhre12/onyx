#!/usr/bin/env python3
"""
Isolate exactly which import in app_base.py causes the heavy modules to load.
"""

import subprocess


def create_app_base_isolation_script():
    """Create script to test each import in app_base.py individually"""

    return """
import sys
import gc

def get_memory_mb():
    try:
        import psutil
        return psutil.Process().memory_info().rss / 1024 / 1024
    except:
        return 0

def count_heavy_modules():
    heavy_patterns = ["torch", "transformers", "sentence_transformers", "sklearn", "numpy", "tokenizers", "huggingface"]
    heavy_modules = []
    for module_name in sys.modules:
        if any(pattern in module_name.lower() for pattern in heavy_patterns):
            heavy_modules.append(module_name)
    return len(heavy_modules), heavy_modules

print("=== ISOLATING APP_BASE.PY HEAVY IMPORT SOURCE ===")

initial_memory = get_memory_mb()
initial_modules = len(sys.modules)
initial_heavy, _ = count_heavy_modules()

print(f"Initial: {initial_memory:.1f}MB, {initial_modules} modules, {initial_heavy} heavy modules")

# All imports from app_base.py in order
app_base_imports = [
    "import logging",
    "import multiprocessing",
    "import os",
    "import time",
    "from typing import Any",
    "from typing import cast",
    "import sentry_sdk",
    "from celery import bootsteps",
    "from celery import Task",
    "from celery.app import trace",
    "from celery.exceptions import WorkerShutdown",
    "from celery.signals import task_postrun",
    "from celery.signals import task_prerun",
    "from celery.states import READY_STATES",
    "from celery.utils.log import get_task_logger",
    "from celery.worker import strategy",
    "from redis.lock import Lock as RedisLock",
    "from sentry_sdk.integrations.celery import CeleryIntegration",
    "from sqlalchemy import text",
    "from sqlalchemy.orm import Session",
    "from onyx.background.celery.apps.task_formatters import CeleryTaskColoredFormatter",
    "from onyx.background.celery.apps.task_formatters import CeleryTaskPlainFormatter",
    "from onyx.background.celery.celery_utils import celery_is_worker_primary",
    "from onyx.background.celery.celery_utils import make_probe_path",
    "from onyx.background.celery.tasks.vespa.document_sync import DOCUMENT_SYNC_PREFIX",
    "from onyx.background.celery.tasks.vespa.document_sync import DOCUMENT_SYNC_TASKSET_KEY",
    "from onyx.configs.constants import ONYX_CLOUD_CELERY_TASK_PREFIX",
    "from onyx.configs.constants import OnyxRedisLocks",
    "from onyx.db.engine.sql_engine import get_sqlalchemy_engine",
    "from onyx.document_index.vespa.shared_utils.utils import wait_for_vespa_with_timeout",
    "from onyx.httpx.httpx_pool import HttpxPool",
    "from onyx.redis.redis_connector import RedisConnector",
    "from onyx.redis.redis_connector_delete import RedisConnectorDelete",
    "from onyx.redis.redis_connector_doc_perm_sync import RedisConnectorPermissionSync",
    "from onyx.redis.redis_connector_ext_group_sync import RedisConnectorExternalGroupSync",
    "from onyx.redis.redis_connector_prune import RedisConnectorPrune",
    "from onyx.redis.redis_document_set import RedisDocumentSet",
    "from onyx.redis.redis_pool import get_redis_client",
    "from onyx.redis.redis_usergroup import RedisUserGroup",
    "from onyx.utils.logger import ColoredFormatter",
    "from onyx.utils.logger import LoggerContextVars",
    "from onyx.utils.logger import PlainFormatter",
    "from onyx.utils.logger import setup_logger",
    "from shared_configs.configs import DEV_LOGGING_ENABLED",
    "from shared_configs.configs import MULTI_TENANT",
    "from shared_configs.configs import POSTGRES_DEFAULT_SCHEMA",
    "from shared_configs.configs import SENTRY_DSN",
    "from shared_configs.configs import TENANT_ID_PREFIX",
    "from shared_configs.contextvars import CURRENT_TENANT_ID_CONTEXTVAR",
]

# Test each import individually
for i, import_stmt in enumerate(app_base_imports):
    before_memory = get_memory_mb()
    before_modules = len(sys.modules)
    before_heavy, _ = count_heavy_modules()

    try:
        exec(import_stmt)

        after_memory = get_memory_mb()
        after_modules = len(sys.modules)
        after_heavy, heavy_list = count_heavy_modules()

        memory_increase = after_memory - before_memory
        module_increase = after_modules - before_modules
        heavy_increase = after_heavy - before_heavy

        if memory_increase > 50 or heavy_increase > 10:
            print(f"\\n🔴 MAJOR PROBLEM: {import_stmt}")
            print(f"   Memory: +{memory_increase:.1f}MB, Modules: +{module_increase}, Heavy: +{heavy_increase}")
            if heavy_increase > 0:
                new_heavy = heavy_list[before_heavy:before_heavy+min(10, heavy_increase)]
                print(f"   New heavy modules: {new_heavy}")
        elif memory_increase > 10 or heavy_increase > 0 or module_increase > 100:
            print(f"\\n🟡 PROBLEM: {import_stmt}")
            print(f"   Memory: +{memory_increase:.1f}MB, Modules: +{module_increase}, Heavy: +{heavy_increase}")
            if heavy_increase > 0:
                new_heavy = heavy_list[before_heavy:before_heavy+min(5, heavy_increase)]
                print(f"   New heavy modules: {new_heavy}")
        elif module_increase > 20:
            print(f"\\n🟢 NOTABLE: {import_stmt}")
            print(f"   Memory: +{memory_increase:.1f}MB, Modules: +{module_increase}, Heavy: +{heavy_increase}")

    except Exception as e:
        print(f"❌ FAILED: {import_stmt} - {str(e)[:100]}")

print(f"\\n=== FINAL APP_BASE STATE ===")
final_memory = get_memory_mb()
final_modules = len(sys.modules)
final_heavy, final_heavy_list = count_heavy_modules()

print(f"Total: {initial_memory:.1f}MB -> {final_memory:.1f}MB (+{final_memory-initial_memory:.1f}MB)")
print(f"Modules: {initial_modules} -> {final_modules} (+{final_modules-initial_modules})")
print(f"Heavy modules: {initial_heavy} -> {final_heavy} (+{final_heavy-initial_heavy})")

if final_heavy > 20:
    print(f"\\nFirst 20 heavy modules loaded:")
    for i, mod in enumerate(sorted(final_heavy_list)[:20]):
        print(f"  {i+1:2d}. {mod}")
    if len(final_heavy_list) > 20:
        print(f"  ... and {len(final_heavy_list) - 20} more")
"""


def main():
    print("ISOLATING APP_BASE.PY HEAVY IMPORT")
    print("=" * 50)
    print("Testing each import in app_base.py to find the heavy ML import culprit")
    print()

    # Get container
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"], capture_output=True, text=True
        )
        containers = [
            name.strip() for name in result.stdout.strip().split("\n") if name.strip()
        ]

        background_containers = [c for c in containers if "background" in c.lower()]
        if not background_containers:
            print("No background container found")
            return

        container_name = background_containers[0]
    except Exception as e:
        print(f"Error finding containers: {e}")
        return

    print(f"Container: {container_name}")
    print("-" * 30)

    isolation_script = create_app_base_isolation_script()

    try:
        result = subprocess.run(
            ["docker", "exec", container_name, "python", "-c", isolation_script],
            capture_output=True,
            text=True,
            timeout=240,
        )

        if result.returncode == 0:
            print(result.stdout)
        else:
            print("App base isolation test failed:")
            print(f"STDERR: {result.stderr}")
            if result.stdout:
                print(f"STDOUT: {result.stdout}")

    except subprocess.TimeoutExpired:
        print("App base isolation test timed out")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
