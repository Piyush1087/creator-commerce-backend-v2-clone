import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../prisma/prisma.service";
import { ownedSiteObservationFragmentSchema } from "../acquisition/owned-site-observation-fragment";
import { isWave2Capability } from "../domain/evidence-vocabulary";
import { WAVE2_NORMALIZERS, wave2Conflict } from "./wave2/wave2-normalizers";
import {
  asEvidenceRef,
  asSemanticObservationKey,
  type BrandId,
  type CapabilityExecutionRef,
  type CaptureRef,
  type EvidenceRef,
} from "../domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionEvidenceItemRecord,
  EvidenceFreshnessSnapshot,
} from "../domain/evidence-records";
import type {
  CapabilityAvailability,
  EvidenceAcquisitionQuality,
  EvidenceCoverage,
  EvidenceRetryability,
} from "../domain/evidence-vocabulary";
import { persistenceError } from "../persistence/evidence-persistence.errors";
import { DataExtractionPersistenceService } from "../persistence/prisma-evidence-repositories";
import {
  conservativeQuality,
  normalizerFor,
  type DataExtractionNormalizationSource,
  type NormalizedEvidenceDraft,
  type DataExtractionNormalizationInput,
} from "./owned-website-wave1-normalizers";

export interface DataExtractionNormalizationRequestV1 {
  readonly brandId: BrandId;
  readonly capabilityExecutionRef: CapabilityExecutionRef;
  /** Internal application-supplied reconciliation only; never read from acquired HTML. */
  readonly locationReconciliations?: DataExtractionNormalizationInput["locationReconciliations"];
  /** Exact capture subset returned by acquisition for one application-owned Offering. */
  readonly exactOfferingScope?: DataExtractionNormalizationInput["exactOfferingScope"];
}

export interface DataExtractionNormalizationResultV1 {
  readonly capabilityExecutionRef: CapabilityExecutionRef;
  readonly availability: CapabilityAvailability;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly reasonCodes: readonly string[];
}

export interface DataExtractionCapabilityNormalizationPortV1 {
  normalize(
    request: DataExtractionNormalizationRequestV1,
  ): Promise<DataExtractionNormalizationResultV1>;
}

@Injectable()
export class OwnedWebsiteWave1NormalizationService implements DataExtractionCapabilityNormalizationPortV1 {
  constructor(
    private readonly persistence: DataExtractionPersistenceService,
    private readonly prisma: PrismaService,
  ) {}

  async normalize(
    request: DataExtractionNormalizationRequestV1,
  ): Promise<DataExtractionNormalizationResultV1> {
    const repositories = this.persistence.repositories();
    const execution = await repositories.capabilityExecutions.findByRef(
      request.brandId,
      request.capabilityExecutionRef,
    );
    if (!execution) throw persistenceError("CAPABILITY_EXECUTION_NOT_FOUND");
    await this.assertExactOfferingScope(request, execution);
    if (execution.completedAt) {
      return {
        capabilityExecutionRef: execution.capabilityExecutionRef,
        availability: execution.availability,
        evidenceRefs: execution.evidenceRefs,
        reasonCodes: execution.reasonCodes,
      };
    }

    const normalizationStartedAt = new Date();
    const sources = await this.loadExplicitSources(
      execution,
      normalizationStartedAt,
    );
    const parentEvidence = isWave2Capability(execution.capabilityId)
      ? []
      : await this.loadParentEvidence(request.brandId);
    const normalizer =
      WAVE2_NORMALIZERS.find(
        (candidate) => candidate.capabilityId === execution.capabilityId,
      ) ?? normalizerFor(execution.capabilityId);
    if (request.locationReconciliations?.length) {
      if (
        execution.capabilityId !== "owned_website.location_evidence" ||
        request.locationReconciliations.length > 96
      )
        throw persistenceError("PERSISTENCE_INVARIANT");
      const locators = new Set<string>();
      for (const mapping of request.locationReconciliations) {
        const key = `${mapping.captureRef}|${mapping.sourceLocator}`;
        if (
          locators.has(key) ||
          !sources.some(
            (source) => source.capture.captureRef === mapping.captureRef,
          ) ||
          !(await this.prisma.location.findFirst({
            where: {
              id: mapping.canonicalLocationRef,
              brandProfileId: request.brandId,
            },
            select: { id: true },
          }))
        )
          throw persistenceError("PERSISTENCE_INVARIANT");
        locators.add(key);
      }
    }
    const normalized = normalizer.normalize({
      execution,
      sources,
      parentEvidence,
      locationReconciliations: request.locationReconciliations,
      exactOfferingScope: request.exactOfferingScope,
    });
    for (const mapping of request.locationReconciliations ?? []) {
      if (
        !normalized.drafts.some(
          (draft) =>
            draft.source.capture.captureRef === mapping.captureRef &&
            draft.boundedNormalizedPayload.source_locator ===
              mapping.sourceLocator &&
            draft.boundedNormalizedPayload.canonical_location_ref ===
              mapping.canonicalLocationRef,
        )
      )
        throw persistenceError("PERSISTENCE_INVARIANT");
    }
    const boundedNormalization =
      isWave2Capability(execution.capabilityId) &&
      (sources.some((source) =>
        source.observationFragment?.limitations.some((code) =>
          /LIMIT|TRUNCATED|MALFORMED/.test(code),
        ),
      ) ||
        sources.some(
          (source) =>
            normalized.drafts.filter(
              (draft) =>
                draft.source.capture.captureRef === source.capture.captureRef,
            ).length >=
            (execution.capabilityId === "owned_website.visual_evidence"
              ? 32
              : 24),
        ));
    const normalizationReasons = boundedNormalization
      ? [...normalized.reasonCodes, "BOUNDED_NORMALIZATION_COVERAGE_LIMIT"]
      : normalized.reasonCodes;

    const evidenceRecords = normalized.drafts.map((draft) =>
      this.toEvidenceRecord(
        isWave2Capability(execution.capabilityId)
          ? { ...execution, coverage: coverageForSourceCount(sources.length) }
          : execution,
        draft,
      ),
    );
    const completion = this.semanticCompletion(
      execution,
      sources,
      evidenceRecords.length,
      normalizationReasons,
      normalizationStartedAt.toISOString(),
    );

    const completed = await this.persistence.withTransaction(async (tx) => {
      for (const record of evidenceRecords) {
        // A retained capture may already have emitted this immutable item under a
        // narrower execution scope. Reuse its historical snapshot, never rewrite it.
        const prior = isWave2Capability(execution.capabilityId)
          ? await tx.evidenceItems.findByRef(
              request.brandId,
              record.evidenceRef,
            )
          : null;
        const item = prior ?? (await tx.evidenceItems.insertOrGetExact(record));
        await tx.capabilityEvidence.attach(
          request.brandId,
          execution.capabilityExecutionRef,
          item.evidenceRef,
        );
        if (item.semanticObservationKey) {
          await tx.semanticObservations.createOrGet(
            request.brandId,
            item.semanticObservationKey,
            execution.capabilityId,
          );
          await tx.semanticObservations.attachSupport(
            request.brandId,
            item.semanticObservationKey,
            item.evidenceRef,
          );
        }
      }

      await this.persistConflicts(
        tx.semanticObservations,
        request.brandId,
        normalized.drafts,
      );
      const terminalExecution = await tx.capabilityExecutions.complete(
        request.brandId,
        execution.capabilityExecutionRef,
        completion,
      );
      return terminalExecution;
    });

    return {
      capabilityExecutionRef: execution.capabilityExecutionRef,
      availability: completed.availability,
      evidenceRefs: completed.evidenceRefs,
      reasonCodes: completed.reasonCodes,
    };
  }

  private async assertExactOfferingScope(
    request: DataExtractionNormalizationRequestV1,
    execution: DataExtractionCapabilityExecutionRecord,
  ): Promise<void> {
    const scope = request.exactOfferingScope;
    if (!scope) return;
    if (
      !scope.canonicalOfferingRef?.trim() ||
      scope.captureRefs.length === 0 ||
      scope.captureRefs.length > 8 ||
      new Set(scope.captureRefs).size !== scope.captureRefs.length ||
      ![
        "owned_website.offering_context",
        "explicit_factual_proof_or_claim_evidence",
        "derived_communication_constraint_evidence",
        "owned_website.serviceability_evidence",
        "owned_website.location_evidence",
      ].includes(execution.capabilityId)
    ) {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }
    const repositories = this.persistence.repositories();
    await repositories.canonicalOfferings.assertOwnedByBrand(
      request.brandId,
      scope.canonicalOfferingRef,
    );
    for (const captureRefValue of scope.captureRefs) {
      const capture = await repositories.captures.findByRef(
        request.brandId,
        captureRefValue as CaptureRef,
      );
      if (!capture || !execution.resourceScope.includes(capture.resourceRef)) {
        throw persistenceError("PERSISTENCE_INVARIANT");
      }
      const resource = await repositories.resources.findByRef(
        request.brandId,
        capture.resourceRef,
      );
      if (!resource || resource.pageRole !== "OFFERING_DETAIL") {
        throw persistenceError("PERSISTENCE_INVARIANT");
      }
    }
  }

  private async loadExplicitSources(
    execution: DataExtractionCapabilityExecutionRecord,
    normalizationStartedAt: Date,
  ): Promise<readonly DataExtractionNormalizationSource[]> {
    const rows = await this.prisma.dataExtractionCapture.findMany({
      where: {
        brandId: execution.brandId,
        resourceRef: { in: [...execution.resourceScope] },
        capturedAt: { not: null, lte: normalizationStartedAt },
        status: "COMPLETED",
      },
      orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
      select: {
        captureRef: true,
        resourceRef: true,
        capabilityExecutionRef: true,
      },
    });

    const chosen = new Map<string, string>();
    for (const resourceRef of execution.resourceScope) {
      const exact = rows.find(
        (row) =>
          row.resourceRef === resourceRef &&
          row.capabilityExecutionRef === execution.capabilityExecutionRef,
      );
      const asOfExecution = rows.find((row) => row.resourceRef === resourceRef);
      const selected = exact ?? asOfExecution;
      if (selected) chosen.set(resourceRef, selected.captureRef);
    }

    const repositories = this.persistence.repositories();
    const sources: DataExtractionNormalizationSource[] = [];
    for (const [resourceRef, captureRefValue] of chosen) {
      const resource = await repositories.resources.findByRef(
        execution.brandId,
        resourceRef as DataExtractionNormalizationSource["resource"]["resourceRef"],
      );
      const capture = await repositories.captures.findByRef(
        execution.brandId,
        captureRefValue as CaptureRef,
      );
      if (!resource || !capture || !capture.capturedAt) continue;
      const artifacts = await repositories.contentArtifacts.listForCapture(
        execution.brandId,
        capture.captureRef,
      );
      const normalized = [...artifacts]
        .reverse()
        .find(
          (artifact) =>
            artifact.artifactKind === "NORMALIZED_TEXT" &&
            artifact.inlineContent,
        );
      const sourceBody = [...artifacts]
        .reverse()
        .find(
          (artifact) =>
            artifact.artifactKind === "ACQUIRED_SOURCE_BODY" &&
            artifact.inlineContent,
        );
      const normalizedText =
        normalized?.inlineContent?.trim() ??
        deterministicClean(sourceBody?.inlineContent ?? "");
      const retainedFragment = artifacts.find(
        (artifact) =>
          artifact.artifactKind === "STRUCTURED_SOURCE_FRAGMENT" &&
          artifact.normalizationContractVersion ===
            "owned-site-observations/1.0",
      );
      let observationFragment: DataExtractionNormalizationSource["observationFragment"];
      if (
        isWave2Capability(execution.capabilityId) &&
        retainedFragment?.inlineContent
      ) {
        try {
          observationFragment = ownedSiteObservationFragmentSchema.parse(
            JSON.parse(retainedFragment.inlineContent) as unknown,
          );
        } catch {
          throw persistenceError("PERSISTENCE_INVARIANT");
        }
      }
      if (!normalizedText && !isWave2Capability(execution.capabilityId))
        continue;
      if (!normalizedText && !observationFragment && !sourceBody) continue;
      const freshness = await this.freshnessFor(
        execution.brandId,
        capture.captureRef,
        resource.resourceRef,
        capture.capturedAt,
      );
      sources.push({
        resource,
        capture,
        ...(isWave2Capability(execution.capabilityId) && retainedFragment
          ? { normalizedContentRef: retainedFragment.contentArtifactRef }
          : normalized
            ? { normalizedContentRef: normalized.contentArtifactRef }
            : sourceBody
              ? { normalizedContentRef: sourceBody.contentArtifactRef }
              : {}),
        normalizedText: normalizedText.slice(0, 15_000),
        ...(observationFragment ? { observationFragment } : {}),
        ...(sourceBody?.inlineContent
          ? { acquiredSourceBody: sourceBody.inlineContent.slice(0, 60_000) }
          : {}),
        freshness,
      });
    }
    return sources.sort((a, b) =>
      a.resource.resourceRef.localeCompare(b.resource.resourceRef),
    );
  }

  private async freshnessFor(
    brandId: BrandId,
    captureRef: CaptureRef,
    resourceRef: DataExtractionNormalizationSource["resource"]["resourceRef"],
    capturedAt: string,
  ): Promise<EvidenceFreshnessSnapshot> {
    const repositories = this.persistence.repositories();
    const capture = await repositories.freshnessAssessments.latestForTarget(
      brandId,
      "CAPTURE",
      captureRef,
    );
    const resource = capture
      ? null
      : await repositories.freshnessAssessments.latestForTarget(
          brandId,
          "RESOURCE",
          resourceRef,
        );
    const assessment = capture ?? resource;
    if (!assessment) {
      return {
        state: "UNKNOWN",
        evaluatedAt: capturedAt,
        basis: "NO_DURABLE_FRESHNESS_ASSESSMENT",
      };
    }
    return {
      state: assessment.state,
      evaluatedAt: assessment.evaluatedAt,
      basis: assessment.basis,
      ...(assessment.priorCaptureRef
        ? { priorCaptureRef: assessment.priorCaptureRef }
        : {}),
      ...(assessment.sourceRevisionRef
        ? { sourceRevisionRef: assessment.sourceRevisionRef }
        : {}),
    };
  }

  private async loadParentEvidence(
    brandId: BrandId,
  ): Promise<readonly DataExtractionEvidenceItemRecord[]> {
    const repositories = this.persistence.repositories();
    const [messaging, company] = await Promise.all([
      repositories.evidenceItems.listByCapability(
        brandId,
        "owned_website.brand_messaging",
      ),
      repositories.evidenceItems.listByCapability(
        brandId,
        "owned_website.brand_company_context",
      ),
    ]);
    return [...messaging, ...company];
  }

  private toEvidenceRecord(
    execution: DataExtractionCapabilityExecutionRecord,
    draft: NormalizedEvidenceDraft,
  ): DataExtractionEvidenceItemRecord {
    const evidenceRef = asEvidenceRef(
      `evidence:${hash(
        [
          execution.brandId,
          draft.source.capture.captureRef,
          execution.capabilityId,
          execution.normalizationContractVersion,
          draft.itemFingerprint,
        ].join("|"),
      )}`,
    );
    const quality = conservativeEvidenceQuality(
      draft.source.capture.acquisitionQuality,
    );
    return {
      brandId: execution.brandId,
      evidenceRef,
      capabilityId: execution.capabilityId,
      normalizationContractVersion: execution.normalizationContractVersion,
      resourceRef: draft.source.resource.resourceRef,
      captureRef: draft.source.capture.captureRef,
      sourceClass:
        execution.capabilityId === "derived_communication_constraint_evidence"
          ? "SYSTEM_DERIVATION_INPUT"
          : draft.source.resource.sourceClass,
      resourceType: draft.source.resource.resourceType,
      ...(draft.source.resource.pageRole
        ? { pageRole: draft.source.resource.pageRole }
        : {}),
      capturedAt: draft.source.capture.capturedAt!,
      freshnessAtEmission: draft.source.freshness,
      representativeness: draft.representativeness,
      coverageSnapshot: execution.coverage,
      qualitySnapshot: quality,
      provenance: {
        acquisitionOrNormalizationRunRef: execution.capabilityExecutionRef,
        captureMethodClass:
          execution.capabilityId === "derived_communication_constraint_evidence"
            ? "DETERMINISTIC_DERIVATION"
            : draft.source.capture.providerExecutionRefs.length > 0
              ? "PROVIDER_MEDIATED_FETCH"
              : "DIRECT_FETCH",
        normalizationContractVersion: execution.normalizationContractVersion,
        parentEvidenceRefs: draft.parentEvidenceRefs ?? [],
        parentCaptureRefs: [draft.source.capture.captureRef],
        ...(draft.source.capture.providerExecutionRefs[0]
          ? {
              providerExecutionRef:
                draft.source.capture.providerExecutionRefs[0],
            }
          : {}),
      },
      deduplication: {
        itemFingerprint: draft.itemFingerprint,
        repetitionCount: 1,
        supportingResourceRefs: [draft.source.resource.resourceRef],
      },
      ...(draft.source.normalizedContentRef
        ? { normalizedContentRef: draft.source.normalizedContentRef }
        : {}),
      boundedNormalizedPayload: draft.boundedNormalizedPayload,
      contentHash: hash(draft.semanticText),
      ...(draft.polarity ? { polarity: draft.polarity } : {}),
      semanticObservationKey: draft.semanticObservationKey,
      relationshipRefs: [],
    };
  }

  private async persistConflicts(
    observations: ReturnType<
      DataExtractionPersistenceService["repositories"]
    >["semanticObservations"],
    brandId: BrandId,
    drafts: readonly NormalizedEvidenceDraft[],
  ): Promise<void> {
    for (let leftIndex = 0; leftIndex < drafts.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < drafts.length;
        rightIndex += 1
      ) {
        const left = drafts[leftIndex]!;
        const right = drafts[rightIndex]!;
        if (left.semanticObservationKey === right.semanticObservationKey)
          continue;
        const wave2 = wave2Conflict(left, right);
        if (
          !wave2 &&
          (conflictSignature(left.semanticText) !==
            conflictSignature(right.semanticText) ||
            left.boundedNormalizedPayload.subject_scope !==
              right.boundedNormalizedPayload.subject_scope)
        )
          continue;
        if (!wave2 && !opposes(left.polarity, right.polarity)) continue;
        await observations.relateConflict(
          brandId,
          left.semanticObservationKey,
          right.semanticObservationKey,
        );
      }
    }
  }

  private semanticCompletion(
    execution: DataExtractionCapabilityExecutionRecord,
    sources: readonly DataExtractionNormalizationSource[],
    evidenceCount: number,
    reasonCodes: readonly string[],
    completedAt: string,
  ): {
    readonly availability: CapabilityAvailability;
    readonly retryability: EvidenceRetryability;
    readonly reasonCodes: readonly string[];
    readonly coverage: EvidenceCoverage;
    readonly acquisitionQuality: EvidenceAcquisitionQuality;
    readonly completedAt: string;
  } {
    const baseAvailability = this.normalizationAvailability(
      execution,
      sources,
      evidenceCount,
    );
    const availability =
      baseAvailability === "AVAILABLE" &&
      reasonCodes.includes("BOUNDED_NORMALIZATION_COVERAGE_LIMIT")
        ? "PARTIAL"
        : baseAvailability;
    return {
      availability,
      retryability:
        availability === "UNAVAILABLE" ? "RETRYABLE" : "NOT_APPLICABLE",
      reasonCodes:
        sources.length === 0
          ? [...new Set([...reasonCodes, "NO_DURABLE_NORMALIZATION_SOURCE"])]
          : [...reasonCodes],
      coverage: coverageForSourceCount(sources.length),
      acquisitionQuality:
        isWave2Capability(execution.capabilityId) &&
        sources.length > 0 &&
        sources.length < execution.resourceScope.length
          ? {
              ...conservativeQuality(sources),
              state: "PARTIAL",
              detailCodes: [
                ...conservativeQuality(sources).detailCodes,
                "SELECTED_RESOURCE_UNAVAILABLE",
              ],
            }
          : conservativeQuality(sources),
      completedAt,
    };
  }

  private normalizationAvailability(
    execution: DataExtractionCapabilityExecutionRecord,
    sources: readonly DataExtractionNormalizationSource[],
    evidenceCount: number,
  ): CapabilityAvailability {
    if (sources.length === 0) return "UNAVAILABLE";
    if (isWave2Capability(execution.capabilityId)) {
      const state = conservativeQuality(sources).state;
      if (state === "DEGRADED") return "DEGRADED";
      if (
        state === "PARTIAL" ||
        sources.length < execution.resourceScope.length
      )
        return "PARTIAL";
      // DOM-only visual evidence is explicitly a useful partial observation, not full visual coverage.
      if (execution.capabilityId === "owned_website.visual_evidence")
        return evidenceCount ? "PARTIAL" : "UNAVAILABLE";
      return "AVAILABLE";
    }
    if (
      execution.capabilityId === "derived_communication_constraint_evidence" &&
      evidenceCount === 0
    ) {
      return "AVAILABLE";
    }
    if (
      execution.capabilityId === "owned_website.brand_company_context" &&
      !sources.some((source) =>
        [
          "ABOUT_COMPANY",
          "BRAND_STORY",
          "MISSION_VALUES",
          "COMPANY_OVERVIEW",
        ].includes(source.resource.pageRole ?? "OTHER"),
      )
    ) {
      return "PARTIAL";
    }
    if (
      execution.capabilityId === "owned_website.offering_context" &&
      !sources.some((source) =>
        [
          "PORTFOLIO_OVERVIEW",
          "CATEGORY_OVERVIEW",
          "SERVICE_OVERVIEW",
          "SOLUTIONS_OVERVIEW",
          "PRICING_PLANS",
          "OFFERING_DETAIL",
        ].includes(source.resource.pageRole ?? "OTHER"),
      )
    ) {
      return "PARTIAL";
    }
    const quality = conservativeQuality(sources).state;
    if (quality === "DEGRADED") return "DEGRADED";
    if (quality === "PARTIAL") return "PARTIAL";
    return "AVAILABLE";
  }
}

function coverageForSourceCount(count: number): EvidenceCoverage {
  if (count <= 1) return "SINGLE_RESOURCE";
  if (count === 2) return "MULTI_RESOURCE_PARTIAL";
  return "MULTI_RESOURCE_BROAD";
}

function conservativeEvidenceQuality(
  source: EvidenceAcquisitionQuality,
): EvidenceAcquisitionQuality {
  return {
    state: source.state,
    failureCategories: [...source.failureCategories],
    detailCodes: [...source.detailCodes],
  };
}

function deterministicClean(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15_000);
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function conflictSignature(value: string): string {
  return value
    .toLowerCase()
    .replace(
      /\b(must not|do not|does not|don't|doesn't|never|not|cannot|can't)\b/g,
      "",
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function opposes(
  left: NormalizedEvidenceDraft["polarity"],
  right: NormalizedEvidenceDraft["polarity"],
): boolean {
  const negative = new Set(["EXPLICIT_NEGATIVE", "RESTRICTION"]);
  return (
    negative.has(left ?? "AFFIRMATIVE") !== negative.has(right ?? "AFFIRMATIVE")
  );
}
