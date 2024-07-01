from typing import Any

from opensearchpy import OpenSearch

from danswer.configs.app_configs import OPENSEARCH_HOST
from danswer.configs.app_configs import OPENSEARCH_PASSWORD
from danswer.configs.app_configs import OPENSEARCH_PORT
from danswer.configs.app_configs import OPENSEARCH_USER


def get_opensearch_client(
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
def get_schema_settings(shards: int = 1) -> dict[str, Any]:
    schema_settings = {"index": {"number_of_shards": shards, "knn": True}}
    return schema_settings


def get_knn_settings(
    embedding_dim: int, ef_construction: int = 200, m: int = 48
) -> dict[str, Any]:
    # TODO explore hyperparameters
    knn_settings = {
        "type": "knn_vector",
        "dimension": embedding_dim,
        "method": {
            "name": "hnsw",
            "space_type": "cosinesimil",
            "engine": "nmslib",
            "parameters": {"ef_construction": ef_construction, "m": m},
        },
    }
    return knn_settings


def get_chunk_properties(embedding_dim: int) -> dict[str, Any]:
    chunk_properties = {
        "type": "nested",
        "properties": {
            # In Opensearch/Elasticsearch, fields are nullable by default
            "link": {"type": "text", "index": False},
            # Max number of tokens in the chunk, set as a limit for which level of granularity this chunk represents
            "max_num_tokens": {"type": "integer", "index": False},
            # Actual number of tokens in the chunk as determined by the tokenizer
            # This is to prevent repeat counting
            "num_tokens": {"type": "integer", "index": False},
            # Index of the chunk in the document at the given granularity
            # For each granularity (that exists for this doc), there will be an index 0 chunk
            "chunk_index": {"type": "integer", "index": False},
            "content": {"type": "text"},
            "embedding": get_knn_settings(embedding_dim=embedding_dim),
        },
    }
    return chunk_properties


def get_flat_dict_properties() -> dict[str, Any]:
    flat_dict_properties = {
        "type": "nested",
        "properties": {
            # Keywords are used for exact match, it can be a single term or an "array"
            # it's not actually an array but it acts the same
            "key": {"type": "keyword"},
            # To have a list of values, it simply needs to be added to the index multiple times
            # with the same key and different values
            "value": {"type": "keyword"},
        },
    }
    return flat_dict_properties


def get_danswer_opensearch_schema(embedding_dim: int) -> dict[str, Any]:
    full_schema = {
        "settings": get_schema_settings(),
        "mappings": {
            "properties": {
                "document_id": {"type": "keyword"},
                "semantic_identifier": {"type": "text", "index": False},
                "title": {"type": "text"},
                # This is not used for search, all search keywords are stored at the chunk level
                "content": {"type": "text", "index": False},
                "title_vector": get_knn_settings(embedding_dim=embedding_dim),
                "chunks": get_chunk_properties(embedding_dim=embedding_dim),
                "source_type": {"type": "keyword"},
                "document_sets": {"type": "keyword"},
                "access_control_list": {"type": "keyword"},
                "metadata": get_flat_dict_properties(),
                "primary_owners": {"type": "keyword"},
                "secondary_owners": {"type": "keyword"},
                "last_updated": {"type": "date"},
                "boost_count": {"type": "integer", "null_value": 0},
                # Inverted for efficient filtering
                "not_hidden": {"type": "boolean", "null_value": True},
            }
        },
    }
    return full_schema


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
