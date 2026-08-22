import { describe, expect, it, vi } from "vitest";

import type { GeminiGatekeeperProvider } from "../../../data-extraction/providers/gemini-gatekeeper.provider";
import { BrandPreviewPublicWebEnrichmentService } from "./brand-preview-enrichment.service";

function result(withProvenance: boolean) {
  return {
    payload: {
      brand_summary: "Grounded public context",
      audience_or_use_context: [],
      offering_or_commercial_context: [],
      grounding_refs: ["https://source.example/context/"],
    },
    provenance: withProvenance
      ? [
          {
            type: "PUBLIC_WEB_SEARCH",
            sourceUrl: "https://source.example/context",
          },
        ]
      : [],
  };
}

describe("brand_preview.public_web_enrichment", () => {
  it("returns only grounding refs backed by provider provenance", async () => {
    const provider = { execute: vi.fn().mockResolvedValue(result(true)) };
    const service = new BrandPreviewPublicWebEnrichmentService(
      provider as unknown as GeminiGatekeeperProvider,
    );
    await expect(
      service.acquire({
        runId: "run-1",
        websiteUrl: "https://example.com",
        modelId: "registry-model",
      }),
    ).resolves.toMatchObject({
      evidenceRefs: ["public:https://source.example/context/"],
    });
  });

  it("rejects enrichment whose model refs lack public-search provenance", async () => {
    const provider = { execute: vi.fn().mockResolvedValue(result(false)) };
    const service = new BrandPreviewPublicWebEnrichmentService(
      provider as unknown as GeminiGatekeeperProvider,
    );
    await expect(
      service.acquire({
        runId: "run-1",
        websiteUrl: "https://example.com",
        modelId: "registry-model",
      }),
    ).rejects.toThrow("PUBLIC_WEB_ENRICHMENT_PROVENANCE_INCOMPLETE");
  });
});
