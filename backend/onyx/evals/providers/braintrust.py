from collections.abc import Callable

from braintrust import Eval
from braintrust import init_dataset

from onyx.configs.app_configs import BRAINTRUST_PROJECT
from onyx.evals.models import EvalationAck
from onyx.evals.models import EvalConfigurationOptions
from onyx.evals.models import EvalProvider


class BraintrustEvalProvider(EvalProvider):
    def eval(
        self,
        task: Callable[[dict[str, str]], str],
        configuration: EvalConfigurationOptions,
        data: list[dict[str, str]] | None = None,
        remote_dataset_name: str | None = None,
    ) -> EvalationAck:
        if data is not None and remote_dataset_name is not None:
            raise ValueError("Cannot specify both data and remote_dataset_name")

        if data is None and remote_dataset_name is None:
            raise ValueError("Must specify either data or remote_dataset_name")

        if remote_dataset_name is not None:
            eval_data = init_dataset(
                project=BRAINTRUST_PROJECT, name=remote_dataset_name
            )
            Eval(
                name=BRAINTRUST_PROJECT,
                data=eval_data,
                task=task,
                scores=[],
                metadata={**configuration.model_dump()},
                max_concurrency=1,
            )
        else:
            Eval(
                name=BRAINTRUST_PROJECT,
                data=lambda: data,
                task=task,
                scores=[],
                metadata={**configuration.model_dump()},
                max_concurrency=1,
            )
        return EvalationAck(success=True)
