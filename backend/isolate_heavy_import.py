#!/usr/bin/env python3
"""
Isolate exactly which import in primary.py causes the heavy modules to load.
"""

import subprocess


def create_isolation_script():
    """Create script to test each import individually"""

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

print("=== ISOLATING HEAVY IMPORT SOURCE ===")

initial_memory = get_memory_mb()
initial_modules = len(sys.modules)
initial_heavy, _ = count_heavy_modules()

print(f"Initial: {initial_memory:.1f}MB, {initial_modules} modules, {initial_heavy} heavy modules")

# Test each individual import from primary.py
imports_to_test = [
    "import logging",
    "import os",
    "from typing import Any",
    "from typing import cast",
    "from celery import bootsteps",
    "from celery import Celery",
    "from celery import signals",
    "from celery import Task",
    "from celery.apps.worker import Worker",
    "from celery.exceptions import WorkerShutdown",
    "from celery.result import AsyncResult",
    "from celery.signals import celeryd_init",
    "from celery.signals import worker_init",
    "from celery.signals import worker_ready",
    "from celery.signals import worker_shutdown",
    "from redis.lock import Lock as RedisLock",
    "import onyx.background.celery.apps.app_base as app_base",
    "from onyx.background.celery.apps.app_base import task_logger",
    "from onyx.background.celery.celery_utils import celery_is_worker_primary",
    "from onyx.background.celery.tasks.vespa.document_sync import reset_document_sync",
    "from onyx.configs.constants import CELERY_PRIMARY_WORKER_LOCK_TIMEOUT",
    "from onyx.configs.constants import OnyxRedisConstants",
    "from onyx.configs.constants import OnyxRedisLocks",
    "from onyx.configs.constants import POSTGRES_CELERY_WORKER_PRIMARY_APP_NAME",
    "from onyx.db.engine.sql_engine import get_session_with_current_tenant",
    "from onyx.db.engine.sql_engine import SqlEngine",
    "from onyx.db.index_attempt import get_index_attempt",
    "from onyx.db.index_attempt import mark_attempt_canceled",
    "from onyx.db.indexing_coordination import IndexingCoordination",
    "from onyx.redis.redis_connector_delete import RedisConnectorDelete",
    "from onyx.redis.redis_connector_doc_perm_sync import RedisConnectorPermissionSync",
    "from onyx.redis.redis_connector_ext_group_sync import RedisConnectorExternalGroupSync",
    "from onyx.redis.redis_connector_prune import RedisConnectorPrune",
    "from onyx.redis.redis_connector_stop import RedisConnectorStop",
    "from onyx.redis.redis_document_set import RedisDocumentSet",
    "from onyx.redis.redis_pool import get_redis_client",
    "from onyx.redis.redis_usergroup import RedisUserGroup",
    "from onyx.utils.logger import setup_logger",
]

# Test each import individually
for import_stmt in imports_to_test:
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

        if memory_increase > 5 or heavy_increase > 0 or module_increase > 50:
            print(f"\\n🔴 PROBLEMATIC: {import_stmt}")
            print(f"   Memory: +{memory_increase:.1f}MB, Modules: +{module_increase}, Heavy: +{heavy_increase}")
            if heavy_increase > 0:
                new_heavy = heavy_list[before_heavy:before_heavy+min(5, heavy_increase)]
                print(f"   New heavy modules: {new_heavy}")
        elif module_increase > 10:
            print(f"\\n🟡 MODERATE: {import_stmt}")
            print(f"   Memory: +{memory_increase:.1f}MB, Modules: +{module_increase}, Heavy: +{heavy_increase}")
        elif module_increase > 0:
            print(f"✅ {import_stmt}: +{module_increase} modules")

    except Exception as e:
        print(f"❌ FAILED: {import_stmt} - {e}")

print(f"\\n=== FINAL STATE ===")
final_memory = get_memory_mb()
final_modules = len(sys.modules)
final_heavy, final_heavy_list = count_heavy_modules()

print(f"Total: {initial_memory:.1f}MB -> {final_memory:.1f}MB (+{final_memory-initial_memory:.1f}MB)")
print(f"Modules: {initial_modules} -> {final_modules} (+{final_modules-initial_modules})")
print(f"Heavy modules: {initial_heavy} -> {final_heavy} (+{final_heavy-initial_heavy})")

if final_heavy > 0:
    print(f"\\nHeavy modules loaded:")
    for i, mod in enumerate(sorted(final_heavy_list)[:20]):
        print(f"  {i+1:2d}. {mod}")
    if len(final_heavy_list) > 20:
        print(f"  ... and {len(final_heavy_list) - 20} more")
"""


def main():
    print("ISOLATING HEAVY IMPORT SOURCE")
    print("=" * 50)
    print("Testing each import from primary.py individually to find the culprit")
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

    isolation_script = create_isolation_script()

    try:
        result = subprocess.run(
            ["docker", "exec", container_name, "python", "-c", isolation_script],
            capture_output=True,
            text=True,
            timeout=180,
        )

        if result.returncode == 0:
            print(result.stdout)
        else:
            print("Isolation test failed:")
            print(f"STDERR: {result.stderr}")
            if result.stdout:
                print(f"STDOUT: {result.stdout}")

    except subprocess.TimeoutExpired:
        print("Isolation test timed out")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
