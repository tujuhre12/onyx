import multiprocessing
import os
import queue
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path

from tests.integration.common_utils.reset import reset_all
from tests.integration.introspection import list_all_tests
from tests.integration.kickoff import BACKEND_DIR_PATH
from tests.integration.kickoff import DeploymentConfig
from tests.integration.kickoff import get_db_name
from tests.integration.kickoff import run_x_instances
from tests.integration.kickoff import SharedServicesConfig


@dataclass
class TestResult:
    test_name: str
    success: bool
    output: str
    error: str | None = None


def run_single_test(
    test_name: str,
    deployment_config: DeploymentConfig,
    shared_services_config: SharedServicesConfig,
    result_queue: multiprocessing.Queue,
) -> None:
    """Run a single test with the given API port."""
    test_path, test_name = test_name.split("::")
    processed_test_name = (
        f"tests/integration/{test_path.replace('.', '/')}.py::{test_name}"
    )
    print(f"Running test: {processed_test_name}")
    try:
        result = subprocess.run(
            ["pytest", processed_test_name, "-v"],
            env={
                **os.environ,
                "API_SERVER_PORT": str(deployment_config.api_port),
                "PYTHONPATH": ".",
                "GUARANTEED_FRESH_SETUP": "true",
                "POSTGRES_PORT": str(shared_services_config.postgres_port),
                "POSTGRES_DB": get_db_name(deployment_config.instance_num),
                "VESPA_PORT": str(shared_services_config.vespa_port),
                "VESPA_TENANT_PORT": str(shared_services_config.vespa_tenant_port),
            },
            cwd=str(BACKEND_DIR_PATH),
            capture_output=True,
            text=True,
        )
        result_queue.put(
            TestResult(
                test_name=test_name,
                success=result.returncode == 0,
                output=result.stdout,
                error=result.stderr if result.returncode != 0 else None,
            )
        )
    except Exception as e:
        result_queue.put(
            TestResult(
                test_name=test_name,
                success=False,
                output="",
                error=str(e),
            )
        )


def worker(
    test_queue: queue.Queue[str | None],
    instance_queue: queue.Queue[int],
    result_queue: multiprocessing.Queue,
    shared_services_config: SharedServicesConfig,
    deployment_configs: list[DeploymentConfig],
) -> None:
    """Worker process that runs tests on available instances."""
    while True:
        # Get the next test from the queue
        test = test_queue.get()
        if test is None:  # Sentinel value indicating no more tests
            test_queue.task_done()
            break

        # Get an available instance
        instance_idx = instance_queue.get()
        deployment_config = deployment_configs[
            instance_idx - 1
        ]  # Convert to 0-based index

        try:
            # Run the test
            run_single_test(
                test, deployment_config, shared_services_config, result_queue
            )
            # get instance ready for next test
            print(
                f"Resetting instance for next. DB: {deployment_config.postgres_db}, "
                f"Port: {shared_services_config.postgres_port}"
            )
            reset_all(
                database=deployment_config.postgres_db,
                postgres_port=str(shared_services_config.postgres_port),
            )
        except Exception as e:
            # Log the error and put it in the result queue
            error_msg = f"Critical error in worker thread for test {test}: {str(e)}"
            print(error_msg, file=sys.stderr)
            result_queue.put(
                TestResult(
                    test_name=test,
                    success=False,
                    output="",
                    error=error_msg,
                )
            )
            # Re-raise to stop the worker
            raise
        finally:
            # Put the instance back in the queue
            instance_queue.put(instance_idx)
            test_queue.task_done()


def main() -> None:
    NUM_INSTANCES = 2

    # Get all tests
    tests = list_all_tests(Path(__file__).parent)
    print(f"Found {len(tests)} tests to run")

    # For debugging
    # tests = [test for test in tests if "openai_assistants_api" in test]
    # tests = tests[:2]
    # print(f"Running {len(tests)} tests")

    # Start all instances at once
    shared_services_config, deployment_configs = run_x_instances(NUM_INSTANCES)

    # Create queues
    test_queue: queue.Queue[str | None] = queue.Queue()
    instance_queue: queue.Queue[int] = queue.Queue()
    result_queue: multiprocessing.Queue = multiprocessing.Queue()

    # Fill the instance queue with available instance numbers
    for i in range(1, NUM_INSTANCES + 1):
        instance_queue.put(i)

    # Fill the test queue with all tests
    for test in tests:
        test_queue.put(test)

    # Add sentinel values to signal workers to exit
    for _ in range(NUM_INSTANCES):
        test_queue.put(None)

    # Start worker threads
    workers = []
    for _ in range(NUM_INSTANCES):
        worker_thread = threading.Thread(
            target=worker,
            args=(
                test_queue,
                instance_queue,
                result_queue,
                shared_services_config,
                deployment_configs,
            ),
        )
        worker_thread.start()
        workers.append(worker_thread)

    # Monitor workers and fail fast if any die
    while any(w.is_alive() for w in workers):
        # Check if all tests are done
        if test_queue.empty() and all(not w.is_alive() for w in workers):
            break

        # Check for dead workers that died with unfinished tests
        if not test_queue.empty() and any(not w.is_alive() for w in workers):
            print(
                "\nCritical: Worker thread(s) died with tests remaining!",
                file=sys.stderr,
            )
            sys.exit(1)

        time.sleep(0.1)  # Avoid busy waiting

    # Collect results
    results: list[TestResult] = []
    while not result_queue.empty():
        results.append(result_queue.get())

    # Print results
    print("\nTest Results:")
    failed = False
    for result in results:
        status = "✅ PASSED" if result.success else "❌ FAILED"
        print(f"{status} - {result.test_name}")
        if not result.success:
            failed = True
            print("Error output:")
            print(result.error)
            print("Test output:")
            print(result.output)
            print("-" * 80)

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
