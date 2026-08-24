import { afterEach, describe, expect, it, vi } from "vitest";

import type { ZyteHomepageStrategy } from "../../surface-scan/stage1a/zyte-homepage.strategy";
import { TextContextBuilderService } from "../../surface-scan/stage1b/text-context-builder.service";
import { BrandPreviewWebsiteEvidenceService } from "./brand-preview-evidence.service";

const homepage = `
  <html><head><title>Example | Practical tools</title><meta property="og:site_name" content="Example"></head>
  <body><main>${"Useful product evidence helps customers and teams understand what they can buy from the shop. ".repeat(15)}</main>
  <a href="/about">About</a><a href="/products">Products</a><a href="/blog">Blog</a></body></html>`;

afterEach(() => vi.unstubAllGlobals());

describe("brand_preview.website_evidence", () => {
  it("uses bounded direct HTTP, normalizes with Cheerio and reuses Gatekeeper context", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return {
        ok: true,
        url,
        text: vi
          .fn()
          .mockResolvedValue(
            url.endsWith("/")
              ? homepage
              : `<html><body>${"Context ".repeat(80)}</body></html>`,
          ),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const zyte = {
      isConfigured: vi.fn().mockReturnValue(false),
      fetchHtml: vi.fn(),
    };
    const service = new BrandPreviewWebsiteEvidenceService(
      new TextContextBuilderService(),
      zyte as unknown as ZyteHomepageStrategy,
    );
    const result = await service.acquire({
      websiteUrl: "https://example.com/",
      sameRunGatekeeperEvidence: { decision: { outcome: "ADMITTED" } },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(zyte.fetchHtml).not.toHaveBeenCalled();
    expect(result.pages).toHaveLength(2);
    expect(result.evidenceRefs).toContain("gatekeeper:same-run");
    expect(result.sufficientForPreviewSynthesisAttempt).toBe(true);
  });

  it("uses selective Zyte fallback when direct acquisition is unusable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const zyte = {
      isConfigured: vi.fn().mockReturnValue(true),
      fetchHtml: vi.fn().mockResolvedValue(homepage),
    };
    const service = new BrandPreviewWebsiteEvidenceService(
      new TextContextBuilderService(),
      zyte as unknown as ZyteHomepageStrategy,
    );
    const result = await service.acquire({
      websiteUrl: "https://example.com/",
    });
    expect(zyte.fetchHtml).toHaveBeenCalled();
    expect(result.brandName).toBe("Example");
  });
});
