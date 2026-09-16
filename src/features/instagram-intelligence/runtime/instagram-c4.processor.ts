import { Injectable } from "@nestjs/common";
import {
  BrandIntegrationProvider,
  BrandIntegrationStatus,
  DataExtractionCaptureStatus,
  InstagramAuthorizationHealth,
  InstagramIdentityVerification,
  IntelligenceReadiness,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { ContractRuntimeRegistry } from "../../brand-intelligence/contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../brand-intelligence/contracts/validation/semantic.validator";
import { StructuralValidator } from "../../brand-intelligence/contracts/validation/structural.validator";
import type { ProcessorExecutionResult } from "../../brand-intelligence/execution/domain/intelligence-execution.types";
import {
  ProcessorExecutorFailure,
  type ProcessorExecutor,
  type ProcessorExecutorContext,
} from "../../brand-intelligence/execution/executor/processor-executor";
import type { InstagramIntelligenceObject } from "../contracts/instagram-intelligence.schemas";
import {
  InstagramC4EvidenceManifestSchema,
  InstagramC4PersistencePayloadSchema,
  instagramC4Components,
  instagramC4Definition,
  instagramC4RegistryKey,
  type InstagramC4ProcessorId,
} from "./instagram-c4.contract";

const CAPABILITIES: Readonly<
  Record<InstagramC4ProcessorId, readonly string[]>
> = {
  instagram_content_behavior: [
    "instagram.media_inventory",
    "instagram.media_insights",
    "instagram.caption_context",
    "instagram.media_visual_observations",
    "instagram.media_creator_signals",
    "instagram.media_offering_signals",
  ],
  instagram_audience_profile: [
    "instagram.account_profile",
    "instagram.audience_followers",
    "instagram.audience_engaged",
  ],
  instagram_organic_performance_profile: [
    "instagram.account_profile",
    "instagram.media_inventory",
    "instagram.media_insights",
    "instagram.caption_context",
    "instagram.media_visual_observations",
    "instagram.media_creator_signals",
    "instagram.media_offering_signals",
  ],
};

type EvidenceRow = Awaited<
  ReturnType<InstagramC4ProcessorBase["readEvidence"]>
>[number];

abstract class InstagramC4ProcessorBase implements ProcessorExecutor {
  abstract readonly processorId: InstagramC4ProcessorId;

  constructor(
    private readonly prisma: PrismaService,
    private readonly contracts: ContractRuntimeRegistry,
    private readonly structural: StructuralValidator,
    private readonly semantic: SemanticValidator,
  ) {}

  async execute(
    context: ProcessorExecutorContext,
  ): Promise<ProcessorExecutionResult> {
    const manifest = InstagramC4EvidenceManifestSchema.safeParse(
      context.processorExecution.evidenceManifest,
    );
    if (!manifest.success) this.fail("C4_INVALID_EVIDENCE_MANIFEST");
    const input = manifest.data;
    if (
      input.brandProfileId !== context.processorExecution.brandId ||
      context.processorExecution.processorId !== this.processorId
    ) {
      this.fail("C4_EXECUTION_SCOPE_MISMATCH");
    }
    await this.assertIntegration(input);
    const evidence = await this.readEvidence(input);
    if (!evidence.length) this.fail("C4_REQUIRED_EVIDENCE_UNAVAILABLE");

    const value = this.buildValue(input.windowEnd, evidence);
    const registryKey = instagramC4RegistryKey(this.processorId);
    const bundle = this.contracts.getVerifiedBundle(registryKey);
    const structural = this.structural.validate(bundle, value);
    if (!structural.valid) {
      this.fail(`C4_${structural.issues[0]?.code ?? "STRUCTURAL_REJECTED"}`);
    }
    const semantic = this.semantic.validate(structural.value, {
      bundle,
      evidenceManifest: evidence.map((item) => ({
        evidenceRef: item.evidenceRef,
        capabilityId: item.capabilityId,
        semanticId: item.semanticObservationKey ?? item.evidenceRef,
        revisionIdentity: item.contentHash,
        sourceClass: "INSTAGRAM_OWNED",
      })),
      businessStateManifest: [],
    });
    if (!semantic.valid) {
      this.fail(`C4_${semantic.issues[0]?.code ?? "SEMANTIC_REJECTED"}`);
    }

    return {
      readiness: IntelligenceReadiness.PARTIAL,
      telemetry: {
        evidenceCount: evidence.length,
        source: "INSTAGRAM_OWNED",
      },
      persistencePayload: InstagramC4PersistencePayloadSchema.parse({
        kind: "INSTAGRAM_C4_PERSISTENCE_V1",
        processorId: this.processorId,
        value,
        evidence: evidence.map((item) => ({
          evidenceRef: item.evidenceRef,
          capabilityId: item.capabilityId,
          captureRef: item.captureRef,
          captureVersion: "1",
          capturedAt: item.capture.capturedAt?.toISOString(),
          observedFreshness: item.freshnessAtEmission,
        })),
        account: {
          integrationId: input.integrationId,
          providerAccountId: input.providerAccountId,
          authorizationGeneration: input.authorizationGeneration,
        },
      }),
    };
  }

  private async assertIntegration(input: {
    brandProfileId: string;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
  }): Promise<void> {
    const integration = await this.prisma.brandIntegration.findUnique({
      where: { id: input.integrationId },
      select: {
        brandProfileId: true,
        provider: true,
        status: true,
        isActive: true,
        providerAccountId: true,
        authorizationGeneration: true,
        identityVerification: true,
        authorizationHealth: true,
      },
    });
    if (
      !integration ||
      integration.brandProfileId !== input.brandProfileId ||
      integration.provider !== BrandIntegrationProvider.INSTAGRAM ||
      integration.status !== BrandIntegrationStatus.CONNECTED ||
      !integration.isActive ||
      integration.providerAccountId !== input.providerAccountId ||
      integration.authorizationGeneration !== input.authorizationGeneration ||
      integration.identityVerification !==
        InstagramIdentityVerification.VERIFIED ||
      integration.authorizationHealth !==
        InstagramAuthorizationHealth.CONNECTED_FULL
    ) {
      this.fail("C4_AUTHORIZATION_GENERATION_UNAVAILABLE");
    }
  }

  async readEvidence(input: {
    brandProfileId: string;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
  }) {
    return this.prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId: input.brandProfileId,
        capabilityId: { in: [...CAPABILITIES[this.processorId]] },
        capture: {
          status: DataExtractionCaptureStatus.COMPLETED,
          capturedAt: { not: null },
          providerIntegrationId: input.integrationId,
          providerAccountId: input.providerAccountId,
          authorizationGeneration: input.authorizationGeneration,
        },
      },
      include: { capture: true, resource: true },
      orderBy: [{ evidenceRef: "asc" }],
    });
  }

  private buildValue(
    windowEndText: string,
    evidence: readonly EvidenceRow[],
  ): InstagramIntelligenceObject {
    const definition = instagramC4Definition(this.processorId);
    const windowEnd = new Date(windowEndText);
    const windowStart = new Date(
      windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
    const components = Object.fromEntries(
      instagramC4Components(definition.objectId).map((name) => [
        name,
        this.component(name, evidence, windowStart, windowEnd),
      ]),
    );
    return {
      semanticId: definition.objectId,
      objectContractVersion: "1.0",
      outputContractVersion: "1.0",
      sourceScope: "INSTAGRAM_OWNED",
      state: "PARTIAL_CURRENT",
      readiness: "PARTIAL",
      freshness: "CURRENT",
      currentPreserved: false,
      generatedAt: windowEnd.toISOString(),
      window: {
        start: windowStart.toISOString(),
        end: windowEnd.toISOString(),
        days: 30,
      },
      results: [],
      signals: [],
      learnings: [],
      components,
      coverage: {
        state: "PARTIAL",
        eligibleCount: evidence.length,
        observedCount: evidence.length,
        coveragePercent: evidence.length ? 100 : null,
        reasonCodes: ["PARTIAL_CAPABILITY"],
      },
      evidenceRefs: evidence.map((item) => item.evidenceRef),
    };
  }

  private component(
    name: string,
    evidence: readonly EvidenceRow[],
    windowStart: Date,
    windowEnd: Date,
  ): InstagramIntelligenceObject["components"][string] {
    if (name === "window") {
      return {
        state: "AVAILABLE",
        value: {
          start: windowStart.toISOString(),
          end: windowEnd.toISOString(),
          days: 30,
        },
      };
    }
    if (name === "coverage") {
      return {
        state: "AVAILABLE",
        value: {
          evidenceCount: evidence.length,
          capabilities: [...new Set(evidence.map((item) => item.capabilityId))],
        },
      };
    }
    if (name === "corpus_summary") {
      return {
        state: "AVAILABLE",
        value: {
          evidenceCount: evidence.length,
          resourceCount: new Set(evidence.map((item) => item.resourceRef)).size,
        },
      };
    }
    if (name === "account_results") {
      const c2 = evidence.flatMap((item) => {
        const payload = record(item.boundedPayload);
        return payload.resultClass === "DETERMINISTIC_DERIVED_RESULT" &&
          typeof payload.calculationIdentity === "string" &&
          typeof payload.valueHash === "string"
          ? [
              {
                evidenceRef: item.evidenceRef,
                capabilityId: item.capabilityId,
                calculationIdentity: payload.calculationIdentity,
                valueHash: payload.valueHash,
                result: payload.result,
              },
            ]
          : [];
      });
      return c2.length
        ? { state: "AVAILABLE", value: c2 }
        : { state: "UNKNOWN", reasonCode: "INSUFFICIENT_EVIDENCE" };
    }
    if (name === "metric_coverage") {
      const c2 = evidence.filter(
        (item) =>
          record(item.boundedPayload).resultClass ===
          "DETERMINISTIC_DERIVED_RESULT",
      );
      return c2.length
        ? {
            state: "AVAILABLE",
            value: {
              evidenceCount: c2.length,
              resultHashes: c2.map(
                (item) => record(item.boundedPayload).valueHash,
              ),
            },
          }
        : { state: "UNKNOWN", reasonCode: "INSUFFICIENT_METRIC_COVERAGE" };
    }
    if (name === "follower_audience" || name === "engaged_audience") {
      const capability =
        name === "follower_audience"
          ? "instagram.audience_followers"
          : "instagram.audience_engaged";
      const matches = evidence.filter(
        (item) => item.capabilityId === capability,
      );
      return matches.length
        ? {
            state: "AVAILABLE",
            value: {
              evidenceRefs: matches.map((item) => item.evidenceRef),
              observedSlices: matches.length,
            },
          }
        : { state: "UNKNOWN", reasonCode: "AUDIENCE_NOT_SUPPORTED" };
    }
    if (name === "representative_media_refs") {
      return {
        state: "AVAILABLE",
        value: evidence.slice(0, 8).map((item) => ({
          resourceRef: item.resourceRef,
          evidenceRefs: [item.evidenceRef],
        })),
      };
    }
    if (name === "bounded_learnings") {
      return {
        state: "INTENTIONALLY_ABSENT",
        reasonCode: "INSUFFICIENT_SAMPLE",
      };
    }
    return { state: "UNKNOWN", reasonCode: "INSUFFICIENT_EVIDENCE" };
  }

  protected fail(code: string): never {
    throw new ProcessorExecutorFailure({
      category: "VALIDATION_FAILURE",
      code,
    });
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class InstagramC4ContentBehaviorProcessor extends InstagramC4ProcessorBase {
  readonly processorId = "instagram_content_behavior" as const;
}

@Injectable()
export class InstagramC4AudienceProfileProcessor extends InstagramC4ProcessorBase {
  readonly processorId = "instagram_audience_profile" as const;
}

@Injectable()
export class InstagramC4OrganicPerformanceProcessor extends InstagramC4ProcessorBase {
  readonly processorId = "instagram_organic_performance_profile" as const;
}
