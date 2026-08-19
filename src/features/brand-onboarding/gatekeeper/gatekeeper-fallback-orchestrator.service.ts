import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  GATEKEEPER_ASSESSMENT_PROVIDER,
  type GatekeeperAssessmentProvider,
} from "./gatekeeper-assessment-provider.token";
import { GatekeeperSiteAssessmentSchema } from "./gatekeeper-site-assessment.schema";
import { validateGatekeeperAssessmentSemantics } from "./gatekeeper-semantic-validation";
import type {
  GatekeeperExecutionTrace,
  GatekeeperSiteAssessment,
} from "./gatekeeper-v1.types";

export type GatekeeperAssessmentExecution = {
  assessment: GatekeeperSiteAssessment | null;
  exhaustedTechnicalFailure: boolean;
  unresolvedSemanticUncertainty: boolean;
  execution: GatekeeperExecutionTrace;
};

@Injectable()
export class GatekeeperFallbackOrchestratorService {
  private readonly logger = new Logger(GatekeeperFallbackOrchestratorService.name);

  constructor(
    @Inject(GATEKEEPER_ASSESSMENT_PROVIDER)
    private readonly provider: GatekeeperAssessmentProvider,
  ) {}

  async execute(args: {
    normalizedUrl: string;
    normalizedDomain: string;
  }): Promise<GatekeeperAssessmentExecution> {
    const execution: GatekeeperExecutionTrace = {
      primary: "NOT_RUN",
      parallel: "NOT_RUN",
      openai: "NOT_RUN",
    };

    const primary = await this.run(
      "primary",
      () => this.provider.primary(args),
      execution,
    );
    if (primary.assessment && !primary.semanticUncertainty) {
      return {
        assessment: primary.assessment,
        exhaustedTechnicalFailure: false,
        unresolvedSemanticUncertainty: false,
        execution,
      };
    }

    const prior = primary.assessment;
    const parallel = await this.run(
      "parallel",
      () =>
        this.provider.parallel({
          ...args,
          priorAssessment:
            prior ??
            ({
              provisional_industry: null,
              provisional_sub_industry: null,
              entity_category: "UNKNOWN",
              english_evidence_status: "UNCERTAIN",
              creator_marketing_applicability: "UNCERTAIN",
              commercial_destination_types: [],
              assessment_confidence: "LOW",
            } satisfies GatekeeperSiteAssessment),
        }),
      execution,
    );
    if (parallel.assessment && !parallel.semanticUncertainty) {
      return {
        assessment: parallel.assessment,
        exhaustedTechnicalFailure: false,
        unresolvedSemanticUncertainty: false,
        execution,
      };
    }

    const latest = parallel.assessment ?? primary.assessment;
    const openai = await this.run(
      "openai",
      () =>
        this.provider.openAiFallback({
          ...args,
          priorAssessment: latest,
        }),
      execution,
    );
    if (openai.assessment && !openai.semanticUncertainty) {
      return {
        assessment: openai.assessment,
        exhaustedTechnicalFailure: false,
        unresolvedSemanticUncertainty: false,
        execution,
      };
    }

    const assessment = openai.assessment ?? latest;
    return {
      assessment,
      exhaustedTechnicalFailure: assessment == null,
      unresolvedSemanticUncertainty: assessment != null,
      execution,
    };
  }

  private async run(
    stage: "primary" | "parallel" | "openai",
    call: () => Promise<unknown>,
    execution: GatekeeperExecutionTrace,
  ): Promise<{
    assessment: GatekeeperSiteAssessment | null;
    semanticUncertainty: boolean;
  }> {
    try {
      const raw = await call();
      const parsed = GatekeeperSiteAssessmentSchema.safeParse(raw);
      if (!parsed.success) {
        execution[stage] = "TECHNICAL_FAILURE";
        this.logger.warn(
          `gatekeeper ${stage} malformed structured result; escalating`,
        );
        return { assessment: null, semanticUncertainty: false };
      }
      const semantic = validateGatekeeperAssessmentSemantics(parsed.data);
      execution[stage] = semantic.admissionCriticalUncertainty
        ? "SEMANTIC_UNCERTAINTY"
        : "SUCCEEDED";
      return {
        assessment: parsed.data,
        semanticUncertainty: semantic.admissionCriticalUncertainty,
      };
    } catch (error) {
      execution[stage] = "TECHNICAL_FAILURE";
      this.logger.warn(
        `gatekeeper ${stage} technical failure; escalating err=${String(error)}`,
      );
      return { assessment: null, semanticUncertainty: false };
    }
  }
}
