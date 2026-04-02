import type { Client, RequestConfig } from "@kubb/plugin-client/clients/fetch";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError, createAuthorizedClient } from "./index.ts";

// FILE: src/lib/http/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify auth header injection and normalized non-2xx API errors.
//   SCOPE: Authorized client behavior and ApiClientError generation.
//   DEPENDS: vitest, src/lib/http/index.ts
//   LINKS: V-M-HTTP-RUNTIME, M-HTTP-RUNTIME
// END_MODULE_CONTRACT

describe("createAuthorizedClient", () => {
  it("injects Authorization headers into generated client requests", async () => {
    const fetchClientImpl = vi.fn(async <TResponseData, _TError = unknown, TRequestData = unknown>(config: RequestConfig<TRequestData>) => ({
      data: { ok: true } as TResponseData,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
    }));
    const client = createAuthorizedClient("demo-token", { fetchClientImpl: fetchClientImpl as unknown as Client });

    await client({ method: "GET", url: "https://example.com/projects" });

    expect(fetchClientImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          Authorization: "Bearer demo-token",
        },
      }),
    );
  });

  it("adds JSON content type when request data is present", async () => {
    const fetchClientImpl = vi.fn(async <TResponseData, _TError = unknown, TRequestData = unknown>(config: RequestConfig<TRequestData>) => ({
      data: { ok: true } as TResponseData,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
    }));
    const client = createAuthorizedClient("demo-token", { fetchClientImpl: fetchClientImpl as unknown as Client });

    await client({ method: "POST", url: "https://example.com/tasks", data: { title: "demo" } });

    expect(fetchClientImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("throws ApiClientError for non-2xx responses", async () => {
    const fetchClientImpl = vi.fn(async <TResponseData, _TError = unknown, TRequestData = unknown>(config: RequestConfig<TRequestData>) => ({
      data: { message: "unauthorized" } as TResponseData,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers(),
    }));
    const client = createAuthorizedClient("demo-token", { fetchClientImpl: fetchClientImpl as unknown as Client });

    await expect(client({ method: "GET", url: "https://example.com/projects" })).rejects.toBeInstanceOf(ApiClientError);
  });
});
