# backend/onyx/background/celery/memory_monitoring.py
import logging
import os
import tempfile
from logging.handlers import RotatingFileHandler

import psutil

from onyx.utils.logger import is_running_in_container
from onyx.utils.logger import setup_logger

# Regular application logger
logger = setup_logger()

# Set up a dedicated memory monitoring logger
# Use environment variable with fallback
MEMORY_LOG_BASE_DIR = os.environ.get("MEMORY_LOG_BASE_DIR")
if MEMORY_LOG_BASE_DIR is None:
    # If not specified, follow the pattern used in setup_logger
    MEMORY_LOG_BASE_DIR = (
        "/var/log/persisted-logs" if is_running_in_container() else "./log"
    )

# Create the memory directory path
MEMORY_LOG_DIR = os.path.join(MEMORY_LOG_BASE_DIR, "memory")
MEMORY_LOG_FILE = os.path.join(MEMORY_LOG_DIR, "memory_usage.log")
MEMORY_LOG_MAX_BYTES = 10 * 1024 * 1024  # 10MB
MEMORY_LOG_BACKUP_COUNT = 5  # Keep 5 backup files

# Ensure log directory exists with error handling
try:
    os.makedirs(MEMORY_LOG_DIR, exist_ok=True)
except PermissionError:
    # Fall back to a temporary directory if we can't create the preferred one
    MEMORY_LOG_DIR = os.path.join(tempfile.gettempdir(), "onyx_memory_logs")
    MEMORY_LOG_FILE = os.path.join(MEMORY_LOG_DIR, "memory_usage.log")
    os.makedirs(MEMORY_LOG_DIR, exist_ok=True)
    logger.warning(
        f"Could not create memory log directory at original location. Using {MEMORY_LOG_DIR} instead."
    )

# Create a dedicated logger for memory monitoring
memory_logger = logging.getLogger("memory_monitoring")
memory_logger.setLevel(logging.INFO)

# Create a rotating file handler
memory_handler = RotatingFileHandler(
    MEMORY_LOG_FILE, maxBytes=MEMORY_LOG_MAX_BYTES, backupCount=MEMORY_LOG_BACKUP_COUNT
)

# Create a formatter that includes all relevant information
memory_formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
)
memory_handler.setFormatter(memory_formatter)
memory_logger.addHandler(memory_handler)


def emit_process_memory(
    pid: int, process_name: str, additional_metadata: dict[str, str | int]
) -> None:
    try:
        process = psutil.Process(pid)
        memory_info = process.memory_info()
        cpu_percent = process.cpu_percent(interval=0.1)

        # Build metadata string from additional_metadata dictionary
        metadata_str = " ".join(
            [f"{key}={value}" for key, value in additional_metadata.items()]
        )
        metadata_str = f" {metadata_str}" if metadata_str else ""

        memory_logger.info(
            f"PROCESS_MEMORY process_name={process_name} pid={pid} "
            f"rss_mb={memory_info.rss / (1024 * 1024):.2f} "
            f"vms_mb={memory_info.vms / (1024 * 1024):.2f} "
            f"cpu={cpu_percent:.2f}{metadata_str}"
        )
    except Exception:
        logger.exception("Error monitoring process memory.")
