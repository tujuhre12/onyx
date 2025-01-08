import json
import os

import requests


def query_vespa_schema():
    # Vespa endpoint
    vespa_url = "http://localhost:8081"  # Adjust this if your Vespa instance is running on a different host or port

    # Query the schema
    response = requests.get(f"{vespa_url}/schema")

    if response.status_code == 200:
        schema = response.json()

        # Create a directory for the schema file if it doesn't exist
        os.makedirs("vespa_schema", exist_ok=True)

        # Save the schema to a file
        with open("vespa_schema/vespa_schema.json", "w") as f:
            json.dump(schema, f, indent=2)

        print("Vespa schema has been saved to vespa_schema/vespa_schema.json")
    else:
        print(f"Failed to retrieve Vespa schema. Status code: {response.status_code}")
        print(f"Response: {response.text}")


if __name__ == "__main__":
    query_vespa_schema()
