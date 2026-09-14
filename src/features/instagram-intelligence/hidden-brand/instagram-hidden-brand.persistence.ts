import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  IntelligenceAuthority,
  IntelligenceEvidenceFreshness,
  IntelligenceFreshness,
  IntelligenceNodeKind,
  IntelligenceProducerKind,
  IntelligenceReadiness,
  IntelligenceValueState,
  Prisma,
} from "@prisma/client";

import { sha256CanonicalExecution } from "../../brand-intelligence/execution/domain/execution-hash";
import type {
  ClaimedProcessorWork,
  ProcessorExecutionResult,
} from "../../brand-intelligence/execution/domain/intelligence-execution.types";
import { ProcessorExecutorFailure } from "../../brand-intelligence/execution/executor/processor-executor";
import type { ProcessorSuccessPersistenceHook } from "../../brand-intelligence/execution/processor-persistence.hook";
import {
  IntelligenceGenerationRepository,
  type ComponentGenerationWrite,
  type EvidenceReferenceWrite,
} from "../../brand-intelligence/persistence/intelligence-generation.repository";
import { ComponentPathCodec } from "../../brand-intelligence/semantic-path/component-path.codec";
import { sourceIdentityFromManifest } from "./instagram-brand-source-profile";

type RecordValue = Readonly<Record<string, unknown>>;
type ScopeAddress = Readonly<{
  objectSemanticId: string;
  pathSchemeVersion: number;
  componentSemanticPath: string;
}>;

const PROCESSOR_PAYLOADS = {
  brand_character: "BRAND_CHARACTER_V1",
  brand_communication: "BRAND_COMMUNICATION_V1",
  visual_style_synthesis: "VISUAL_STYLE_V1",
} as const;
const OBJECT_CONTRACTS: Readonly<Record<string, string>> = {
  brand_values: "objects",
  brand_personality: "objects",
  communication_profile: "objects",
  visual_style_profile: "visual_identity_objects",
};

@Injectable()
export class InstagramHiddenBrandPersistenceHook implements ProcessorSuccessPersistenceHook {
  constructor(
    private readonly generations: IntelligenceGenerationRepository,
    private readonly paths: ComponentPathCodec,
  ) {}

  async persistBeforeCompletion(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
  ): Promise<void> {
    const execution = claim.processorExecution;
    const identity = sourceIdentityFromManifest(execution);
    const expectedKind =
      PROCESSOR_PAYLOADS[
        execution.processorId as keyof typeof PROCESSOR_PAYLOADS
      ];
    if (!identity || !expectedKind)
      this.invalid("INSTAGRAM_HIDDEN_BRAND_PROCESSOR_NOT_ELIGIBLE");
    const payload = record(result.persistencePayload);
    const output = record(payload?.output);
    const prepared = record(payload?.prepared);
    if (payload?.kind !== expectedKind || !output || !prepared)
      this.invalid("INSTAGRAM_HIDDEN_BRAND_PAYLOAD_INVALID");
    if (
      prepared.evidenceManifestHash !== execution.evidenceManifestHash ||
      prepared.dependencyManifestHash !== execution.dependencyManifestHash
    )
      this.invalid("INSTAGRAM_HIDDEN_BRAND_DEPENDENCY_CHANGED");

    const evidence = this.evidenceMap(prepared, execution.brandId);
    if (!evidence.size)
      this.invalid("INSTAGRAM_HIDDEN_BRAND_EVIDENCE_INSUFFICIENT");
    const scope = execution.activeScope as unknown as ScopeAddress[];
    if (
      !scope.length ||
      scope.some(
        (address) =>
          address.pathSchemeVersion !== 1 ||
          !OBJECT_CONTRACTS[address.objectSemanticId],
      )
    )
      this.invalid("INSTAGRAM_HIDDEN_BRAND_SCOPE_INVALID");

    for (const objectSemanticId of [
      ...new Set(scope.map((address) => address.objectSemanticId)),
    ].sort()) {
      const objectValue = this.objectValue(output, objectSemanticId);
      const objectMetadata = this.objectMetadata(output, objectSemanticId);
      const components: ComponentGenerationWrite[] = [];
      const references: EvidenceReferenceWrite[] = [];
      for (const address of scope.filter(
        (candidate) => candidate.objectSemanticId === objectSemanticId,
      )) {
        const value = this.valueAt(objectValue, address.componentSemanticPath);
        const metadata = this.metadataAt(
          objectMetadata,
          address.componentSemanticPath,
        );
        const refs = value == null ? [] : collectEvidenceRefs(metadata);
        if (value != null && refs.length === 0)
          this.invalid("INSTAGRAM_HIDDEN_BRAND_FIELD_LINEAGE_REQUIRED");
        if (refs.some((ref) => !evidence.has(ref)))
          this.invalid("INSTAGRAM_HIDDEN_BRAND_UNKNOWN_EVIDENCE_REF");
        const componentId = uuid(
          `${execution.id}:${objectSemanticId}:${address.componentSemanticPath}`,
        );
        const valueState =
          value == null
            ? IntelligenceValueState.EXPLICIT_NULL
            : IntelligenceValueState.VALUE;
        components.push({
          id: componentId,
          pathSchemeVersion: 1,
          componentSemanticPath: address.componentSemanticPath,
          nodeKind:
            address.componentSemanticPath === "$"
              ? IntelligenceNodeKind.OBJECT_FIELD
              : Array.isArray(value)
                ? IntelligenceNodeKind.COLLECTION
                : IntelligenceNodeKind.SCALAR,
          componentContractId: objectSemanticId,
          componentContractVersion: "1.0",
          valueState,
          valuePayload:
            valueState === IntelligenceValueState.VALUE
              ? (value as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          valueHash: sha256CanonicalExecution(
            valueState === IntelligenceValueState.VALUE
              ? value
              : { valueState },
          ),
          authority: IntelligenceAuthority.CREATOR_SHOP_DERIVED,
          sourceClass: "INSTAGRAM_OWNED",
          readiness:
            valueState === IntelligenceValueState.VALUE
              ? IntelligenceReadiness.READY
              : IntelligenceReadiness.NOT_READY,
          freshnessAtGeneration: IntelligenceFreshness.CURRENT,
          metadataPayload: jsonWithSource(metadata),
          supersedesComponentGenerationId: null,
        });
        for (const ref of refs) {
          const item = evidence.get(ref)!;
          const freshness = record(item.freshness);
          references.push({
            id: uuid(`${componentId}:evidence:${ref}`),
            componentSemanticPath: address.componentSemanticPath,
            evidenceRef: ref,
            capabilityId: String(item.capabilityId),
            captureId: String(item.captureRef),
            captureVersion: sha256CanonicalExecution({
              captureIdentity: String(item.captureVersion),
            }),
            sourceClass: "INSTAGRAM_OWNED",
            capturedAt: new Date(String(item.capturedAt)),
            observedFreshness:
              freshness?.state === "CURRENT"
                ? IntelligenceEvidenceFreshness.CURRENT
                : freshness?.state === "POSSIBLY_STALE"
                  ? IntelligenceEvidenceFreshness.POSSIBLY_STALE
                  : IntelligenceEvidenceFreshness.UNKNOWN,
            evidenceManifestRef: execution.id,
            evidenceManifestHash: execution.evidenceManifestHash,
          });
        }
      }
      if (
        objectValue != null &&
        collectEvidenceRefs(objectMetadata).length === 0
      )
        this.invalid("INSTAGRAM_HIDDEN_BRAND_OBJECT_LINEAGE_REQUIRED");
      await this.generations.persistInTransaction(tx, {
        object: {
          id: uuid(`${execution.id}:${objectSemanticId}`),
          brandId: execution.brandId,
          objectSemanticId,
          objectContractId: OBJECT_CONTRACTS[objectSemanticId],
          objectContractVersion: "1.0",
          outputContractId: execution.outputContractId,
          outputContractVersion: execution.outputContractVersion,
          producerKind: IntelligenceProducerKind.PROCESSOR_OUTPUT,
          producerId: execution.processorId,
          producerVersion: execution.processorVersion,
          bundleId: execution.bundleId,
          bundleVersion: execution.bundleVersion,
          bundleHash: execution.bundleHash,
          processorExecutionId: execution.id,
          successfulAttemptId: claim.attempt.id,
          valueState:
            objectValue == null
              ? IntelligenceValueState.EXPLICIT_NULL
              : IntelligenceValueState.VALUE,
          valuePayload:
            objectValue == null
              ? Prisma.JsonNull
              : (objectValue as Prisma.InputJsonValue),
          valueHash: sha256CanonicalExecution(
            objectValue ?? { valueState: "EXPLICIT_NULL" },
          ),
          objectMetadataPayload: {
            sourceScope: identity.sourceScope,
            sourceProfileVersion: identity.sourceProfileVersion,
            providerAccountId: identity.providerAccountId,
            authorizationGeneration: identity.authorizationGeneration,
            windowStart: identity.windowStart,
            windowEnd: identity.windowEnd,
            evidenceManifestHash: execution.evidenceManifestHash,
            outputMetadata: objectMetadata ?? null,
          },
          readiness: result.readiness,
          freshnessAtGeneration: IntelligenceFreshness.CURRENT,
          activeScope: execution.activeScope as Prisma.InputJsonValue,
          activeScopeHash: execution.activeScopeHash,
          basedOnObjectGenerationId: null,
          supersedesObjectGenerationId: null,
        },
        components,
        evidenceReferences: references,
        businessStateReferences: [],
      });
    }
  }

  private evidenceMap(prepared: RecordValue, brandId: string) {
    const evidenceSet = record(prepared.evidence);
    const capabilities = Array.isArray(evidenceSet?.capabilityResults)
      ? evidenceSet.capabilityResults
      : [];
    const evidence = new Map<string, RecordValue>();
    for (const capability of capabilities) {
      const cap = record(capability);
      for (const item of Array.isArray(cap?.evidence) ? cap.evidence : []) {
        const row = record(item);
        if (
          typeof row?.evidenceRef !== "string" ||
          row.sourceClass !== "INSTAGRAM_OWNED" ||
          row.brandId !== brandId
        )
          this.invalid("INSTAGRAM_HIDDEN_BRAND_EVIDENCE_INVALID");
        evidence.set(row.evidenceRef, row);
      }
    }
    return evidence;
  }

  private objectValue(output: RecordValue, objectId: string): unknown {
    return output[objectId] ?? null;
  }

  private objectMetadata(output: RecordValue, objectId: string): unknown {
    const metadata = record(output.output_metadata);
    if (objectId === "brand_values" || objectId === "brand_personality")
      return metadata?.[objectId] ?? null;
    return metadata;
  }

  private valueAt(value: unknown, path: string): unknown {
    if (path === "$") return value ?? null;
    let cursor: unknown = value;
    for (const segment of this.paths.decode(path, 1).segments) {
      if (segment.kind !== "field") return null;
      cursor = record(cursor)?.[segment.value];
    }
    return cursor ?? null;
  }

  private metadataAt(metadata: unknown, path: string): unknown {
    if (path === "$") return metadata ?? {};
    let cursor: unknown = metadata;
    for (const segment of this.paths.decode(path, 1).segments) {
      if (segment.kind !== "field") return {};
      cursor = record(cursor)?.[segment.value];
    }
    return cursor ?? {};
  }

  private invalid(code: string): never {
    throw new ProcessorExecutorFailure({
      category: "VALIDATION_FAILURE",
      code,
    });
  }
}

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : undefined;
}

function collectEvidenceRefs(value: unknown): string[] {
  if (Array.isArray(value))
    return [...new Set(value.flatMap(collectEvidenceRefs))].sort();
  const row = record(value);
  if (!row) return [];
  return [
    ...new Set([
      ...(Array.isArray(row.evidence_refs)
        ? row.evidence_refs.filter(
            (ref): ref is string => typeof ref === "string",
          )
        : []),
      ...Object.entries(row)
        .filter(([key]) => key !== "evidence_refs")
        .flatMap(([, child]) => collectEvidenceRefs(child)),
    ]),
  ].sort();
}

function jsonWithSource(metadata: unknown): Prisma.InputJsonValue {
  return {
    ...(record(metadata) ?? {}),
    source_class: "INSTAGRAM_OWNED",
  } as Prisma.InputJsonValue;
}

function uuid(material: string): string {
  const chars = createHash("sha256")
    .update(material)
    .digest("hex")
    .slice(0, 32)
    .split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 3) | 8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
