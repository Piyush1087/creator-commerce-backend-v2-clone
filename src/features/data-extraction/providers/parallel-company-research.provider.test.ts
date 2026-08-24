import type { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ParallelSearchClient,
  ParallelSearchError,
} from "../../brand-onboarding/integrations/parallel/parallel-search.client";
import { ParallelCompanyResearchProvider } from "./parallel-company-research.provider";

function config(values: Record<string, unknown> = {}): ConfigService {
  return {
    get: vi.fn((key: string, defaultValue: unknown) =>
      key in values ? values[key] : defaultValue,
    ),
  } as unknown as ConfigService;
}

function validResponse() {
  return {
    search_id: "search-1",
    session_id: "session-1",
    results: [
      {
        url: "https://example.org/source",
        title: "Traceable source",
        publish_date: "2026-01-01",
        excerpts: ["Public excerpt"],
      },
    ],
  };
}

function execute(provider: ParallelCompanyResearchProvider) {
  return provider.execute({
    acquisitionRunId: "parallel-test-run",
    objective: "Find harmless public company information.",
    searchQueries: ["Example company public profile"],
  });
}

describe("ParallelCompanyResearchProvider", () => {
  const searchOrThrow = vi.fn();
  const searchClient = { searchOrThrow } as unknown as ParallelSearchClient;

  beforeEach(() => {
    searchOrThrow.mockReset();
  });

  it("returns CONFIGURATION_ERROR without invoking Parallel when the credential is missing", async () => {
    const provider = new ParallelCompanyResearchProvider(
      config(),
      searchClient,
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "CONFIGURATION_ERROR", attemptCount: 0 },
    });
    expect(searchOrThrow).not.toHaveBeenCalled();
  });

  it.each([408, 429, 503])(
    "retries HTTP %s and returns the successful result",
    async (status) => {
      searchOrThrow
        .mockRejectedValueOnce(
          new ParallelSearchError("transient failure", status, 0),
        )
        .mockResolvedValue(validResponse());
      const provider = new ParallelCompanyResearchProvider(
        config({
          PARALLEL_API_KEY: "test-key",
          DATA_EXTRACTION_PROVIDER_MAX_ATTEMPTS: 2,
        }),
        searchClient,
      );

      const result = await execute(provider);

      expect(result.telemetry.attemptCount).toBe(2);
      expect(result.provenance).toEqual([
        expect.objectContaining({
          type: "PUBLIC_WEB_RESEARCH",
          sourceUrl: "https://example.org/source",
          title: "Traceable source",
        }),
      ]);
      expect(result.payload.results[0]?.excerpts).toEqual(["Public excerpt"]);
      expect(searchOrThrow).toHaveBeenCalledTimes(2);
    },
  );

  it("does not retry authentication failures", async () => {
    searchOrThrow.mockRejectedValue(
      new ParallelSearchError("unauthorized", 401),
    );
    const provider = new ParallelCompanyResearchProvider(
      config({ PARALLEL_API_KEY: "test-key" }),
      searchClient,
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "AUTHENTICATION_FAILED", attemptCount: 1 },
    });
    expect(searchOrThrow).toHaveBeenCalledTimes(1);
  });

  it("returns final RATE_LIMITED after bounded attempts are exhausted", async () => {
    searchOrThrow.mockRejectedValue(
      new ParallelSearchError("rate limited", 429, 0),
    );
    const provider = new ParallelCompanyResearchProvider(
      config({
        PARALLEL_API_KEY: "test-key",
        DATA_EXTRACTION_PROVIDER_MAX_ATTEMPTS: 2,
      }),
      searchClient,
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: {
        code: "RATE_LIMITED",
        attemptCount: 2,
        providerStatusCode: 429,
        retryAfterMs: 0,
      },
    });
    expect(searchOrThrow).toHaveBeenCalledTimes(2);
  });

  it("normalizes timeout exhaustion as REQUEST_TIMEOUT within Parallel", async () => {
    searchOrThrow.mockRejectedValue(
      new ParallelSearchError("Parallel search timed out"),
    );
    const provider = new ParallelCompanyResearchProvider(
      config({
        PARALLEL_API_KEY: "test-key",
        DATA_EXTRACTION_PROVIDER_MAX_ATTEMPTS: 2,
      }),
      searchClient,
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: {
        code: "REQUEST_TIMEOUT",
        provider: "PARALLEL_AI",
        attemptCount: 2,
      },
    });
    expect(searchOrThrow).toHaveBeenCalledTimes(2);
  });

  it("normalizes an invalid provider envelope as INVALID_PROVIDER_RESPONSE", async () => {
    searchOrThrow.mockResolvedValue({ results: "invalid" });
    const provider = new ParallelCompanyResearchProvider(
      config({ PARALLEL_API_KEY: "test-key" }),
      searchClient,
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "INVALID_PROVIDER_RESPONSE", attemptCount: 1 },
    });
    expect(searchOrThrow).toHaveBeenCalledTimes(1);
  });
});

describe("ParallelSearchClient Retry-After parsing", () => {
  it("parses delta-seconds into milliseconds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("rate limited", {
        status: 429,
        headers: { "retry-after": "2.5" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ParallelSearchClient(
      config({ PARALLEL_API_KEY: "test-key" }),
    );

    await expect(
      client.searchOrThrow({ search_queries: ["public query"] }),
    ).rejects.toMatchObject({ status: 429, retryAfterMs: 2_500 });
    vi.unstubAllGlobals();
  });
});
