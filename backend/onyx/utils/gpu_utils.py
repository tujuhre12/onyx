import requests
from retry import retry

from onyx.natural_language_processing.search_nlp_models import build_model_server_url
from onyx.utils.logger import setup_logger
from shared_configs.configs import INDEXING_MODEL_SERVER_HOST
from shared_configs.configs import INDEXING_MODEL_SERVER_PORT
from shared_configs.configs import MODEL_SERVER_HOST
from shared_configs.configs import MODEL_SERVER_PORT

logger = setup_logger()


@retry(tries=5, delay=5)
def gpu_status_request(indexing: bool = True) -> bool:
    if indexing:
        host, port = INDEXING_MODEL_SERVER_HOST, INDEXING_MODEL_SERVER_PORT
    else:
        host, port = MODEL_SERVER_HOST, MODEL_SERVER_PORT

    model_server_url = build_model_server_url(host, port)

    try:
        response = requests.get(f"{model_server_url}/api/gpu-status", timeout=10)
        response.raise_for_status()
        gpu_status = response.json()
        return gpu_status["gpu_available"]
    except requests.RequestException as e:
        logger.error(f"Error: Unable to fetch GPU status. Error: {str(e)}")
        raise  # Re-raise exception to trigger a retry
