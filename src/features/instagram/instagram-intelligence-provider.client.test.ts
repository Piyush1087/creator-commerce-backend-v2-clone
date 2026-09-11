import { afterEach, describe, expect, it, vi } from "vitest";

import { InstagramIntelligenceProviderClient } from "./instagram-intelligence-provider.client";

const credential = {
  accessToken: "synthetic-provider-token",
  providerAccountId: "account-1",
};

describe("Instagram intelligence provider truth client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps observed zero distinct from missing profile fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "app-1",
            username: "brand",
            followers_count: 0,
          }),
          { status: 200 },
        ),
      ),
    );
    const result = await new InstagramIntelligenceProviderClient().readProfile(
      credential,
    );
    expect(result.followersCount).toEqual({ state: "OBSERVED_ZERO", value: 0 });
    expect(result.mediaCount).toEqual({
      state: "UNAVAILABLE",
      reason: "FIELD_ABSENT_OR_INVALID",
    });
  });

  it("rejects a malformed required profile identity without fabricating it", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ id: "app-1", followers_count: 4 })),
    );
    const result = await new InstagramIntelligenceProviderClient().readProfile(
      credential,
    );
    expect(result.availability).toBe("UNAVAILABLE");
    expect(result.username).toEqual({
      state: "UNAVAILABLE",
      reason: "FIELD_ABSENT",
    });
  });

  it("uses a fixed 30-day window on every page, deduplicates, and retains missing timestamps", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "one",
              media_type: "IMAGE",
              media_product_type: "FEED",
              caption: "",
              timestamp: "2026-08-20T00:00:00.000Z",
            },
            { id: "missing", media_type: "VIDEO" },
          ],
          paging: { cursors: { after: "opaque-cursor" } },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: "one", timestamp: "2026-08-20T00:00:00.000Z" },
            { id: "future", timestamp: "2026-09-12T00:00:00.000Z" },
            { id: "old", timestamp: "2026-07-01T00:00:00.000Z" },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result =
      await new InstagramIntelligenceProviderClient().readMediaInventory(
        credential,
        new Date("2026-09-11T00:00:00.000Z"),
      );
    expect(result.availability).toBe("AVAILABLE");
    expect(result.items.map((item) => item.providerMediaId)).toEqual([
      "one",
      "missing",
    ]);
    expect(result.items[0].caption).toEqual({
      state: "EXPLICIT_EMPTY",
      value: "",
    });
    expect(result.items[1].timestamp).toEqual({
      state: "UNAVAILABLE",
      reason: "MISSING_OR_INVALID_TIMESTAMP",
    });
    expect(result.coverage).toMatchObject({
      pagesAttempted: 2,
      pagesCompleted: 2,
      rowsReturned: 5,
      rowsEligible: 1,
      rowsMissingTimestamp: 1,
      duplicatesDiscarded: 1,
      stopReason: "EXHAUSTED",
    });
    for (const [rawUrl] of fetchMock.mock.calls) {
      const url = new URL(String(rawUrl));
      expect(url.searchParams.get("since")).toBe("1786492800");
      expect(url.searchParams.get("until")).toBe("1789084800");
      expect(url.searchParams.get("fields")).not.toContain("media_url");
      expect(url.searchParams.get("fields")).not.toContain("thumbnail_url");
    }
  });

  it("does not follow an untrusted paging URL and reports malformed cursor evidence", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ id: "one", timestamp: "2026-09-01T00:00:00.000Z" }],
        paging: { next: "https://attacker.example/steal?after=bad" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result =
      await new InstagramIntelligenceProviderClient().readMediaInventory(
        credential,
        new Date("2026-09-11T00:00:00.000Z"),
      );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      availability: "PARTIAL",
      failureClassification: "UNKNOWN",
      coverage: { stopReason: "PROVIDER_FAILURE" },
    });
    expect(JSON.stringify(result)).not.toContain("attacker.example");
  });

  it("detects a cursor loop rather than replaying a page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: [], paging: { cursors: { after: "same" } } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [], paging: { cursors: { after: "same" } } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result =
      await new InstagramIntelligenceProviderClient().readMediaInventory(
        credential,
        new Date("2026-09-11T00:00:00.000Z"),
      );
    expect(result).toMatchObject({
      availability: "PARTIAL",
      failureClassification: "UNKNOWN",
      coverage: { pagesCompleted: 2, stopReason: "PROVIDER_FAILURE" },
    });
  });

  it("distinguishes first-page failure, later partial failure, and explicit empty success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: {} }, 429)),
    );
    await expect(
      new InstagramIntelligenceProviderClient().readMediaInventory(
        credential,
        new Date("2026-09-11T00:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      availability: "UNAVAILABLE",
      failureClassification: "RATE_LIMIT",
      coverage: { stopReason: "PROVIDER_FAILURE" },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: [] })),
    );
    await expect(
      new InstagramIntelligenceProviderClient().readMediaInventory(
        credential,
        new Date("2026-09-11T00:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      availability: "AVAILABLE",
      coverage: { stopReason: "EMPTY_SUCCESS" },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            data: [{ id: "kept", timestamp: "2026-09-01T00:00:00.000Z" }],
            paging: { cursors: { after: "next" } },
          }),
        )
        .mockResolvedValueOnce(jsonResponse({ error: { code: 10 } }, 403)),
    );
    await expect(
      new InstagramIntelligenceProviderClient().readMediaInventory(
        credential,
        new Date("2026-09-11T00:00:00.000Z"),
      ),
    ).resolves.toMatchObject({
      availability: "PARTIAL",
      items: [{ providerMediaId: "kept" }],
      failureClassification: "PERMISSION_LOSS",
      coverage: {
        pagesAttempted: 2,
        pagesCompleted: 1,
        stopReason: "PROVIDER_FAILURE",
      },
    });
  });

  it("stops deterministically at the 500-record safety cap", async () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({
      id: `media-${index}`,
      media_type: "IMAGE",
      timestamp: "2026-09-01T00:00:00.000Z",
    }));
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          jsonResponse({ data: rows, paging: { cursors: { after: "more" } } }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = new InstagramIntelligenceProviderClient();
    const first = await client.readMediaInventory(
      credential,
      new Date("2026-09-11T00:00:00.000Z"),
    );
    vi.stubGlobal("fetch", fetchMock);
    const second = await client.readMediaInventory(
      credential,
      new Date("2026-09-11T00:00:00.000Z"),
    );
    expect(first).toMatchObject({
      availability: "PARTIAL",
      coverage: { rowsEligible: 500, stopReason: "CAP_REACHED" },
    });
    expect(first.items).toHaveLength(500);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("does not coerce absent insight metrics to zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [
            { name: "reach", values: [{ value: 0 }] },
            { name: "likes", values: [{ value: 12 }] },
          ],
        }),
      ),
    );
    const result =
      await new InstagramIntelligenceProviderClient().readMediaInsights(
        credential,
        "media-1",
        "IMAGE",
      );
    expect(result.metrics.reach).toEqual({ state: "OBSERVED_ZERO", value: 0 });
    expect(result.metrics.likes).toEqual({ state: "OBSERVED", value: 12 });
    expect(result.metrics.views).toEqual({
      state: "UNAVAILABLE",
      reason: "PROVIDER_DID_NOT_RETURN_METRIC",
    });
  });

  it("does not call the provider for an unknown media format", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result =
      await new InstagramIntelligenceProviderClient().readMediaInsights(
        credential,
        "media-1",
        "UNKNOWN",
      );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.metrics.reach).toEqual({
      state: "UNSUPPORTED",
      reason: "METRIC_FORMAT_PAIR_UNSUPPORTED",
    });
  });

  it.each([
    [401, { error: { code: 190 } }, "AUTHORIZATION_REVALIDATION_REQUIRED"],
    [403, { error: { code: 10 } }, "PERMISSION_LOSS"],
    [
      400,
      { error: { code: 25, error_subcode: 2207050 } },
      "PROVIDER_ACCESS_BLOCKED",
    ],
    [429, { error: {} }, "RATE_LIMIT"],
    [503, { error: { is_transient: true } }, "TRANSIENT"],
    [400, { error: { code: 100 } }, "CONTENT_OR_METRIC_UNAVAILABLE"],
    [418, { error: { code: 999 } }, "UNKNOWN"],
  ] as const)(
    "preserves provider failure class %s as %s",
    async (status, body, classification) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse(body, status)),
      );
      const result =
        await new InstagramIntelligenceProviderClient().readMediaInsights(
          credential,
          "media-1",
          "IMAGE",
        );
      expect(result.failureClassification).toBe(classification);
      expect(JSON.stringify(result)).not.toMatch(
        /synthetic-provider-token|error_subcode/,
      );
    },
  );

  it("emits only verified audience query combinations", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(jsonResponse({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);
    const client = new InstagramIntelligenceProviderClient();
    for (const population of ["FOLLOWERS", "ENGAGED_AUDIENCE"] as const) {
      for (const breakdown of ["AGE", "CITY", "COUNTRY", "GENDER"] as const) {
        for (const timeframe of ["THIS_MONTH", "THIS_WEEK"] as const) {
          await client.readAudienceInsights(
            credential,
            population,
            breakdown,
            timeframe,
          );
        }
      }
    }
    expect(fetchMock).toHaveBeenCalledTimes(16);
    for (const [rawUrl] of fetchMock.mock.calls) {
      const url = new URL(String(rawUrl));
      expect(url.searchParams.get("period")).toBe("lifetime");
      expect(url.searchParams.get("metric_type")).toBe("total_value");
      expect(["this_month", "this_week"]).toContain(
        url.searchParams.get("timeframe"),
      );
      expect(["age", "city", "country", "gender"]).toContain(
        url.searchParams.get("breakdown"),
      );
    }
  });

  it("models audience suppression and preserves ordered carousel metadata", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: "child-b", media_type: "VIDEO" },
            { id: "child-a", media_type: "IMAGE" },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = new InstagramIntelligenceProviderClient();
    await expect(
      client.readAudienceInsights(
        credential,
        "FOLLOWERS",
        "COUNTRY",
        "THIS_MONTH",
      ),
    ).resolves.toMatchObject({
      availability: "UNAVAILABLE",
      limitation: "PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED",
    });
    const children = await client.readCarouselChildren(
      credential,
      "carousel-1",
    );
    expect(
      children.children.map(({ providerMediaId, ordinal }) => ({
        providerMediaId,
        ordinal,
      })),
    ).toEqual([
      { providerMediaId: "child-b", ordinal: 0 },
      { providerMediaId: "child-a", ordinal: 1 },
    ]);
    expect(JSON.stringify(children)).not.toMatch(/url|token/i);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}
