// FILE: src/lib/http/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Wrap generated Kubb fetch clients with auth header injection and normalized API errors.
//   SCOPE: Authorized client creation, header normalization, and non-2xx error mapping.
//   DEPENDS: @kubb/plugin-client/clients/fetch, src/lib/auth/index.ts
//   LINKS: M-HTTP-RUNTIME, M-API-CLIENT, M-AUTH-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   ApiClientError - Error class for normalized non-2xx API responses.
//   createAuthorizedClient - Create a generated-client-compatible authorized HTTP client.
//   isApiClientError - Type guard for normalized API errors.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added auth-aware generated client wrappers with normalized API errors.]
// END_CHANGE_SUMMARY

import fetchClient from "@kubb/plugin-client/clients/fetch";
import type { Client, RequestConfig } from "@kubb/plugin-client/clients/fetch";

import { buildAuthHeaders } from "../auth/index.ts";

export class ApiClientError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly method: string | undefined;
  readonly url: string | undefined;
  readonly data: unknown;

  constructor(options: {
    status: number;
    statusText: string;
    method: string | undefined;
    url: string | undefined;
    data: unknown;
  }) {
    super(`Request failed with ${options.status} ${options.statusText} for ${options.method ?? "GET"} ${options.url ?? "unknown-url"}`);
    this.name = "ApiClientError";
    this.status = options.status;
    this.statusText = options.statusText;
    this.method = options.method;
    this.url = options.url;
    this.data = options.data;
  }
}

type HttpRuntimeOptions = {
  fetchClientImpl?: Client;
};

function normalizeHeaders(headers: RequestConfig["headers"]): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers;
}

// START_CONTRACT: isApiClientError
//   PURPOSE: Detect normalized API client errors raised by the authorized wrapper.
//   INPUTS: { error: unknown - Thrown error candidate. }
//   OUTPUTS: { boolean - Whether the error is a normalized ApiClientError. }
//   SIDE_EFFECTS: none
//   LINKS: M-HTTP-RUNTIME
// END_CONTRACT: isApiClientError
export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

// START_CONTRACT: createAuthorizedClient
//   PURPOSE: Create a generated-client-compatible wrapper that injects auth headers and throws on non-2xx responses.
//   INPUTS: { token: string - Active auth token. options: HttpRuntimeOptions | undefined - Optional fetch client override for tests. }
//   OUTPUTS: { Client - Authorized client wrapper compatible with generated Kubb functions. }
//   SIDE_EFFECTS: Performs outbound HTTP requests when invoked.
//   LINKS: M-HTTP-RUNTIME, M-PROJECT-COMMANDS-READ
// END_CONTRACT: createAuthorizedClient
export function createAuthorizedClient(token: string, options: HttpRuntimeOptions = {}): Client {
  const request = options.fetchClientImpl ?? fetchClient;

  // START_BLOCK_EXECUTE_HTTP_REQUEST
  return async <TResponseData, _TError = unknown, TRequestData = unknown>(config: RequestConfig<TRequestData>) => {
    const response = await request<TResponseData, _TError, TRequestData>({
      ...config,
      headers: {
        ...normalizeHeaders(config.headers),
        ...buildAuthHeaders(token),
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new ApiClientError({
        status: response.status,
        statusText: response.statusText || "UNKNOWN_STATUS",
        method: config.method,
        url: config.url,
        data: response.data,
      });
    }

    return response;
  };
  // END_BLOCK_EXECUTE_HTTP_REQUEST
}
