import { afterEach, describe, expect, it, vi } from "vitest";

import { TextContextBuilderService } from "../../brand-onboarding/surface-scan/stage1b/text-context-builder.service";
import {
  ExistingOwnedWebsiteAcquisitionMechanics,
  OWNED_WEBSITE_WAVE1_BOUNDS,
  inferPageRole,
} from "./acquisition/owned-website-wave1-acquisition.service";

function html(body = "Representative brand content for customers and products. ".repeat(30)) {
  return `<html><head><title>Brand</title></head><body><main>${body}</main><a href="/about">About</a></body></html>`;
}

describe("DE-W1.0D owned-site provider reuse", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses direct fetch first and never calls fallback on usable direct success", async () => {
    const zyte = {
      isConfigured: () => true,
      fetchHtml: vi.fn(async () => html("fallback".repeat(100))),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(html(), {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    const mechanics = new ExistingOwnedWebsiteAcquisitionMechanics(
      new TextContextBuilderService(),
      zyte as never,
    );
    const result = await mechanics.acquire("https://example.com/");
    expect(result.quality.state).toBe("COMPLETE");
    expect(result.attempts.map((attempt) => attempt.attemptRole)).toEqual([
      "PRIMARY",
    ]);
    expect(zyte.fetchHtml).not.toHaveBeenCalled();
  });

  it("calls the existing Zyte fallback only when direct acquisition is unusable", async () => {
    const zyte = {
      isConfigured: () => true,
      fetchHtml: vi.fn(async () => html("fallback representative content ".repeat(40))),
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 503 })));
    const mechanics = new ExistingOwnedWebsiteAcquisitionMechanics(
      new TextContextBuilderService(),
      zyte as never,
    );
    const result = await mechanics.acquire("https://example.com/");
    expect(result.quality.state).toBe("DEGRADED");
    expect(result.reasonCodes).toContain("DIRECT_FETCH_FAILED");
    expect(result.attempts.map((attempt) => attempt.attemptRole)).toEqual([
      "PRIMARY",
      "FALLBACK",
    ]);
    expect(zyte.fetchHtml).toHaveBeenCalledTimes(1);
  });

  it("returns UNAVAILABLE when direct and fallback acquisition both fail", async () => {
    const zyte = {
      isConfigured: () => true,
      fetchHtml: vi.fn(async () => {
        throw new Error("provider failed");
      }),
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 503 })));
    const mechanics = new ExistingOwnedWebsiteAcquisitionMechanics(
      new TextContextBuilderService(),
      zyte as never,
    );
    const result = await mechanics.acquire("https://example.com/");
    expect(result.quality.state).toBe("UNAVAILABLE");
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "DIRECT_FETCH_FAILED",
        "FALLBACK_FAILED",
        "NO_USABLE_CONTENT",
      ]),
    );
  });

  it("bounds retained source and normalized text deterministically", async () => {
    const zyte = { isConfigured: () => false, fetchHtml: vi.fn() };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html("x".repeat(100_000)), { status: 200 })),
    );
    const mechanics = new ExistingOwnedWebsiteAcquisitionMechanics(
      new TextContextBuilderService(),
      zyte as never,
    );
    const result = await mechanics.acquire("https://example.com/");
    expect(result.html!.length).toBeLessThanOrEqual(
      OWNED_WEBSITE_WAVE1_BOUNDS.maximumSourceBodyChars,
    );
    expect(result.cleanText!.length).toBeLessThanOrEqual(
      OWNED_WEBSITE_WAVE1_BOUNDS.maximumNormalizedTextChars,
    );
    expect(result.internalLinks.length).toBeLessThanOrEqual(
      OWNED_WEBSITE_WAVE1_BOUNDS.maximumDiscoveredLinksConsidered,
    );
  });

  it("classifies frozen MVP page roles without an LLM", () => {
    expect(inferPageRole("https://example.com/")).toBe("HOMEPAGE");
    expect(inferPageRole("https://example.com/about-us")).toBe("ABOUT_COMPANY");
    expect(inferPageRole("https://example.com/our-story")).toBe("BRAND_STORY");
    expect(inferPageRole("https://example.com/mission-values")).toBe("MISSION_VALUES");
    expect(inferPageRole("https://example.com/pricing")).toBe("PRICING_PLANS");
    expect(inferPageRole("https://example.com/solutions")).toBe("SOLUTIONS_OVERVIEW");
    expect(inferPageRole("https://example.com/unclassified")).toBe("OTHER");
  });

  it("rejects private-network URL literals before direct acquisition", async () => {
    const zyte = { isConfigured: () => false, fetchHtml: vi.fn() };
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const mechanics = new ExistingOwnedWebsiteAcquisitionMechanics(
      new TextContextBuilderService(),
      zyte as never,
    );
    const result = await mechanics.acquire("http://127.0.0.1/internal");
    expect(result.quality.state).toBe("UNAVAILABLE");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
