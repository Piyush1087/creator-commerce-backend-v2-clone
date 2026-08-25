import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../prisma/prisma.service";
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
} from "../domain/evidence-vocabulary";
import { persistenceError } from "../persistence/evidence-persistence.errors";
import { DataExtractionPersistenceService } from "../persistence/prisma-evidence-repositories";
import {
  normalizerFor,
  type DataExtractionNormalizationSource,
  type NormalizedEvidenceDraft,
} from "./owned-website-wave1-normalizers";

export interface DataExtractionNormalizationRequestV1 {
  readonly brandId: BrandId;
  readonly capabilityExecutionRef: CapabilityExecutionRef;
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
    if (!execution.completedAt) {
      throw new Error(
        "DE_NORMALIZATION_REQUIRES_TERMINAL_ACQUISITION_EXECUTION",
      );
    }

    const sources = await this.loadExplicitSources(execution);
    const parentEvidence = await this.loadParentEvidence(request.brandId);
    const normalizer = normalizerFor(execution.capabilityId);
    const normalized = normalizer.normalize({
      execution,
      sources,
      parentEvidence,
    });

    const evidenceRecords = normalized.drafts.map((draft) =>
      this.toEvidenceRecord(execution, draft),
    );

    const persisted = await this.persistence.withTransaction(async (tx) => {
      const records: DataExtractionEvidenceItemRecord[] = [];
      for (const record of evidenceRecords) {
        const item = await tx.evidenceItems.insertOrGetExact(record);
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
        records.push(item);
      }

      await this.persistConflicts(
        tx.semanticObservations,
        request.brandId,
        normalized.drafts,
      );
      return records;
    });

    const evidenceRefs =
      await repositories.capabilityEvidence.listEvidenceForExecution(
        request.brandId,
        execution.capabilityExecutionRef,
      );

    return {
      capabilityExecutionRef: execution.capabilityExecutionRef,
      availability: this.normalizationAvailability(
        execution,
        sources.length,
        persisted.length,
      ),
      evidenceRefs,
      reasonCodes: normalized.reasonCodes,
    };
  }

  private async loadExplicitSources(
    execution: DataExtractionCapabilityExecutionRecord,
  ): Promise<readonly DataExtractionNormalizationSource[]> {
    const rows = await this.prisma.dataExtractionCapture.findMany({
      where: {
        brandId: execution.brandId,
        resourceRef: { in: [...execution.resourceScope] },
        capturedAt: { not: null, lte: new Date(execution.completedAt!) },
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
      if (!normalizedText) continue;
      const freshness = await this.freshnessFor(
        execution.brandId,
        capture.captureRef,
        resource.resourceRef,
        capture.capturedAt,
      );
      sources.push({
        resource,
        capture,
        ...(normalized
          ? { normalizedContentRef: normalized.contentArtifactRef }
          : sourceBody
            ? { normalizedContentRef: sourceBody.contentArtifactRef }
            : {}),
        normalizedText: normalizedText.slice(0, 15_000),
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
      sourceClass: draft.source.resource.sourceClass,
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
        if (
          conflictSignature(left.semanticText) !==
          conflictSignature(right.semanticText)
        )
          continue;
        if (!opposes(left.polarity, right.polarity)) continue;
        await observations.relateConflict(
          brandId,
          left.semanticObservationKey,
          right.semanticObservationKey,
        );
      }
    }
  }

  private normalizationAvailability(
    execution: DataExtractionCapabilityExecutionRecord,
    sourceCount: number,
    evidenceCount: number,
  ): CapabilityAvailability {
    if (sourceCount === 0) return "UNAVAILABLE";
    if (
      execution.capabilityId === "derived_communication_constraint_evidence" &&
      evidenceCount === 0
    ) {
      return "AVAILABLE";
    }
    if (execution.availability === "UNAVAILABLE") return "UNAVAILABLE";
    if (execution.availability === "DEGRADED") return "DEGRADED";
    if (execution.availability === "PARTIAL") return "PARTIAL";
    return "AVAILABLE";
  }
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
