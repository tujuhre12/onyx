import concurrent.futures
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


def run_with_timeout(task: Callable[[], T], timeout: int) -> T:
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(task)
        try:
            # Wait at most 5 seconds for the function to complete
            result = future.result(timeout=timeout)
            return result
        except concurrent.futures.TimeoutError:
            raise TimeoutError(f"Function timed out after {timeout} seconds")
