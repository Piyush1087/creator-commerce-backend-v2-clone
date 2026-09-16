import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  asBrandId,
  asEvidenceRef,
  asSemanticObservationKey,
} from "../../data-extraction/evidence/domain/evidence-identities";
import { persistenceError } from "../../data-extraction/evidence/persistence/evidence-persistence.errors";
import { createDataExtractionRepositorySet } from "../../data-extraction/evidence/persistence/prisma-evidence-repositories";
import { canonicalJson } from "../../brand-intelligence/contracts/bundle/canonical-json";
import { INSTAGRAM_DE_CONTRACT } from "../contracts/instagram-intelligence.registry";
import {
  buildC2InputManifest,
  calculateC2Foundations,
  calculateSnapshotChange,
  type C2EvidenceInput,
  type C2InputSnapshot,
} from "./instagram-c2-foundations";
import { INSTAGRAM_C2_CALCULATION_CONTRACT } from "./instagram-c2-exact-arithmetic";

const DAY_MS = 86_400_000;

export type InstagramC2ExecutionRequest = Readonly<{
  brandId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  executionCutoff: Date;
  windowEnd: Date;
}>;

@Injectable()
export class InstagramC2FoundationsService {
  constructor(private readonly prisma: PrismaService) {}

  async project(
    request: InstagramC2ExecutionRequest,
  ): Promise<C2InputSnapshot> {
    assertDates(request);
    const integrations = await this.prisma.brandIntegration.findMany({
      where: { brandProfileId: request.brandId, provider: "INSTAGRAM" },
      select: {
        providerAccountId: true,
        authorizationGeneration: true,
        status: true,
        isActive: true,
      },
    });
    const integration = integrations[0];
    if (
      integrations.length !== 1 ||
      !integration?.isActive ||
      !["CONNECTED", "PARTIALLY_CONNECTED"].includes(integration.status)
    )
      throw persistenceError("INSTAGRAM_INTEGRATION_NOT_READY");
    if (integration.providerAccountId !== request.providerAccountId)
      throw persistenceError("PROVIDER_ACCOUNT_MISMATCH");
    if (integration.authorizationGeneration !== request.authorizationGeneration)
      throw persistenceError("STALE_AUTHORIZATION_GENERATION");

    const rows = await this.prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId: request.brandId,
        capabilityId: { in: [...INSTAGRAM_DE_CONTRACT.capabilities] },
        normalizationContractVersion: {
          not: INSTAGRAM_C2_CALCULATION_CONTRACT,
        },
        capture: {
          status: "COMPLETED",
          capturedAt: { lte: request.executionCutoff },
          providerAccountId: request.providerAccountId,
          authorizationGeneration: request.authorizationGeneration,
        },
        resource: {
          sourceClass: "INSTAGRAM_OWNED",
          providerAccountId: request.providerAccountId,
        },
      },
      include: { capture: true, resource: true },
      orderBy: { evidenceRef: "asc" },
    });
    const evidence: C2EvidenceInput[] = rows.map((row) => ({
      evidenceRef: row.evidenceRef,
      captureRef: row.captureRef,
      capturedAt: row.capture.capturedAt!.toISOString(),
      capabilityId: row.capabilityId,
      providerAccountId: row.capture.providerAccountId!,
      authorizationGeneration: row.capture.authorizationGeneration!,
      payload: asRecord(row.boundedPayload),
    }));
    return {
      brandId: request.brandId,
      providerAccountId: request.providerAccountId,
      authorizationGeneration: request.authorizationGeneration,
      sourceClass: "INSTAGRAM_OWNED",
      executionCutoff: request.executionCutoff.toISOString(),
      windowStart: new Date(
        request.windowEnd.getTime() - 30 * DAY_MS,
      ).toISOString(),
      windowEnd: request.windowEnd.toISOString(),
      evidence,
    };
  }

  async execute(request: InstagramC2ExecutionRequest) {
    const snapshot = await this.project(request);
    const baseResult = calculateC2Foundations(snapshot);
    const historicalAccountEvidence = await this.loadHistoricalEvidence(
      request,
      "instagram.account_profile",
    );
    const snapshotFoundations = [
      "followersCount",
      "followsCount",
      "mediaCount",
    ].map((metric) => ({
      metric,
      ...calculateSnapshotChange(
        historicalAccountEvidence.flatMap((item) => {
          const field = asRecord(item.payload[metric]);
          return (field.state === "OBSERVED" ||
            field.state === "OBSERVED_ZERO") &&
            Number.isSafeInteger(field.value)
            ? [
                {
                  observedAt: item.capturedAt,
                  value: field.value as number,
                  providerAccountId: item.providerAccountId!,
                  authorizationGeneration: item.authorizationGeneration!,
                  evidenceRef: item.evidenceRef,
                },
              ]
            : [];
        }),
      ),
    }));
    const result = { ...baseResult, snapshotFoundations };
    const sourceCapabilities = [
      ...new Set(snapshot.evidence.map((item) => item.capabilityId)),
    ].sort();
    const observations = [];
    for (const capabilityId of sourceCapabilities) {
      let support = snapshot.evidence.filter(
        (item) => item.capabilityId === capabilityId,
      );
      if (capabilityId === "instagram.account_profile") {
        support = historicalAccountEvidence;
      }
      if (support.length === 0) continue;
      observations.push(
        await this.persistCapabilityResult(
          snapshot,
          capabilityId,
          support,
          result,
        ),
      );
    }
    return { ...result, observations };
  }

  private async loadHistoricalEvidence(
    request: InstagramC2ExecutionRequest,
    capabilityId: string,
  ): Promise<C2EvidenceInput[]> {
    const rows = await this.prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId: request.brandId,
        capabilityId,
        normalizationContractVersion: {
          not: INSTAGRAM_C2_CALCULATION_CONTRACT,
        },
        capture: {
          status: "COMPLETED",
          capturedAt: { lte: request.executionCutoff },
          providerAccountId: request.providerAccountId,
        },
        resource: {
          sourceClass: "INSTAGRAM_OWNED",
          providerAccountId: request.providerAccountId,
        },
      },
      include: { capture: true },
      orderBy: { evidenceRef: "asc" },
    });
    return rows.map((row) => ({
      evidenceRef: row.evidenceRef,
      captureRef: row.captureRef,
      capturedAt: row.capture.capturedAt!.toISOString(),
      capabilityId: row.capabilityId,
      providerAccountId: row.capture.providerAccountId!,
      authorizationGeneration: row.capture.authorizationGeneration!,
      payload: asRecord(row.boundedPayload),
    }));
  }

  private async persistCapabilityResult(
    snapshot: C2InputSnapshot,
    capabilityId: string,
    support: readonly C2EvidenceInput[],
    result: ReturnType<typeof calculateC2Foundations> & {
      snapshotFoundations: readonly unknown[];
    },
  ) {
    const capabilityInputManifest = buildC2InputManifest({
      ...snapshot,
      evidence: support,
      historicalComparison: capabilityId === "instagram.account_profile",
    });
    const calculationIdentity = digest(
      canonicalJson({
        contractVersion: INSTAGRAM_C2_CALCULATION_CONTRACT,
        capabilityId,
        inputHash: capabilityInputManifest.inputHash,
      }),
    );
    const relevant = capabilityProjection(capabilityId, result);
    const payload = {
      resultClass: "DETERMINISTIC_DERIVED_RESULT",
      contractVersion: INSTAGRAM_C2_CALCULATION_CONTRACT,
      sourceClass: "INSTAGRAM_OWNED",
      brandId: snapshot.brandId,
      providerAccountId: snapshot.providerAccountId,
      authorizationGenerationLineage: [
        ...new Set(
          support.map(
            (item) =>
              item.authorizationGeneration ?? snapshot.authorizationGeneration,
          ),
        ),
      ].sort((a, b) => a - b),
      window: {
        start: snapshot.windowStart,
        end: snapshot.windowEnd,
        executionCutoff: snapshot.executionCutoff,
      },
      capabilityId,
      calculationIdentity,
      inputManifest: capabilityInputManifest,
      availability: support.length > 0 ? "AVAILABLE" : "UNAVAILABLE",
      coverage: { supportEvidenceCount: support.length },
      result: relevant,
      supportingEvidenceRefs: support.map((item) => item.evidenceRef).sort(),
    } as const;
    const valueHash = digest(canonicalJson(payload));
    const contentHash = digest(canonicalJson({ ...payload, valueHash }));
    const semanticKey = asSemanticObservationKey(
      `instagram-c2:${capabilityId}:${calculationIdentity}`,
    );
    const evidenceRef = asEvidenceRef(
      `evidence:instagram:c2:${digest(`${capabilityId}:${calculationIdentity}:${valueHash}`)}`,
    );
    const anchor = support[0]!;
    return this.prisma.$transaction(async (tx) => {
      const repositories = createDataExtractionRepositorySet(tx);
      const anchorEvidence = await repositories.evidenceItems.findByRef(
        asBrandId(snapshot.brandId),
        asEvidenceRef(anchor.evidenceRef),
      );
      if (
        !anchorEvidence ||
        anchorEvidence.capabilityId !== capabilityId ||
        anchorEvidence.sourceClass !== "INSTAGRAM_OWNED"
      )
        throw persistenceError("PERSISTENCE_INVARIANT");
      await repositories.evidenceItems.insertOrGetExact({
        brandId: asBrandId(snapshot.brandId),
        evidenceRef,
        capabilityId: capabilityId as never,
        normalizationContractVersion: INSTAGRAM_C2_CALCULATION_CONTRACT,
        resourceRef: anchorEvidence.resourceRef,
        captureRef: anchorEvidence.captureRef,
        sourceClass: "INSTAGRAM_OWNED" as never,
        resourceType: anchorEvidence.resourceType,
        capturedAt: anchorEvidence.capturedAt,
        freshnessAtEmission: {
          state: "CURRENT",
          basis: "C2_DETERMINISTIC_DERIVATION_AT_EXECUTION_CUTOFF",
          evaluatedAt: snapshot.executionCutoff,
        },
        representativeness: "CONTEXT_SPECIFIC",
        coverageSnapshot: anchorEvidence.coverageSnapshot,
        qualitySnapshot: anchorEvidence.qualitySnapshot,
        provenance: {
          acquisitionOrNormalizationRunRef: `instagram-c2:${calculationIdentity}`,
          captureMethodClass: "DETERMINISTIC_DERIVATION",
          normalizationContractVersion: INSTAGRAM_C2_CALCULATION_CONTRACT,
          parentEvidenceRefs: support
            .map((item) => asEvidenceRef(item.evidenceRef))
            .sort(),
          parentCaptureRefs: [
            ...new Set(support.map((item) => item.captureRef)),
          ].sort() as never,
        },
        deduplication: {
          itemFingerprint: valueHash,
          repetitionCount: 1,
          supportingResourceRefs: [anchorEvidence.resourceRef],
        },
        boundedNormalizedPayload: { ...payload, valueHash },
        contentHash,
        semanticObservationKey: semanticKey,
        relationshipRefs: [],
      });
      await repositories.semanticObservations.createOrGet(
        asBrandId(snapshot.brandId),
        semanticKey,
        capabilityId as never,
      );
      for (const source of support) {
        await repositories.semanticObservations.attachSupport(
          asBrandId(snapshot.brandId),
          semanticKey,
          asEvidenceRef(source.evidenceRef),
        );
      }
      return {
        capabilityId,
        semanticObservationKey: semanticKey,
        derivedEvidenceRef: evidenceRef,
        calculationIdentity,
        valueHash,
        supportEvidenceRefs: support.map((item) => item.evidenceRef).sort(),
      };
    });
  }
}

function capabilityProjection(
  capabilityId: string,
  result: ReturnType<typeof calculateC2Foundations> & {
    snapshotFoundations: readonly unknown[];
  },
) {
  switch (capabilityId) {
    case "instagram.media_inventory":
      return {
        corpus: result.corpus,
        metricAggregates: result.metricAggregates,
        mediaRates: result.mediaRates,
      };
    case "instagram.media_insights":
      return {
        metricAggregates: result.metricAggregates,
        mediaRates: result.mediaRates,
      };
    case "instagram.audience_followers":
      return {
        audience: result.audience.filter(
          (item) => item.population === "FOLLOWERS",
        ),
      };
    case "instagram.audience_engaged":
      return {
        audience: result.audience.filter(
          (item) => item.population === "ENGAGED_AUDIENCE",
        ),
      };
    case "instagram.account_profile":
      return {
        accountFacts: result.accountFacts,
        snapshotFoundations: result.snapshotFoundations,
      };
    default:
      return { factualEvidenceRefs: result.supportEvidenceRefs };
  }
}

function assertDates(request: InstagramC2ExecutionRequest) {
  if (
    !Number.isFinite(request.executionCutoff.getTime()) ||
    !Number.isFinite(request.windowEnd.getTime()) ||
    request.windowEnd > request.executionCutoff
  )
    throw persistenceError("PERSISTENCE_INVARIANT");
}
function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
