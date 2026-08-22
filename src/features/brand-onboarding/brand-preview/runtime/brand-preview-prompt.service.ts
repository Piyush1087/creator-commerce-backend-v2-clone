import { Injectable } from "@nestjs/common";

import { buildIntelligencePrompt } from "../../../../intelligence/runtime/prompt-builder/intelligence-prompt.builder";
import type {
  BrandPreviewEvidence,
  PublicWebEnrichment,
} from "../brand-preview.types";
import { BrandPreviewArtifactLoader } from "./brand-preview-artifact.loader";

@Injectable()
export class BrandPreviewPromptService {
  constructor(private readonly artifacts: BrandPreviewArtifactLoader) {}

  async build(args: {
    executionId: string;
    brandName: string;
    websiteUrl: string;
    confirmedIndustry: string;
    evidence: BrandPreviewEvidence;
    enrichment?: PublicWebEnrichment;
  }) {
    return buildIntelligencePrompt({
      ...(await this.artifacts.loadPromptArtifacts()),
      evidence: {
        website_evidence: args.evidence,
        public_web_enrichment: args.enrichment ?? null,
      },
      evidenceRefs: [
        ...args.evidence.evidenceRefs,
        ...(args.enrichment?.grounding_refs.map((url) => `public:${url}`) ??
          []),
      ],
      executionContext: {
        execution_id: args.executionId,
        profile_id: "brand_preview_fast",
        processor_id: "brand_preview_synthesis",
        brand_name: args.brandName,
        website_url: args.websiteUrl,
        confirmed_industry: args.confirmedIndustry,
      },
    });
  }
}
