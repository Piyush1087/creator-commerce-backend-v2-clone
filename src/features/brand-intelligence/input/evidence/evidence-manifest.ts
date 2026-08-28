import { Injectable } from "@nestjs/common";

import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import { InputDependencyError } from "../domain/input-dependency.error";
import type {
  NormalizedEvidenceCapabilityId,
  NormalizedEvidenceSet,
} from "./intelligence-evidence.port";

export interface EvidenceDependencyManifest {
  readonly schemaVersion: "1.0";
  readonly brandId: string;
  readonly requestedCapabilities: readonly NormalizedEvidenceCapabilityId[];
  readonly capabilities: readonly Readonly<{
    capabilityExecutionRef: string | null;
    capabilityId: NormalizedEvidenceCapabilityId;
    normalizationContractVersion: string;
    status: string;
    retryability: string;
    reasonCodes: readonly string[];
    coverage: string;
    acquisitionQuality: Readonly<{
      state: string;
      failureCategories: readonly string[];
      detailCodes: readonly string[];
    }>;
    evidence: readonly Readonly<{
      evidenceRef: string;
      resourceRef: string;
      resourceType: string;
      captureRef: string;
      captureVersion: string;
      sourceClass: string;
      capturedAt: string;
      freshness: Readonly<{
        state: string;
        basis: string;
        priorCaptureRef?: string | null;
        sourceRevisionRef?: string | null;
      }>;
      representativeness: string;
      coverage: string;
      acquisitionQuality: Readonly<{
        state: string;
        failureCategories: readonly string[];
        detailCodes: readonly string[];
      }>;
      provenance: Readonly<{
        acquisitionOrNormalizationRunRef: string;
        captureMethodClass: string;
        normalizationContractVersion: string;
        parentEvidenceRefs: readonly string[];
        parentCaptureRefs: readonly string[];
      }>;
      deduplication: Readonly<{
        itemFingerprint: string;
        equivalentPriorEvidenceRef?: string | null;
        repetitionCount: number;
        supportingResourceRefs: readonly string[];
      }>;
      normalizedContentRef?: string;
      contentHash: string;
      polarity?: string;
      conflictGroupRef?: string;
    }>[];
  }>[];
}

const PROVIDER_IDENTITY_PREFIX =
  /^(zyte|playwright|gemini|openai|anthropic)[-_:./]/i;
const RAW_PAYLOAD_KEYS = new Set([
  "rawPayload",
  "rawProviderPayload",
  "providerPayload",
  "pagePayload",
]);

@Injectable()
export class EvidenceManifestBuilder {
  build(
    evidenceSet: NormalizedEvidenceSet,
    requestedCapabilities: readonly NormalizedEvidenceCapabilityId[],
  ): Readonly<{ manifest: EvidenceDependencyManifest; hash: string }> {
    rejectRawPayloadKeys(evidenceSet);
    const requested = [...new Set(requestedCapabilities)].sort();
    const byCapability = new Map(
      evidenceSet.capabilityResults.map((result) => [
        result.capabilityId,
        result,
      ]),
    );
    if (
      byCapability.size !== evidenceSet.capabilityResults.length ||
      requested.some((capability) => !byCapability.has(capability)) ||
      evidenceSet.capabilityResults.some(
        (result) => !requested.includes(result.capabilityId),
      )
    ) {
      throw new InputDependencyError(
        "EVIDENCE_CAPABILITY_NOT_ALLOWED",
        "Evidence results must exactly match the requested capability scope",
      );
    }

    const capabilities = requested.map((capabilityId) => {
      const result = byCapability.get(capabilityId)!;
      const hasDurableExecutionRef =
        typeof result.capabilityExecutionRef === "string" &&
        result.capabilityExecutionRef.trim().length > 0;
      if (
        (result.status === "NOT_REQUESTED" &&
          (result.capabilityExecutionRef !== null ||
            result.evidence.length !== 0)) ||
        (result.status !== "NOT_REQUESTED" && !hasDurableExecutionRef)
      ) {
        throw new InputDependencyError(
          "EVIDENCE_REFERENCE_INVALID",
          "Evidence capability lineage must be null only for NOT_REQUESTED results",
          { capabilityId },
        );
      }
      if (PROVIDER_IDENTITY_PREFIX.test(result.capabilityId)) {
        throw new InputDependencyError(
          "EVIDENCE_REFERENCE_INVALID",
          "Provider identity cannot define a semantic Evidence capability",
        );
      }
      const evidence = result.evidence
        .map((item) => {
          if (
            item.brandId !== evidenceSet.brandId ||
            item.capabilityId !== capabilityId
          ) {
            throw new InputDependencyError(
              "TENANCY_VIOLATION",
              "Evidence references must remain within one Brand and capability",
              { evidenceRef: item.evidenceRef },
            );
          }
          if (
            PROVIDER_IDENTITY_PREFIX.test(item.evidenceRef) ||
            PROVIDER_IDENTITY_PREFIX.test(item.captureRef) ||
            PROVIDER_IDENTITY_PREFIX.test(item.resourceRef)
          ) {
            throw new InputDependencyError(
              "EVIDENCE_REFERENCE_INVALID",
              "Provider request identity cannot serve as semantic Evidence identity",
              { evidenceRef: item.evidenceRef },
            );
          }
          return {
            evidenceRef: item.evidenceRef,
            resourceRef: item.resourceRef,
            resourceType: item.resourceType,
            captureRef: item.captureRef,
            captureVersion: item.captureVersion,
            sourceClass: item.sourceClass,
            capturedAt: item.capturedAt,
            // A repeated evaluation with the same state/basis is not new
            // Evidence, so evaluatedAt remains transient.
            freshness: {
              state: item.freshness.state,
              basis: item.freshness.basis,
              ...(item.freshness.priorCaptureRef !== undefined
                ? { priorCaptureRef: item.freshness.priorCaptureRef }
                : {}),
              ...(item.freshness.sourceRevisionRef !== undefined
                ? { sourceRevisionRef: item.freshness.sourceRevisionRef }
                : {}),
            },
            representativeness: item.representativeness,
            coverage: item.coverage,
            acquisitionQuality: {
              state: item.acquisitionQuality.state,
              failureCategories: [
                ...item.acquisitionQuality.failureCategories,
              ].sort(),
              detailCodes: [...item.acquisitionQuality.detailCodes].sort(),
            },
            provenance: {
              acquisitionOrNormalizationRunRef:
                item.provenance.acquisitionOrNormalizationRunRef,
              captureMethodClass: item.provenance.captureMethodClass,
              normalizationContractVersion:
                item.provenance.normalizationContractVersion,
              parentEvidenceRefs: [
                ...item.provenance.parentEvidenceRefs,
              ].sort(),
              parentCaptureRefs: [...item.provenance.parentCaptureRefs].sort(),
            },
            deduplication: {
              itemFingerprint: item.deduplication.itemFingerprint,
              ...(item.deduplication.equivalentPriorEvidenceRef !== undefined
                ? {
                    equivalentPriorEvidenceRef:
                      item.deduplication.equivalentPriorEvidenceRef,
                  }
                : {}),
              repetitionCount: item.deduplication.repetitionCount,
              supportingResourceRefs: [
                ...item.deduplication.supportingResourceRefs,
              ].sort(),
            },
            ...(item.normalizedContentRef
              ? { normalizedContentRef: item.normalizedContentRef }
              : {}),
            contentHash: item.contentHash,
            ...(item.polarity ? { polarity: item.polarity } : {}),
            ...(item.conflictGroupRef
              ? { conflictGroupRef: item.conflictGroupRef }
              : {}),
          };
        })
        .sort((left, right) =>
          left.evidenceRef.localeCompare(right.evidenceRef),
        );
      if (
        new Set(evidence.map((item) => item.evidenceRef)).size !==
        evidence.length
      ) {
        throw new InputDependencyError(
          "EVIDENCE_REFERENCE_INVALID",
          "Evidence references must be unique within a capability result",
          { capabilityId },
        );
      }
      return {
        capabilityExecutionRef: result.capabilityExecutionRef,
        capabilityId,
        normalizationContractVersion: result.normalizationContractVersion,
        status: result.status,
        retryability: result.retryability,
        reasonCodes: [...result.reasonCodes].sort(),
        coverage: result.coverage,
        acquisitionQuality: {
          state: result.acquisitionQuality.state,
          failureCategories: [
            ...result.acquisitionQuality.failureCategories,
          ].sort(),
          detailCodes: [...result.acquisitionQuality.detailCodes].sort(),
        },
        evidence,
      };
    });
    const manifest: EvidenceDependencyManifest = {
      schemaVersion: "1.0",
      brandId: evidenceSet.brandId,
      requestedCapabilities: requested,
      capabilities,
    };
    return { manifest, hash: sha256CanonicalExecution(manifest) };
  }
}

function rejectRawPayloadKeys(
  value: unknown,
  visited = new Set<object>(),
): void {
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  for (const [key, nested] of Object.entries(value as object)) {
    if (RAW_PAYLOAD_KEYS.has(key)) {
      throw new InputDependencyError(
        "EVIDENCE_REFERENCE_INVALID",
        "Raw provider/page payload is forbidden at the Intelligence Evidence boundary",
        { key },
      );
    }
    rejectRawPayloadKeys(nested, visited);
  }
}
