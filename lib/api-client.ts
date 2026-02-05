/**
 * Type-safe API client for frontend
 */

interface ApiClientConfig {
  baseUrl?: string;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiError extends Error {
  status: number;
  data?: unknown;
}

function createApiError(message: string, status: number, data?: unknown): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.data = data;
  return error;
}

export function createApiClient(config: ApiClientConfig = {}) {
  const { baseUrl = "" } = config;

  async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      ...headers,
    };

    if (body) {
      requestHeaders["Content-Type"] = "application/json";
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw createApiError(
        data?.error || `Request failed: ${response.statusText}`,
        response.status,
        data
      );
    }

    return data as T;
  }

  return {
    get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),

    post: <T>(endpoint: string, body?: unknown) =>
      request<T>(endpoint, { method: "POST", body }),

    put: <T>(endpoint: string, body?: unknown) =>
      request<T>(endpoint, { method: "PUT", body }),

    delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
  };
}

// Default API client instance
export const apiClient = createApiClient();
