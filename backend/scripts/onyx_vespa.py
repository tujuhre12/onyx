"""
Vespa Debugging Tool!

Usage:
  python vespa_debug_tool.py --action <action> [options]

Actions:
  config      : Print Vespa configuration
  connect     : Check Vespa connectivity
  list_docs   : List documents
  search      : Search documents
  update      : Update a document
  delete      : Delete a document
  get_acls    : Get document ACLs

Options:
  --tenant-id     : Tenant ID
  --connector-id  : Connector ID
  --n             : Number of documents (default 10)
  --query         : Search query
  --doc-id        : Document ID
  --fields        : Fields to update (JSON)

Example: (gets docs for a given tenant id and connector id)
  python vespa_debug_tool.py --action list_docs --tenant-id my_tenant --connector-id 1 --n 5
"""
import argparse
import json
import os
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from typing import Any
from typing import Dict
from typing import List
from typing import Optional

from onyx.configs.constants import INDEX_SEPARATOR
from onyx.context.search.models import IndexFilters
from onyx.context.search.models import SearchRequest
from onyx.db.connector_credential_pair import get_connector_credential_pair_from_id
from onyx.db.engine import get_session_with_tenant
from onyx.db.search_settings import get_current_search_settings
from onyx.document_index.vespa.shared_utils.utils import get_vespa_http_client
from onyx.document_index.vespa_constants import ACCESS_CONTROL_LIST
from onyx.document_index.vespa_constants import DOC_UPDATED_AT
from onyx.document_index.vespa_constants import DOCUMENT_ID_ENDPOINT
from onyx.document_index.vespa_constants import DOCUMENT_SETS
from onyx.document_index.vespa_constants import HIDDEN
from onyx.document_index.vespa_constants import METADATA_LIST
from onyx.document_index.vespa_constants import SEARCH_ENDPOINT
from onyx.document_index.vespa_constants import SOURCE_TYPE
from onyx.document_index.vespa_constants import TENANT_ID
from onyx.document_index.vespa_constants import VESPA_APP_CONTAINER_URL
from onyx.document_index.vespa_constants import VESPA_APPLICATION_ENDPOINT
from onyx.utils.logger import setup_logger
from shared_configs.configs import MULTI_TENANT

logger = setup_logger()


def build_vespa_filters(
    filters: IndexFilters,
    *,
    include_hidden: bool = False,
    remove_trailing_and: bool = False,
) -> str:
    def _build_or_filters(key: str, vals: list[str] | None) -> str:
        if vals is None:
            return ""

        valid_vals = [val for val in vals if val]
        if not key or not valid_vals:
            return ""

        eq_elems = [f'{key} contains "{elem}"' for elem in valid_vals]
        or_clause = " or ".join(eq_elems)
        return f"({or_clause})"

    def _build_time_filter(
        cutoff: datetime | None,
        # Slightly over 3 Months, approximately 1 fiscal quarter
        untimed_doc_cutoff: timedelta = timedelta(days=92),
    ) -> str:
        if not cutoff:
            return ""

        include_untimed = datetime.now(timezone.utc) - untimed_doc_cutoff > cutoff
        cutoff_secs = int(cutoff.timestamp())

        if include_untimed:
            return f"!({DOC_UPDATED_AT} < {cutoff_secs})"
        return f"({DOC_UPDATED_AT} >= {cutoff_secs})"

    filter_str = ""
    if not include_hidden:
        filter_str += f"AND !({HIDDEN}=true) "

    if filters.tenant_id and MULTI_TENANT:
        filter_str += f'AND ({TENANT_ID} contains "{filters.tenant_id}") '

    if filters.access_control_list is not None:
        acl_str = _build_or_filters(ACCESS_CONTROL_LIST, filters.access_control_list)
        if acl_str:
            filter_str += f"AND {acl_str} "

    source_strs = (
        [s.value for s in filters.source_type] if filters.source_type else None
    )
    source_str = _build_or_filters(SOURCE_TYPE, source_strs)
    if source_str:
        filter_str += f"AND {source_str} "

    tag_attributes = None
    tags = filters.tags
    if tags:
        tag_attributes = [tag.tag_key + INDEX_SEPARATOR + tag.tag_value for tag in tags]
    tag_str = _build_or_filters(METADATA_LIST, tag_attributes)
    if tag_str:
        filter_str += f"AND {tag_str} "

    doc_set_str = _build_or_filters(DOCUMENT_SETS, filters.document_set)
    if doc_set_str:
        filter_str += f"AND {doc_set_str} "

    time_filter = _build_time_filter(filters.time_cutoff)
    if time_filter:
        filter_str += f"AND {time_filter} "

    if remove_trailing_and:
        while filter_str.endswith(" and "):
            filter_str = filter_str[:-5]
        while filter_str.endswith("AND "):
            filter_str = filter_str[:-4]

    return filter_str.strip()


# Set MULTI_TENANT environment variable
os.environ["MULTI_TENANT"] = "True"


# Print Vespa configuration URLs
def print_vespa_config() -> None:
    print(f"Vespa Application Endpoint: {VESPA_APPLICATION_ENDPOINT}")
    print(f"Vespa App Container URL: {VESPA_APP_CONTAINER_URL}")
    print(f"Vespa Search Endpoint: {SEARCH_ENDPOINT}")
    print(f"Vespa Document ID Endpoint: {DOCUMENT_ID_ENDPOINT}")


# Check connectivity to Vespa endpoints
def check_vespa_connectivity() -> None:
    endpoints = [
        f"{VESPA_APPLICATION_ENDPOINT}/ApplicationStatus",
        f"{VESPA_APPLICATION_ENDPOINT}/tenant",
        f"{VESPA_APPLICATION_ENDPOINT}/tenant/default/application/",
        f"{VESPA_APPLICATION_ENDPOINT}/tenant/default/application/default",
    ]

    for endpoint in endpoints:
        try:
            with get_vespa_http_client() as client:
                response = client.get(endpoint)
                print(f"Successfully connected to Vespa at {endpoint}")
                print(f"Status code: {response.status_code}")
                print(f"Response: {response.text[:200]}...")
        except Exception as e:
            print(f"Failed to connect to Vespa at {endpoint}: {str(e)}")

    print("Vespa connectivity check completed.")


# Get info about the default Vespa application
def get_vespa_info() -> Dict[str, Any]:
    url = f"{VESPA_APPLICATION_ENDPOINT}/tenant/default/application/default"
    with get_vespa_http_client() as client:
        response = client.get(url)
        response.raise_for_status()
        return response.json()


# Get index name for a tenant and connector pair
def get_index_name(tenant_id: str, connector_id: int) -> str:
    with get_session_with_tenant(tenant_id=tenant_id) as db_session:
        cc_pair = get_connector_credential_pair_from_id(db_session, connector_id)
        if not cc_pair:
            raise ValueError(f"No connector found for id {connector_id}")
        search_settings = get_current_search_settings(db_session)
        return search_settings.index_name if search_settings else "public"


# Perform a Vespa query using YQL syntax
def query_vespa(
    yql: str, tenant_id: Optional[str] = None, limit: int = 10
) -> List[Dict[str, Any]]:
    filters = IndexFilters(tenant_id=tenant_id, access_control_list=[])
    filter_string = build_vespa_filters(filters, remove_trailing_and=True)

    # 1) Start with your original YQL (which already has `WHERE something`)
    # 2) Append the filter string (which starts with AND)
    # 3) Finally append "limit X"
    # Example final: "select ... where true AND tenant_id='abc' AND !(hidden=true) limit 5"
    full_yql = yql.strip()
    if filter_string:
        full_yql = f"{full_yql} {filter_string}"
    full_yql = f"{full_yql} limit {limit}"

    params = {
        "yql": full_yql,
        "timeout": "10s",
    }

    # The rest can stay the same
    search_request = SearchRequest(query="", filters=filters, limit=limit, offset=0)
    params.update(search_request.model_dump())

    print("FILTERS")
    print(filters)
    print("Vespa request parameters:")
    print(json.dumps(params, indent=2))

    with get_vespa_http_client() as client:
        response = client.get(SEARCH_ENDPOINT, params=params)
        response.raise_for_status()
        result = response.json()
        return result.get("root", {}).get("children", [])


# Get first N documents
def get_first_n_documents(n: int = 10) -> List[Dict[str, Any]]:
    yql = "select * from sources * where true"
    return query_vespa(yql, limit=n)


# Pretty-print a list of documents
def print_documents(documents: List[Dict[str, Any]]) -> None:
    for doc in documents:
        print(json.dumps(doc, indent=2))
        print("-" * 80)


# Get and print documents for a specific tenant and connector
def get_documents_for_tenant_connector(
    tenant_id: str, connector_id: int, n: int = 10
) -> None:
    index_name = get_index_name(tenant_id, connector_id)
    yql = f"select * from sources {index_name} where true"
    documents = query_vespa(yql, tenant_id, limit=n)
    print(
        f"First {len(documents)} documents for tenant {tenant_id}, connector {connector_id}:"
    )
    print_documents(documents)


# Search documents for a specific tenant and connector
def search_documents(
    tenant_id: str, connector_id: int, query: str, n: int = 10
) -> None:
    index_name = get_index_name(tenant_id, connector_id)
    yql = f"select * from sources {index_name} where userInput(@query)"
    documents = query_vespa(yql, tenant_id, limit=n)
    print(f"Search results for query '{query}' in tenant {tenant_id}:")
    print_documents(documents)


# Update a specific document
def update_document(
    tenant_id: str, connector_id: int, doc_id: str, fields: Dict[str, Any]
) -> None:
    index_name = get_index_name(tenant_id, connector_id)
    url = DOCUMENT_ID_ENDPOINT.format(index_name=index_name) + f"/{doc_id}"
    update_request = {"fields": {k: {"assign": v} for k, v in fields.items()}}

    with get_vespa_http_client() as client:
        response = client.put(url, json=update_request)
        response.raise_for_status()
        print(f"Document {doc_id} updated successfully")


# Delete a specific document
def delete_document(tenant_id: str, connector_id: int, doc_id: str) -> None:
    index_name = get_index_name(tenant_id, connector_id)
    url = DOCUMENT_ID_ENDPOINT.format(index_name=index_name) + f"/{doc_id}"

    with get_vespa_http_client() as client:
        response = client.delete(url)
        response.raise_for_status()
        print(f"Document {doc_id} deleted successfully")


# List documents from any source
def list_documents(n: int = 10, tenant_id: Optional[str] = None):
    yql = "select * from sources * where true"
    if tenant_id:
        yql += f" and tenant_id contains '{tenant_id}'"
    print(f"Base YQL Query: {yql}")

    # Let 'query_vespa' handle appending the "limit n" properly
    documents = query_vespa(yql, tenant_id=tenant_id, limit=n)
    print(f"Total documents found: {len(documents)}")
    print(f"First {min(n, len(documents))} documents:")
    for doc in documents[:n]:
        print(json.dumps(doc, indent=2))
        print("-" * 80)


# Get and print ACLs for documents of a specific tenant and connector
def get_document_acls(tenant_id: str, connector_id: int, n: int = 10) -> None:
    index_name = get_index_name(tenant_id, connector_id)
    yql = f"select tenant_id, documentid, access_control_list from sources {index_name} where true"
    documents = query_vespa(yql, tenant_id, limit=n)
    print(
        f"ACLs for {len(documents)} documents from tenant {tenant_id}, connector {connector_id}:"
    )
    for doc in documents:
        print(f"Document ID: {doc['fields']['documentid']}")
        print(
            f"ACL: {json.dumps(doc['fields'].get('access_control_list', {}), indent=2)}"
        )
        print(f"Tenant ID: {doc['fields']['tenant_id']}")
        print("-" * 80)


def main() -> None:
    parser = argparse.ArgumentParser(description="Vespa debugging tool")
    parser.add_argument(
        "--action",
        choices=[
            "config",
            "connect",
            "list_docs",
            "search",
            "update",
            "delete",
            "get_acls",
        ],
        required=True,
        help="Action to perform",
    )
    parser.add_argument(
        "--tenant-id", help="Tenant ID (for update, delete, and get_acls actions)"
    )
    parser.add_argument(
        "--connector-id",
        type=int,
        help="Connector ID (for update, delete, and get_acls actions)",
    )
    parser.add_argument(
        "--n",
        type=int,
        default=10,
        help="Number of documents to retrieve (for list_docs, search, update, and get_acls actions)",
    )
    parser.add_argument("--query", help="Search query (for search action)")
    parser.add_argument("--doc-id", help="Document ID (for update and delete actions)")
    parser.add_argument(
        "--fields", help="Fields to update, in JSON format (for update action)"
    )

    args = parser.parse_args()

    if args.action == "config":
        print_vespa_config()
    elif args.action == "connect":
        check_vespa_connectivity()
    elif args.action == "list_docs":
        list_documents(args.n, args.tenant_id)
    elif args.action == "search":
        if not args.query:
            parser.error("--query is required for search action")
        search_documents(args.tenant_id, args.connector_id, args.query, args.n)
    elif args.action == "update":
        if not args.doc_id or not args.fields:
            parser.error("--doc-id and --fields are required for update action")
        fields = json.loads(args.fields)
        update_document(args.tenant_id, args.connector_id, args.doc_id, fields)
    elif args.action == "delete":
        if not args.doc_id:
            parser.error("--doc-id is required for delete action")
        delete_document(args.tenant_id, args.connector_id, args.doc_id)
    elif args.action == "get_acls":
        if not args.tenant_id or args.connector_id is None:
            parser.error(
                "--tenant-id and --connector-id are required for get_acls action"
            )
        get_document_acls(args.tenant_id, args.connector_id, args.n)


if __name__ == "__main__":
    main()
