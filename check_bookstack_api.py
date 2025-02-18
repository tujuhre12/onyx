import requests


def check_bookstack_api(base_url, token_id, token_secret):
    # Construct the API endpoint URL
    api_url = f"{base_url.rstrip('/')}/api/books"

    # Set up the headers with the API credentials
    headers = {
        "Authorization": f"Token {token_id}:{token_secret}",
        "Accept": "application/json",
    }

    try:
        # Make a GET request to the API
        response = requests.get(api_url, headers=headers)

        # Check the response status code
        if response.status_code == 200:
            print("API key is valid and not expired.")
            return True
        elif response.status_code == 401:
            print("API key is invalid or has expired.")
            return False
        else:
            print(f"Unexpected response. Status code: {response.status_code}")
            print(f"Response content: {response.text}")
            return False

    except requests.RequestException as e:
        print(f"An error occurred while making the request: {e}")
        return False


if __name__ == "__main__":
    base_url = "https://kb.yuma1.com"
    token_id = "MK4OgjOLEEhvHQf0cEwjYr1kVSYZoGa7"
    token_secret = "kV6a8dnHOwAzAjL22jTMJHDhxWhqkeSw"

    check_bookstack_api(base_url, token_id, token_secret)
