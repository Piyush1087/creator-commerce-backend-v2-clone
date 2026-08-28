import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  BrandPreviewRuntimeState,
  IndustryVertical,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import {
  evaluateBrandPreviewReadiness,
  validateAndPruneBrandPreview,
} from "../../../../intelligence/runtime/validation/brand-preview.validation";
import { GatekeeperPersistenceService } from "../../gatekeeper/gatekeeper-persistence.service";
import { SUPPORTED_MVP_INDUSTRIES } from "../../gatekeeper/gatekeeper-v1.types";
import {
  BRAND_PREVIEW_PUBLIC_WEB_ENRICHMENT,
  BRAND_PREVIEW_WEBSITE_EVIDENCE,
  type BrandPreviewPublicWebEnrichmentPort,
  type BrandPreviewWebsiteEvidencePort,
} from "../data-extraction/brand-preview-evidence.port";
import type {
  BrandPreviewEvidence,
  PublicWebEnrichment,
} from "../brand-preview.types";
import { CanonicalBrandStateService } from "../../canonical-brand-state/canonical-brand-state.service";
import { BrandPreviewArtifactLoader } from "./brand-preview-artifact.loader";
import {
  BrandPreviewSynthesisService,
  BrandPreviewSynthesisTechnicalError,
} from "./brand-preview-synthesis.service";

const SUPPORTED = new Set<IndustryVertical>(SUPPORTED_MVP_INDUSTRIES);

@Injectable()
export class BrandPreviewRuntimeService {
  private readonly logger = new Logger(BrandPreviewRuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gatekeeper: GatekeeperPersistenceService,
    private readonly brandState: CanonicalBrandStateService,
    @Inject(BRAND_PREVIEW_WEBSITE_EVIDENCE)
    private readonly websiteEvidence: BrandPreviewWebsiteEvidencePort,
    @Inject(BRAND_PREVIEW_PUBLIC_WEB_ENRICHMENT)
    private readonly enrichment: BrandPreviewPublicWebEnrichmentPort,
    private readonly synthesis: BrandPreviewSynthesisService,
    private readonly artifacts: BrandPreviewArtifactLoader,
  ) {}

  async execute(runId: string, leaseToken: string): Promise<void> {
    const run = await this.prisma.brandPreviewRun.findUnique({
      where: { id: runId },
      include: { discoveryLead: true },
    });
    if (
      !run ||
      run.leaseToken !== leaseToken ||
      run.state !== BrandPreviewRuntimeState.ANALYSIS_ACTIVE
    ) {
      return;
    }
    try {
      const gatekeeper = await this.gatekeeper.getGatekeeperResult(
        run.discoveryLeadId,
      );
      const confirmedIndustry = gatekeeper.confirmation.confirmed_industry;
      if (
        gatekeeper.decision.outcome !== "ADMITTED" ||
        !gatekeeper.confirmation.surface_eligible ||
        !confirmedIndustry ||
        !SUPPORTED.has(confirmedIndustry)
      ) {
        await this.finish(runId, leaseToken, {
          state: BrandPreviewRuntimeState.PREVIEW_NOT_READY,
          errorCode: "PRECONDITION_LOST",
        });
        return;
      }

      const initialLifecycleMode = run.brandProfileId
        ? "POST_PROFILE"
        : "PRE_PROFILE";
      const initialState = await this.brandState.readSnapshot({
        leadId: run.discoveryLeadId,
        lifecycleMode: initialLifecycleMode,
        ...(run.brandProfileId ? { brandProfileId: run.brandProfileId } : {}),
        candidates: {
          confirmedIndustry,
          provisionalSubIndustry:
            gatekeeper.assessment?.provisional_sub_industry,
        },
        correlationId: runId,
      });
      const initialWebsiteUrl = initialState.website_url.value;
      const initialIndustry = initialState.industry.value;
      const initialBrandName = initialState.brand_name.value;
      if (!initialWebsiteUrl || !initialIndustry) {
        await this.finish(runId, leaseToken, {
          state: BrandPreviewRuntimeState.PREVIEW_NOT_READY,
          errorCode: "PRECONDITION_LOST",
        });
        return;
      }
      const acquisitionUrl = navigableWebsiteUrl(initialWebsiteUrl);

      const evidence = await this.websiteEvidence.acquire({
        websiteUrl: acquisitionUrl,
        sameRunGatekeeperEvidence: gatekeeper,
      });
      if (!evidence.brandName && !initialBrandName) {
        await this.finish(runId, leaseToken, {
          state: BrandPreviewRuntimeState.PREVIEW_NOT_READY,
          errorCode: "REQUIRED_IDENTITY_NOT_GROUNDED",
          evidence,
        });
        return;
      }
      let enrichment: PublicWebEnrichment | undefined;
      if (!evidence.sufficientForPreviewSynthesisAttempt) {
        await this.phase(runId, leaseToken, "LEARNING_AUDIENCE");
        enrichment = await this.enrichOnce(runId, leaseToken, acquisitionUrl);
      }

      const profile = run.brandProfileId
        ? { id: run.brandProfileId }
        : await this.prisma.brandProfile.upsert({
            where: { domain: gatekeeper.submission.normalized_domain },
            create: {
              domain: gatekeeper.submission.normalized_domain,
              name: evidence.brandName ?? (initialBrandName as string),
              industry: confirmedIndustry,
              subIndustry: gatekeeper.assessment?.provisional_sub_industry,
              logoUrl: evidence.logoUrl,
              brandValues: [],
              policyFlags: [],
            },
            update: {},
            select: { id: true },
          });
      await this.casUpdate(runId, leaseToken, {
        brandProfileId: profile.id,
        evidenceSnapshot: evidence as unknown as Prisma.InputJsonValue,
        phase: null,
      });

      const postProfileState = await this.brandState.readSnapshot({
        leadId: run.discoveryLeadId,
        lifecycleMode: "POST_PROFILE",
        brandProfileId: profile.id,
        candidates: {
          brandName: evidence.brandName,
          brandLogo: evidence.logoUrl,
          confirmedIndustry,
          provisionalSubIndustry:
            gatekeeper.assessment?.provisional_sub_industry,
        },
        correlationId: runId,
      });
      const brandName = postProfileState.brand_name.value;
      const canonicalWebsiteUrl = postProfileState.website_url.value;
      const canonicalIndustry = postProfileState.industry.value;
      const logoUrl = postProfileState.brand_logo.value;
      if (!brandName || !canonicalWebsiteUrl || !canonicalIndustry) {
        await this.finish(runId, leaseToken, {
          state: BrandPreviewRuntimeState.PREVIEW_NOT_READY,
          errorCode: "REQUIRED_IDENTITY_NOT_GROUNDED",
          evidence,
        });
        return;
      }
      const canonicalEvidence: BrandPreviewEvidence = {
        ...evidence,
        brandName,
        logoUrl,
      };

      let result = await this.synthesizeAndEvaluate({
        runId,
        evidence: canonicalEvidence,
        enrichment,
        brandName,
        websiteUrl: canonicalWebsiteUrl,
        confirmedIndustry: canonicalIndustry,
        logoUrl,
      });
      const enrichmentEligible =
        result.mandatoryNarrativeValid &&
        (result.output.audience_groups.length === 0 ||
          result.output.creator_marketing_opportunities.length === 0 ||
          result.output.creator_archetype_recommendations.length === 0);
      if (
        result.readiness.state === "PREVIEW_NOT_READY" &&
        !enrichment &&
        enrichmentEligible
      ) {
        await this.phase(runId, leaseToken, "FINDING_CREATOR_OPPORTUNITIES");
        enrichment = await this.enrichOnce(runId, leaseToken, acquisitionUrl);
        result = await this.synthesizeAndEvaluate({
          runId,
          evidence: canonicalEvidence,
          enrichment,
          brandName,
          websiteUrl: canonicalWebsiteUrl,
          confirmedIndustry: canonicalIndustry,
          logoUrl,
        });
      }
      await this.phase(runId, leaseToken, "PREPARING_PREVIEW");
      const snapshot = {
        identity: {
          brand_name: brandName,
          website_url: canonicalWebsiteUrl,
          display_domain: gatekeeper.submission.normalized_domain,
          confirmed_industry: canonicalIndustry,
          logo_url: logoUrl,
        },
        ...result.output,
      };
      await this.finish(runId, leaseToken, {
        state: result.readiness.state,
        completeness: result.readiness.completeness,
        evidence,
        output:
          result.readiness.state === "PREVIEW_READY" ? snapshot : undefined,
        processorMetadata: {
          ...result.metadata,
          semantic_enrichment_used: Boolean(enrichment),
          readiness_result: result.readiness,
          pruned: result.pruned,
        },
        errorCode:
          result.readiness.state === "PREVIEW_NOT_READY"
            ? "SEMANTIC_FLOOR_NOT_MET"
            : null,
      });
    } catch (error) {
      this.logger.warn(
        `brand_preview.failed runId=${runId} error=${error instanceof Error ? error.message : String(error)}`,
      );
      await this.finish(runId, leaseToken, {
        state: BrandPreviewRuntimeState.PREVIEW_FAILED_RECOVERABLE,
        errorCode: "TECHNICAL_RUNTIME_FAILURE",
        processorMetadata:
          error instanceof BrandPreviewSynthesisTechnicalError
            ? error.metadata
            : { terminal: "TECHNICAL_RUNTIME_FAILURE" },
      });
    }
  }

  private async synthesizeAndEvaluate(args: {
    runId: string;
    evidence: BrandPreviewEvidence;
    enrichment?: PublicWebEnrichment;
    brandName: string;
    websiteUrl: string;
    confirmedIndustry: string;
    logoUrl: string | null;
  }) {
    const synthesis = await this.synthesis.synthesize(args);
    const validated = validateAndPruneBrandPreview({
      output: synthesis.output,
      evidenceRefs: [
        ...args.evidence.evidenceRefs,
        ...(args.enrichment?.grounding_refs.map((url) => `public:${url}`) ??
          []),
      ],
      archetypes: await this.artifacts.loadArchetypes(),
      confirmedIndustry: args.confirmedIndustry,
    });
    return {
      ...validated,
      metadata: synthesis.metadata,
      readiness: evaluateBrandPreviewReadiness({
        gatekeeperAdmitted: true,
        confirmedSupportedIndustry: true,
        brandName: args.brandName,
        websiteUrl: args.websiteUrl,
        logoUrl: args.logoUrl,
        mandatoryNarrativeValid: validated.mandatoryNarrativeValid,
        output: validated.output,
      }),
    };
  }

  private async enrichOnce(
    runId: string,
    leaseToken: string,
    websiteUrl: string,
  ): Promise<PublicWebEnrichment | undefined> {
    const claimed = await this.prisma.brandPreviewRun.updateMany({
      where: { id: runId, leaseToken, enrichmentAttempted: false },
      data: { enrichmentAttempted: true },
    });
    if (claimed.count === 0) return undefined;
    try {
      const primary = await this.artifacts.resolvePrimaryModel();
      const result = await this.enrichment.acquire({
        runId,
        websiteUrl,
        modelId: primary.model_id,
      });
      return result.payload;
    } catch (error) {
      this.logger.warn(
        `brand_preview.enrichment_failed runId=${runId} error=${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  private phase(
    runId: string,
    leaseToken: string,
    phase:
      | "LEARNING_AUDIENCE"
      | "FINDING_CREATOR_OPPORTUNITIES"
      | "PREPARING_PREVIEW",
  ) {
    return this.casUpdate(runId, leaseToken, { phase });
  }

  private casUpdate(
    runId: string,
    leaseToken: string,
    data: Prisma.BrandPreviewRunUncheckedUpdateManyInput,
  ) {
    return this.prisma.brandPreviewRun.updateMany({
      where: {
        id: runId,
        leaseToken,
        state: BrandPreviewRuntimeState.ANALYSIS_ACTIVE,
      },
      data,
    });
  }

  private finish(
    runId: string,
    leaseToken: string,
    args: {
      state: BrandPreviewRuntimeState;
      completeness?: "NORMAL" | "PARTIAL" | null;
      evidence?: BrandPreviewEvidence;
      output?: unknown;
      processorMetadata?: unknown;
      errorCode?: string | null;
    },
  ) {
    return this.casUpdate(runId, leaseToken, {
      state: args.state,
      phase: null,
      completeness: args.completeness ?? null,
      retryAllowed:
        args.state === BrandPreviewRuntimeState.PREVIEW_FAILED_RECOVERABLE,
      errorCode: args.errorCode ?? null,
      evidenceSnapshot: args.evidence
        ? (args.evidence as unknown as Prisma.InputJsonValue)
        : undefined,
      previewOutputSnapshot: args.output
        ? (args.output as Prisma.InputJsonValue)
        : Prisma.DbNull,
      processorMetadata: args.processorMetadata
        ? (args.processorMetadata as Prisma.InputJsonValue)
        : undefined,
      completedAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
    });
  }
}

function navigableWebsiteUrl(value: string): string {
  try {
    return new URL(
      value.includes("://") ? value : `https://${value}`,
    ).toString();
  } catch {
    return value;
  }
}
