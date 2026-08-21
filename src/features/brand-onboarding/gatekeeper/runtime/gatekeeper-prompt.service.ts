import { Injectable } from "@nestjs/common";

import { buildIntelligencePrompt } from "../../../../intelligence/runtime/prompt-builder/intelligence-prompt.builder";
import { GatekeeperArtifactLoader } from "./gatekeeper-artifact.loader";

@Injectable()
export class GatekeeperPromptService {
  constructor(private readonly artifacts: GatekeeperArtifactLoader) {}

  async build(args: {
    executionId: string;
    stage: string;
    normalizedUrl: string;
    normalizedDomain: string;
    evidence: unknown;
    evidenceRefs: string[];
    priorAssessment?: unknown;
  }) {
    const loaded = await this.artifacts.loadPromptArtifacts();
    return buildIntelligencePrompt({
      ...loaded,
      evidence: args.evidence,
      evidenceRefs: args.evidenceRefs,
      executionContext: {
        execution_id: args.executionId,
        profile_id: "gatekeeper_scan",
        processor_id: "gatekeeper_site_assessment",
        fallback_stage: args.stage,
        normalized_url: args.normalizedUrl,
        normalized_domain: args.normalizedDomain,
        prior_assessment: args.priorAssessment ?? null,
      },
    });
  }
}
