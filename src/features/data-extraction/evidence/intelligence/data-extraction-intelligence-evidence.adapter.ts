import { Inject, Injectable } from "@nestjs/common";

import type {
  IntelligenceEvidenceReadRequest,
  IntelligenceEvidenceReader,
  NormalizedEvidenceCapabilityResult,
  NormalizedEvidenceReference,
  NormalizedEvidenceSet,
} from "../../../brand-intelligence/input/evidence/intelligence-evidence.port";
import { asBrandId } from "../domain/evidence-identities";
import type { DataExtractionEvidenceItemRecord } from "../domain/evidence-records";
import { WAVE1_EVIDENCE_CAPABILITIES } from "../domain/evidence-vocabulary";
import {
  DATA_EXTRACTION_EVIDENCE_QUERY_PORT_V1,
  type DataExtractionCapabilityReadResultV1,
  type DataExtractionEvidenceQueryPortV1,
} from "../ports/evidence-runtime.ports";

@Injectable()
export class DataExtractionIntelligenceEvidenceAdapter implements IntelligenceEvidenceReader {
  constructor(
    @Inject(DATA_EXTRACTION_EVIDENCE_QUERY_PORT_V1)
    private readonly evidenceQuery: DataExtractionEvidenceQueryPortV1,
  ) {}

  async read(
    request: IntelligenceEvidenceReadRequest,
  ): Promise<NormalizedEvidenceSet> {
    this.assertRequest(request);
    const result = await this.evidenceQuery.readExisting({
      brandId: asBrandId(request.brandId),
      capabilityIds: request.capabilityIds,
      consumerContext: {
        processorId: request.processorId,
        processorVersion: request.processorVersion,
      },
    });
    const byCapability = new Map(
      result.capabilityResults.map((capability) => [
        capability.state === "COMPLETED"
          ? capability.capabilityExecution.capabilityId
          : capability.capabilityId,
        capability,
      ]),
    );
    const capabilityResults = [...new Set(request.capabilityIds)].map(
      (capabilityId) => {
        const capability = byCapability.get(capabilityId);
        if (!capability) throw new Error("DE_QUERY_RESULT_SCOPE_INCOMPLETE");
        return this.projectCapability(capability);
      },
    );
    return { brandId: result.brandId, capabilityResults };
  }

  private projectCapability(
    result: DataExtractionCapabilityReadResultV1,
  ): NormalizedEvidenceCapabilityResult {
    if (result.state === "NOT_REQUESTED") {
      // The frozen Intelligence envelope has no absent version/coverage enum;
      // these are result defaults, not manufactured execution lineage.
      return {
        capabilityExecutionRef: null,
        capabilityId: result.capabilityId,
        normalizationContractVersion: "1.0",
        status: "NOT_REQUESTED",
        retryability: "NOT_APPLICABLE",
        reasonCodes: ["NO_COMPLETED_SEMANTIC_EXECUTION"],
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: {
          state: "UNAVAILABLE",
          failureCategories: [],
          detailCodes: ["NOT_REQUESTED"],
        },
        evidence: [],
      };
    }
    const execution = result.capabilityExecution;
    return {
      capabilityExecutionRef: execution.capabilityExecutionRef,
      capabilityId: execution.capabilityId,
      normalizationContractVersion: execution.normalizationContractVersion,
      status: execution.availability,
      retryability: execution.retryability,
      reasonCodes: [...execution.reasonCodes],
      coverage: execution.coverage,
      acquisitionQuality: { ...execution.acquisitionQuality },
      evidence: [...result.evidence]
        .sort(compareEvidence)
        .map((item) =>
          this.projectEvidence(item, execution.capabilityExecutionRef),
        ),
    };
  }

  private projectEvidence(
    item: DataExtractionEvidenceItemRecord,
    capabilityExecutionRef: string,
  ): NormalizedEvidenceReference {
    return {
      brandId: item.brandId,
      evidenceRef: item.evidenceRef,
      capabilityId: item.capabilityId,
      resourceRef: item.resourceRef,
      resourceType: item.resourceType,
      captureRef: item.captureRef,
      captureVersion: item.captureRef,
      sourceClass: item.sourceClass,
      capturedAt: item.capturedAt,
      freshness: { ...item.freshnessAtEmission },
      representativeness: item.representativeness,
      coverage: item.coverageSnapshot,
      acquisitionQuality: { ...item.qualitySnapshot },
      provenance: {
        ...item.provenance,
        acquisitionOrNormalizationRunRef: capabilityExecutionRef,
        parentEvidenceRefs: [...item.provenance.parentEvidenceRefs],
        parentCaptureRefs: [...item.provenance.parentCaptureRefs],
      },
      deduplication: {
        ...item.deduplication,
        supportingResourceRefs: [...item.deduplication.supportingResourceRefs],
      },
      ...(item.normalizedContentRef
        ? { normalizedContentRef: item.normalizedContentRef }
        : {}),
      ...(item.boundedNormalizedPayload
        ? { boundedNormalizedPayload: item.boundedNormalizedPayload }
        : {}),
      contentHash: item.contentHash,
      ...(item.polarity ? { polarity: item.polarity } : {}),
      ...(item.conflictGroupRef
        ? { conflictGroupRef: item.conflictGroupRef }
        : {}),
    };
  }

  private assertRequest(request: IntelligenceEvidenceReadRequest): void {
    if (
      !request.brandId ||
      !request.processorId ||
      !request.processorVersion ||
      request.capabilityIds.length === 0 ||
      request.capabilityIds.some(
        (capabilityId) => !WAVE1_EVIDENCE_CAPABILITIES.includes(capabilityId),
      )
    ) {
      throw new Error("INVALID_INTELLIGENCE_EVIDENCE_READ_REQUEST");
    }
  }
}

function compareEvidence(
  left: DataExtractionEvidenceItemRecord,
  right: DataExtractionEvidenceItemRecord,
): number {
  return (
    (left.semanticObservationKey ?? "").localeCompare(
      right.semanticObservationKey ?? "",
    ) ||
    left.resourceRef.localeCompare(right.resourceRef) ||
    left.captureRef.localeCompare(right.captureRef) ||
    left.evidenceRef.localeCompare(right.evidenceRef)
  );
}
