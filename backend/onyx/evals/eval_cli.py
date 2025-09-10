#!/usr/bin/env python3
"""
CLI for running evaluations with local configurations.
"""

import argparse
import json
import os
from typing import Any

from braintrust import init_dataset
from braintrust.logger import Dataset

from onyx.configs.app_configs import POSTGRES_API_SERVER_POOL_OVERFLOW
from onyx.configs.app_configs import POSTGRES_API_SERVER_POOL_SIZE
from onyx.configs.constants import POSTGRES_WEB_APP_NAME
from onyx.db.engine.sql_engine import SqlEngine
from onyx.evals.eval import eval


def setup_session_factory():
    SqlEngine.set_app_name(POSTGRES_WEB_APP_NAME)
    SqlEngine.init_engine(
        pool_size=POSTGRES_API_SERVER_POOL_SIZE,
        max_overflow=POSTGRES_API_SERVER_POOL_OVERFLOW,
    )


def load_data(
    local_data_path: str | None, remote_dataset_name: str | None
) -> Dataset | list[Any]:
    """
    Load data from either a local JSON file or remote Braintrust dataset.

    Args:
        local_data_path: Path to local JSON file
        remote_dataset_name: Name of remote Braintrust dataset

    Returns:
        List of test data for evaluation

    Raises:
        ValueError: If neither argument is provided or if provided path doesn't exist
    """
    if local_data_path and remote_dataset_name:
        raise ValueError("Cannot specify both local_data_path and remote_dataset_name")

    if remote_dataset_name:
        return init_dataset(remote_dataset_name)

    if local_data_path is None:
        local_data_path = "evals/data/data.json"

    if not os.path.isfile(local_data_path):
        raise ValueError(f"Local data file does not exist: {local_data_path}")
    with open(local_data_path, "r") as f:
        return json.load(f)


def run_local(
    local_data_path: str | None,
    remote_dataset_name: str | None,
    braintrust_project: str | None = None,
) -> float:
    """
    Run evaluation with local configurations.

    Args:
        local_data_path: Path to local JSON file
        remote_dataset_name: Name of remote Braintrust dataset
        braintrust_project: Optional Braintrust project name. If not provided,
                          will use BRAINTRUST_PROJECT environment variable.

    Returns:
        Evaluation score
    """
    setup_session_factory()

    if not braintrust_project:
        braintrust_project = os.environ["BRAINTRUST_PROJECT"]

    # data = load_data(local_data_path, remote_dataset_name)

    score = eval([])

    return score


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Run evaluations with local configurations"
    )

    parser.add_argument(
        "--local-data-path",
        type=str,
        help="Path to local JSON file containing test data",
    )

    parser.add_argument(
        "--remote-dataset-name", type=str, help="Name of remote Braintrust dataset"
    )

    parser.add_argument(
        "--braintrust-project",
        type=str,
        help="Braintrust project name (overrides BRAINTRUST_PROJECT env var)",
    )

    parser.add_argument("--verbose", action="store_true", help="Enable verbose output")

    args = parser.parse_args()

    if args.local_data_path:
        print(f"Loading data from local file: {args.local_data_path}")
    elif args.remote_dataset_name:
        print(f"Loading data from remote dataset: {args.remote_dataset_name}")

    if args.braintrust_project:
        print(f"Using Braintrust project: {args.braintrust_project}")
    else:
        print(
            f"Using Braintrust project from env: {os.environ.get('BRAINTRUST_PROJECT', 'Not set')}"
        )

    run_local(args.local_data_path, args.remote_dataset_name, args.braintrust_project)


if __name__ == "__main__":
    main()
