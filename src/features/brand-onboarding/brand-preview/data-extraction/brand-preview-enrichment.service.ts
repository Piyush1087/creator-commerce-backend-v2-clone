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
      maxAttempts: 1,
      outputSchema: EnrichmentSchema,
      instruction:
        "Acquire only bounded public context needed to ground a sparse Brand Preview. Do not reclassify Industry, invent claims, or produce Preview content. Return concise evidence facts and exact public source URLs.",
    });
    const publicSources = new Set(
      result.provenance
        .filter((item) => item.type === "PUBLIC_WEB_SEARCH" && item.sourceUrl)
        .map((item) => comparableUrl(item.sourceUrl as string)),
    );
    const groundingRefs = result.payload.grounding_refs.filter((url) =>
      publicSources.has(comparableUrl(url)),
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
