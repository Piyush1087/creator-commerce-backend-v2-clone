import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { GeminiGatekeeperProvider } from "../../../data-extraction/providers/gemini-gatekeeper.provider";
import type { PublicWebEnrichment } from "../brand-preview.types";
import type { BrandPreviewPublicWebEnrichmentPort } from "./brand-preview-evidence.port";

const EnrichmentSchema = z
  .object({
    brand_summary: z.string().trim().min(1).max(800),
    audience_or_use_context: z.array(z.string().trim().min(1).max(300)).max(3),
    offering_or_commercial_context: z
      .array(z.string().trim().min(1).max(300))
      .max(3),
    grounding_refs: z.array(z.string().url()).min(1).max(8),
  })
  .strict();

function comparableUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

function isVertexGroundingRedirect(value: string): boolean {
  try {
    return new URL(value).hostname === "vertexaisearch.cloud.google.com";
  } catch {
    return false;
  }
}

function selectGroundingRefs(
  modelRefs: string[],
  provenanceUrls: string[],
): string[] {
  const publicSources = new Set(provenanceUrls.map(comparableUrl));
  const exact = modelRefs.filter((url) =>
    publicSources.has(comparableUrl(url)),
  );
  if (exact.length > 0) return exact;
  if (provenanceUrls.length === 0) return [];

  // Gemini often cites Vertex grounding redirects instead of the public URL
  // the model put in grounding_refs. Search provenance still counts.
  const publicModelRefs = modelRefs.filter(
    (url) => !isVertexGroundingRedirect(url),
  );
  if (publicModelRefs.length > 0) return publicModelRefs;

  const publicProvenance = provenanceUrls.filter(
    (url) => !isVertexGroundingRedirect(url),
  );
  if (publicProvenance.length > 0) return publicProvenance;

  return provenanceUrls;
}

@Injectable()
export class BrandPreviewPublicWebEnrichmentService implements BrandPreviewPublicWebEnrichmentPort {
  constructor(private readonly gemini: GeminiGatekeeperProvider) {}

  async acquire(args: {
    runId: string;
    websiteUrl: string;
    modelId: string;
  }): Promise<{ payload: PublicWebEnrichment; evidenceRefs: string[] }> {
    const result = await this.gemini.execute({
      acquisitionRunId: args.runId,
      capabilityId: "brand_preview.public_web_enrichment",
      modelId: args.modelId,
      ownedUrl: args.websiteUrl,
      maxAttempts: 2,
      outputSchema: EnrichmentSchema,
      instruction:
        "Acquire only bounded public context needed to ground a sparse Brand Preview. Do not reclassify Industry, invent claims, or produce Preview content. Return concise evidence facts and exact public source URLs. Return compact valid JSON only.",
    });
    const provenanceUrls = result.provenance
      .filter((item) => item.type === "PUBLIC_WEB_SEARCH" && item.sourceUrl)
      .map((item) => item.sourceUrl as string);
    const groundingRefs = selectGroundingRefs(
      result.payload.grounding_refs,
      provenanceUrls,
    );
    if (groundingRefs.length === 0) {
      throw new Error("PUBLIC_WEB_ENRICHMENT_PROVENANCE_INCOMPLETE");
    }
    return {
      payload: { ...result.payload, grounding_refs: groundingRefs },
      evidenceRefs: groundingRefs.map((url) => `public:${url}`),
    };
  }
}
