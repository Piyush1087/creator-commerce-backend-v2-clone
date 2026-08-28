import { describe, expect, it, vi } from "vitest";

import type { GeminiGatekeeperProvider } from "../../../data-extraction/providers/gemini-gatekeeper.provider";
import { BrandPreviewPublicWebEnrichmentService } from "./brand-preview-enrichment.service";

function result(args: {
  withProvenance?: boolean;
  groundingRefs?: string[];
  provenanceUrls?: string[];
}) {
  const groundingRefs = args.groundingRefs ?? [
    "https://source.example/context/",
  ];
  const provenanceUrls =
    args.provenanceUrls ??
    (args.withProvenance === false ? [] : ["https://source.example/context"]);
  return {
    payload: {
      brand_summary: "Grounded public context",
      audience_or_use_context: [],
      offering_or_commercial_context: [],
      grounding_refs: groundingRefs,
    },
    provenance: provenanceUrls.map((sourceUrl) => ({
      type: "PUBLIC_WEB_SEARCH" as const,
      sourceUrl,
    })),
  };
}

describe("brand_preview.public_web_enrichment", () => {
  it("returns only grounding refs backed by provider provenance", async () => {
    const provider = {
      execute: vi.fn().mockResolvedValue(result({ withProvenance: true })),
    };
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
    const provider = {
      execute: vi.fn().mockResolvedValue(result({ withProvenance: false })),
    };
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

  it("keeps model public URLs when provenance is only a Vertex grounding redirect", async () => {
    const provider = {
      execute: vi.fn().mockResolvedValue(
        result({
          groundingRefs: ["https://bewakoof.com/about"],
          provenanceUrls: [
            "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc",
          ],
        }),
      ),
    };
    const service = new BrandPreviewPublicWebEnrichmentService(
      provider as unknown as GeminiGatekeeperProvider,
    );
    await expect(
      service.acquire({
        runId: "run-1",
        websiteUrl: "https://bewakoof.com",
        modelId: "registry-model",
      }),
    ).resolves.toMatchObject({
      evidenceRefs: ["public:https://bewakoof.com/about"],
    });
  });

  it("falls back to Vertex provenance URLs when the model only cited redirects", async () => {
    const vertex =
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc";
    const provider = {
      execute: vi.fn().mockResolvedValue(
        result({
          groundingRefs: [vertex],
          provenanceUrls: [vertex],
        }),
      ),
    };
    const service = new BrandPreviewPublicWebEnrichmentService(
      provider as unknown as GeminiGatekeeperProvider,
    );
    await expect(
      service.acquire({
        runId: "run-1",
        websiteUrl: "https://bewakoof.com",
        modelId: "registry-model",
      }),
    ).resolves.toMatchObject({
      evidenceRefs: [`public:${vertex}`],
    });
  });
});
