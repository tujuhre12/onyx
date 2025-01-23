import sys
import time
from datetime import datetime

from onyx.connectors.interfaces import BaseConnector
from onyx.connectors.interfaces import CheckpointConnector
from onyx.connectors.interfaces import CheckpointOutput
from onyx.connectors.interfaces import LoadConnector
from onyx.connectors.interfaces import PollConnector
from onyx.connectors.models import ConnectorCheckpoint
from onyx.utils.logger import setup_logger


logger = setup_logger()


TimeRange = tuple[datetime, datetime]


class ConnectorRunner:
    def __init__(
        self,
        connector: BaseConnector,
        time_range: TimeRange | None = None,
    ):
        self.connector = connector
        self.time_range = time_range

    def run(self, checkpoint: ConnectorCheckpoint) -> CheckpointOutput:
        """Adds additional exception logging to the connector."""
        try:
            if isinstance(self.connector, CheckpointConnector):
                if self.time_range is None:
                    raise ValueError("time_range is required for CheckpointConnector")

                start = time.monotonic()
                for checkpoint_output in self.connector.load_from_checkpoint(
                    start=self.time_range[0].timestamp(),
                    end=self.time_range[1].timestamp(),
                    checkpoint=checkpoint,
                ):
                    yield checkpoint_output

                logger.debug(
                    f"Connector took {time.monotonic() - start} seconds to get to the next checkpoint."
                )
            else:
                finished_checkpoint = ConnectorCheckpoint.build_dummy_checkpoint()
                finished_checkpoint.has_more = False

                if isinstance(self.connector, PollConnector):
                    if self.time_range is None:
                        raise ValueError("time_range is required for PollConnector")

                    for document_batch in self.connector.poll_source(
                        start=self.time_range[0].timestamp(),
                        end=self.time_range[1].timestamp(),
                    ):
                        for document in document_batch:
                            yield (document, finished_checkpoint, None)
                    # needed in the case that the connector returns no documents
                    yield (None, finished_checkpoint, None)
                elif isinstance(self.connector, LoadConnector):
                    for document_batch in self.connector.load_from_state():
                        for document in document_batch:
                            yield (document, finished_checkpoint, None)

                    # needed in the case that the connector returns no documents
                    yield (None, finished_checkpoint, None)
                else:
                    raise ValueError(f"Invalid connector. type: {type(self.connector)}")
        except Exception:
            exc_type, _, exc_traceback = sys.exc_info()

            # Traverse the traceback to find the last frame where the exception was raised
            tb = exc_traceback
            if tb is None:
                logger.error("No traceback found for exception")
                raise

            while tb.tb_next:
                tb = tb.tb_next  # Move to the next frame in the traceback

            # Get the local variables from the frame where the exception occurred
            local_vars = tb.tb_frame.f_locals
            local_vars_str = "\n".join(
                f"{key}: {value}" for key, value in local_vars.items()
            )
            logger.error(
                f"Error in connector. type: {exc_type};\n"
                f"local_vars below -> \n{local_vars_str[:1024]}"
            )
            raise
