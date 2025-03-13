export class FetchError extends Error {
  status: number;
  info: any;
  constructor(message: string, status: number, info: any) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

export class RedirectError extends FetchError {
  constructor(message: string, status: number, info: any) {
    super(message, status, info);
  }
}

const DEFAULT_AUTH_ERROR_MSG =
  "An error occurred while fetching the data, related to the user's authentication status.";

const DEFAULT_ERROR_MSG = "An error occurred while fetching the data.";

// Keep track of token refresh attempts to prevent infinite loops
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Function to refresh the auth token
const refreshAuthToken = async (): Promise<boolean> => {
  if (isRefreshing) {
    // If already refreshing, return the existing promise
    console.debug(
      "Token refresh already in progress, reusing existing promise"
    );
    return refreshPromise || Promise.resolve(false);
  }

  console.debug("Starting token refresh due to 401 response");
  isRefreshing = true;
  refreshPromise = new Promise<boolean>(async (resolve) => {
    try {
      console.debug("Calling /api/auth/refresh endpoint");
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      const success = response.ok;
      if (success) {
        console.debug("Token refresh succeeded");
      } else {
        console.warn(`Token refresh failed with status: ${response.status}`);
      }
      resolve(success);
    } catch (error) {
      console.error("Error during token refresh:", error);
      resolve(false);
    } finally {
      console.debug("Token refresh attempt completed");
      isRefreshing = false;
      refreshPromise = null;
    }
  });

  return refreshPromise;
};

export const errorHandlingFetcher = async <T>(url: string): Promise<T> => {
  const performFetch = async (retried = false): Promise<T> => {
    const res = await fetch(url);

    // If unauthorized and not already retried, attempt to refresh token
    if (res.status === 401 && !retried) {
      console.debug(
        `401 Unauthorized received for ${url}, attempting token refresh`
      );
      // Try to refresh the token
      const refreshSucceeded = await refreshAuthToken();

      if (refreshSucceeded) {
        console.debug(`Token refresh succeeded, retrying request to ${url}`);
        // If token refresh succeeded, retry the original request
        return performFetch(true); // Retry with retried flag set to true
      }

      console.debug(`Token refresh failed, cannot retry request to ${url}`);
      // If refresh failed, proceed with error handling as usual
      const error = new FetchError(
        DEFAULT_AUTH_ERROR_MSG,
        res.status,
        await res.json().catch(() => ({}))
      );
      throw error;
    }

    if (res.status === 403) {
      const redirect = new RedirectError(
        DEFAULT_AUTH_ERROR_MSG,
        res.status,
        await res.json().catch(() => ({}))
      );
      throw redirect;
    }

    if (!res.ok) {
      const error = new FetchError(
        DEFAULT_ERROR_MSG,
        res.status,
        await res.json().catch(() => ({}))
      );
      throw error;
    }

    return res.json();
  };

  return performFetch();
};
