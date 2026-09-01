import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "@/lib/auth/token-storage";
import type { ApiErrorBody, TokenPair } from "@/types";

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = body.error_code;
    this.details = body.details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  /** Base URL override; defaults to the app_service base URL. */
  baseUrl?: string;
}

// These are same-origin paths, rewritten server-side to the real backend
// URLs by next.config.js's rewrites() -- see that file for why.
const APP_API_URL = "/backend-api/api/v1";
const FALLBACK_API_URL = "https://scamguard-app-service.onrender.com/api/v1";
const API_TIMEOUT_MS = 45000;

let refreshPromise: Promise<TokenPair | null> | null = null;

function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

async function performRefresh(): Promise<TokenPair | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetchWithTimeout(`${APP_API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) {
      clearTokens();
      return null;
    }
    const pair = (await response.json()) as TokenPair;
    setTokens(pair);
    return pair;
  } catch {
    clearTokens();
    return null;
  }
}

/** Ensures only one refresh request is ever in flight at a time, even if
 * several API calls hit a 401 simultaneously.
 */
function refreshOnce(): Promise<TokenPair | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    const data = await response.json();
    if (data && typeof data.message === "string") {
      return data as ApiErrorBody;
    }
    if (data && typeof data.detail === "string") {
      return { error_code: "VALIDATION_ERROR", message: data.detail };
    }
    if (data && Array.isArray(data.detail) && data.detail.length > 0 && typeof data.detail[0].msg === "string") {
      return { error_code: "VALIDATION_ERROR", message: data.detail[0].msg };
    }
    return { error_code: "UNKNOWN_ERROR", message: "An unexpected error occurred." };
  } catch {
    if (response.status >= 500) {
      return {
        error_code: "SERVICE_UNAVAILABLE",
        message: "The backend server is starting up or temporarily busy. Please wait a moment and try again.",
      };
    }
    return { error_code: "UNKNOWN_ERROR", message: `Request failed with status ${response.status}.` };
  }
}

function mapFetchError(error: unknown): never {
  if (error instanceof DOMException && error.name === "AbortError") {
    throw new ApiError(0, {
      error_code: "REQUEST_TIMEOUT",
      message: "The backend server is waking up from standby or taking longer than usual. Please wait a moment and try again.",
    });
  }

  const message = error instanceof Error ? error.message : "Unable to reach the backend. Please try again later.";
  throw new ApiError(0, {
    error_code: "NETWORK_ERROR",
    message,
  });
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, baseUrl = APP_API_URL } = options;

  const doFetch = async (urlBase: string): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (!(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (auth) {
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return fetchWithTimeout(`${urlBase}${path}`, {
      method,
      headers,
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });
  };

  let response: Response | undefined;
  try {
    response = await doFetch(baseUrl);
  } catch (error) {
    if (baseUrl === APP_API_URL && typeof window !== "undefined") {
      try {
        response = await doFetch(FALLBACK_API_URL);
      } catch {
        mapFetchError(error);
      }
    } else {
      mapFetchError(error);
    }
  }

  // Handle gateway timeout (504/502) on Vercel reverse proxy by retrying directly
  if (response && (response.status === 502 || response.status === 504) && baseUrl === APP_API_URL && typeof window !== "undefined") {
    try {
      const directResp = await doFetch(FALLBACK_API_URL);
      if (directResp.ok) {
        response = directResp;
      }
    } catch {
      // Keep existing response
    }
  }

  if (!response) {
    throw new ApiError(0, {
      error_code: "NETWORK_ERROR",
      message: "Unable to connect to ScamGuard backend service. Please try again in a few seconds.",
    });
  }

  if (response.status === 401 && auth && getRefreshToken()) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      response = await doFetch(baseUrl);
    }
  }

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    if (response.status === 401) {
      clearTokens();
    }
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export { APP_API_URL };
