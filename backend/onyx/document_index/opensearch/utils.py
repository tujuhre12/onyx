from typing import Any

from opensearchpy import OpenSearch

from onyx.configs.app_configs import OPENSEARCH_HOST
from onyx.configs.app_configs import OPENSEARCH_PASSWORD
from onyx.configs.app_configs import OPENSEARCH_PORT
from onyx.configs.app_configs import OPENSEARCH_USER
from onyx.document_index.opensearch.constants import ACCESS_CONTROL_LIST_FIELD
from onyx.document_index.opensearch.constants import CHUNK_EMBEDDING_FIELD
from onyx.document_index.opensearch.constants import CHUNK_ID_FIELD
from onyx.document_index.opensearch.constants import CHUNKS_ABOVE_FIELD
from onyx.document_index.opensearch.constants import CHUNKS_BELOW_FIELD
from onyx.document_index.opensearch.constants import CONTENT_FIELD
from onyx.document_index.opensearch.constants import DOC_UPDATED_AT_FIELD
from onyx.document_index.opensearch.constants import DOCUMENT_ID_FIELD
from onyx.document_index.opensearch.constants import DOCUMENT_SETS_FIELD
from onyx.document_index.opensearch.constants import EF_CONSTRUCTION
from onyx.document_index.opensearch.constants import HIDDEN_FIELD
from onyx.document_index.opensearch.constants import KEY_SUBFIELD
from onyx.document_index.opensearch.constants import LARGE_CHUNK_END_ID_FIELD
from onyx.document_index.opensearch.constants import LARGE_CHUNK_START_ID_FIELD
from onyx.document_index.opensearch.constants import LINK_FIELD
from onyx.document_index.opensearch.constants import M
from onyx.document_index.opensearch.constants import METADATA_FIELD
from onyx.document_index.opensearch.constants import METADATA_SUFFIX_FIELD
from onyx.document_index.opensearch.constants import PRIMARY_OWNERS_FIELD
from onyx.document_index.opensearch.constants import SECONDARY_OWNERS_FIELD
from onyx.document_index.opensearch.constants import SEMANTIC_IDENTIFIER_FIELD
from onyx.document_index.opensearch.constants import SHARDS
from onyx.document_index.opensearch.constants import SOURCE_TYPE_FIELD
from onyx.document_index.opensearch.constants import TITLE_EMBEDDING_FIELD
from onyx.document_index.opensearch.constants import TITLE_FIELD
from onyx.document_index.opensearch.constants import VALUE_SUBFIELD
from onyx.document_index.opensearch.constants import VECTOR_SUBFIELD
from onyx.utils.logger import setup_logger

logger = setup_logger()


def create_opensearch_client(
    host: str = OPENSEARCH_HOST,
    port: str = OPENSEARCH_PORT,
    user: str = OPENSEARCH_USER,
    password: str = OPENSEARCH_PASSWORD,
) -> OpenSearch:
    opensearch_client = OpenSearch(
        hosts=[{"host": host, "port": port}],
        http_auth=(user, password),
        use_ssl=True,
        verify_certs=False,
        ssl_show_warn=False,
    )
    return opensearch_client


#####
# Schema Utils
#####
def get_schema_settings(shards: int = SHARDS) -> dict[str, Any]:
    schema_settings = {"index": {"number_of_shards": shards, "knn": True}}
    return schema_settings


def get_hnsw_config(
    embedding_dim: int, ef_construction: int = EF_CONSTRUCTION, m: int = M
) -> dict[str, Any]:
    hnsw_config = {
        "type": "knn_vector",
        "dimension": embedding_dim,
        "method": {
            "name": "hnsw",
            "space_type": "cosinesimil",
            "engine": "lucene",
            "parameters": {"ef_construction": ef_construction, "m": m},
        },
    }
    return hnsw_config


def get_danswer_opensearch_schema(embedding_dim: int) -> dict[str, Any]:
    full_schema = {
        "settings": get_schema_settings(),
        "mappings": {
            "properties": {
                # Identification Fields
                DOCUMENT_ID_FIELD: {"type": "text"},
                CHUNK_ID_FIELD: {"type": "integer"},
                LARGE_CHUNK_START_ID_FIELD: {"type": "integer"},
                LARGE_CHUNK_END_ID_FIELD: {"type": "integer"},
                # Search Fields
                TITLE_FIELD: {"type": "text"},
                CONTENT_FIELD: {"type": "text"},
                METADATA_SUFFIX_FIELD: {"type": "text"},
                TITLE_EMBEDDING_FIELD: get_hnsw_config(embedding_dim=embedding_dim),
                CHUNK_EMBEDDING_FIELD: {
                    # Only will have multiple for mini chunks, otherwise it will be a list of 1
                    "type": "nested",
                    "properties": {
                        VECTOR_SUBFIELD: get_hnsw_config(embedding_dim=embedding_dim)
                    },
                },
                # Filter Fields
                HIDDEN_FIELD: {"type": "boolean", "null_value": False},
                SOURCE_TYPE_FIELD: {"type": "keyword"},
                DOCUMENT_SETS_FIELD: {"type": "keyword"},
                METADATA_FIELD: {
                    "type": "nested",
                    "properties": {
                        KEY_SUBFIELD: {"type": "keyword"},
                        VALUE_SUBFIELD: {"type": "keyword"},
                    },
                },
                DOC_UPDATED_AT_FIELD: {"type": "date"},
                # ACL
                ACCESS_CONTROL_LIST_FIELD: {"type": "keyword"},
                # Not indexed, for use post-retrieval
                # chunks above/below are stored as extra info on disk so that we can retrieve them for
                # context without running a second query to fetch the context around the current chunk
                # TODO include these actually
                CHUNKS_ABOVE_FIELD: {
                    "type": "text",
                    "index": False,
                    "doc_values": False,
                },
                CHUNKS_BELOW_FIELD: {
                    "type": "text",
                    "index": False,
                    "doc_values": False,
                },
                SEMANTIC_IDENTIFIER_FIELD: {
                    "type": "text",
                    "index": False,
                    "doc_values": False,
                },
                LINK_FIELD: {"type": "text", "index": False, "doc_values": False},
                # All fields are array fields by default
                PRIMARY_OWNERS_FIELD: {
                    "type": "keyword",
                    "index": False,
                    "doc_values": False,
                },
                SECONDARY_OWNERS_FIELD: {
                    "type": "keyword",
                    "index": False,
                    "doc_values": False,
                },
            }
        },
    }
    return full_schema


def create_index(index_name: str, embedding_dim: int) -> None:
    logger.info(f"Creating index {index_name} with embedding dimension {embedding_dim}")
    opensearch_client = create_opensearch_client()
    opensearch_client.indices.create(
        index=index_name,
        body=get_danswer_opensearch_schema(embedding_dim=embedding_dim),
    )


#####
# Query Utils
#####
def get_normalization_search_pipeline_settings(
    keyword_weighting: float = 0.4,
    title_vector_boost_weighting: float = 0.1,
    chunk_vector_weighting: float = 0.5,
) -> dict[str, Any]:
    # TODO: Explore hyperparameters
    # Note: The expectation is that the Keyword component encompases both the Title and the Chunk texts
    # additionally that the Title field is upweighted already by the time it hits this step
    # The title is also expected to be included in the chunk text for the vectorizing so the extra title
    # boost is ADDITIONAL
    pipeline_settings = {
        "description": "Normalization for keyword and vector scores",
        "phase_results_processors": [
            {
                "normalization-processor": {
                    "normalization": {"technique": "min_max"},
                    "combination": {
                        "technique": "arithmetic_mean",
                        "parameters": {
                            "weights": [
                                keyword_weighting,
                                title_vector_boost_weighting,
                                chunk_vector_weighting,
                            ]
                        },
                    },
                }
            }
        ],
    }
    return pipeline_settings


def get_query_base(max_num_results: int) -> dict[str, Any]:
    query_base = {
        "size": max_num_results,
        "query": {"bool": {"must": [], "filter": []}},
    }
    return query_base


def get_not_hidden_filter() -> dict[str, Any]:
    not_hidden_filter = {"term": {"not_hidden": True}}
    return not_hidden_filter
