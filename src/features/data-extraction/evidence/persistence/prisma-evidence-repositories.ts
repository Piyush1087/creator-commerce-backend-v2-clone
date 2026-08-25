import { Injectable } from "@nestjs/common";
import {
  Prisma,
  type DataExtractionCapabilityExecution as PrismaCapabilityExecution,
  type DataExtractionCapture as PrismaCapture,
  type DataExtractionContentArtifact as PrismaContentArtifact,
  type DataExtractionEvidenceItem as PrismaEvidenceItem,
  type DataExtractionFreshnessAssessment as PrismaFreshnessAssessment,
  type DataExtractionProviderExecutionLink as PrismaProviderExecutionLink,
  type DataExtractionResource as PrismaResource,
} from "@prisma/client";
import { createHash } from "node:crypto";

import { PrismaService } from "../../../../prisma/prisma.service";
import {
  asBrandId,
  asCapabilityExecutionRef,
  asCaptureRef,
  asEvidenceRef,
  asNormalizedContentRef,
  asProviderExecutionRef,
  asResourceRef,
  asSemanticObservationKey,
  type BrandId,
  type CapabilityExecutionRef,
  type CaptureRef,
  type EvidenceRef,
  type ProviderExecutionRef,
  type ResourceRef,
  type SemanticObservationKey,
} from "../domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionCaptureRecord,
  DataExtractionContentArtifactRecord,
  DataExtractionEvidenceItemRecord,
  DataExtractionFreshnessAssessment,
  DataExtractionProviderExecutionLink,
  DataExtractionResourceRecord,
  DataExtractionSemanticObservationRecord,
  SemanticObservationRelationType,
} from "../domain/evidence-records";
import type {
  EvidenceCapabilityId,
  EvidenceSourceClass,
} from "../domain/evidence-vocabulary";
import type {
  CapabilityEvidenceRepository,
  CapabilityExecutionRepository,
  CapabilityResourceRepository,
  CaptureRepository,
  CompleteCapabilityExecutionInput,
  CompleteCaptureInput,
  ContentArtifactRepository,
  CreateCapabilityExecutionInput,
  CreateCaptureInput,
  CreateOrGetResourceInput,
  EvidenceItemRepository,
  FailCaptureInput,
  FreshnessAssessmentRepository,
  ProviderExecutionLinkRepository,
  RecordFreshnessAssessmentInput,
  ResourceRepository,
  SemanticObservationRepository,
} from "../ports/evidence-repositories";
import {
  isDataExtractionPersistenceError,
  persistenceError,
  withPersistenceErrorMapping,
} from "./evidence-persistence.errors";

type DataExtractionDb = PrismaService | Prisma.TransactionClient;

type CaptureRow = Prisma.DataExtractionCaptureGetPayload<{
  include: { providerExecutionLinks: true };
}>;

type CapabilityExecutionRow =
  Prisma.DataExtractionCapabilityExecutionGetPayload<{
    include: { resourceScope: true; evidenceMemberships: true };
  }>;

type ObservationRow = Prisma.DataExtractionSemanticObservationGetPayload<{
  include: {
    supports: true;
    outgoingRelations: true;
    incomingRelations: true;
  };
}>;

type EvidenceRow = Prisma.DataExtractionEvidenceItemGetPayload<{
  include: {
    resource: true;
    capture: { include: { providerExecutionLinks: true } };
    capabilityMemberships: true;
  };
}>;

function canonicalResourceKeyHash(canonicalResourceKey: string): string {
  return createHash("sha256").update(canonicalResourceKey).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameQuality(
  row: {
    acquisitionQuality: string;
    qualityFailureCategories: readonly string[];
    qualityDetailCodes: readonly string[];
  },
  quality: DataExtractionCaptureRecord["acquisitionQuality"],
): boolean {
  return (
    row.acquisitionQuality === quality.state &&
    sameStrings(row.qualityFailureCategories, quality.failureCategories) &&
    sameStrings(row.qualityDetailCodes, quality.detailCodes)
  );
}

function toResource(row: PrismaResource): DataExtractionResourceRecord {
  return {
    brandId: asBrandId(row.brandId),
    resourceRef: asResourceRef(row.resourceRef),
    sourceClass: row.sourceClass,
    resourceType: row.resourceType,
    canonicalResourceKey: row.canonicalResourceKey,
    canonicalUrl: row.canonicalUrl,
    aliases: [],
    ...(row.pageRole ? { pageRole: row.pageRole } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

function toCapture(row: CaptureRow): DataExtractionCaptureRecord {
  return {
    brandId: asBrandId(row.brandId),
    captureRef: asCaptureRef(row.captureRef),
    resourceRef: asResourceRef(row.resourceRef),
    ...(row.capabilityExecutionRef
      ? {
          capabilityExecutionRef: asCapabilityExecutionRef(
            row.capabilityExecutionRef,
          ),
        }
      : {}),
    acquisitionRequestKey: row.acquisitionRequestKey,
    startedAt: row.startedAt.toISOString(),
    ...(row.capturedAt ? { capturedAt: row.capturedAt.toISOString() } : {}),
    ...(row.observedAt ? { observedAt: row.observedAt.toISOString() } : {}),
    ...(row.sourceRevisionRef
      ? { sourceRevisionRef: row.sourceRevisionRef }
      : {}),
    ...(row.sourceContentHash
      ? { sourceContentHash: row.sourceContentHash }
      : {}),
    acquisitionQuality: {
      state: row.acquisitionQuality,
      failureCategories: row.qualityFailureCategories,
      detailCodes: row.qualityDetailCodes,
    },
    providerExecutionRefs: row.providerExecutionLinks.map((link) =>
      asProviderExecutionRef(link.providerExecutionRef),
    ),
  };
}

function toContentArtifact(
  row: PrismaContentArtifact,
): DataExtractionContentArtifactRecord {
  return {
    brandId: asBrandId(row.brandId),
    contentArtifactRef: asNormalizedContentRef(row.contentArtifactRef),
    captureRef: asCaptureRef(row.captureRef),
    artifactKind: row.kind,
    mediaType: row.mediaType,
    contentHash: row.contentHash,
    byteLength: row.byteLength,
    ...(row.inlineContent !== null ? { inlineContent: row.inlineContent } : {}),
    ...(row.objectStoreRef !== null
      ? { objectStoreRef: row.objectStoreRef }
      : {}),
    ...(row.normalizationContractVersion !== null
      ? { normalizationContractVersion: row.normalizationContractVersion }
      : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

function toCapabilityExecution(
  row: CapabilityExecutionRow,
): DataExtractionCapabilityExecutionRecord {
  return {
    brandId: asBrandId(row.brandId),
    capabilityExecutionRef: asCapabilityExecutionRef(
      row.capabilityExecutionRef,
    ),
    capabilityId: row.capabilityId as EvidenceCapabilityId,
    resourceScope: row.resourceScope.map((membership) =>
      asResourceRef(membership.resourceRef),
    ),
    freshnessIntent: row.freshnessIntent,
    normalizationContractVersion: row.normalizationContractVersion,
    ...(row.sourceRevisionRef
      ? { sourceRevisionRef: row.sourceRevisionRef }
      : {}),
    availability: row.availability,
    retryability: row.retryability,
    reasonCodes: row.reasonCodes,
    coverage: row.coverage,
    acquisitionQuality: {
      state: row.acquisitionQuality,
      failureCategories: row.qualityFailureCategories,
      detailCodes: row.qualityDetailCodes,
    },
    evidenceRefs: row.evidenceMemberships.map((membership) =>
      asEvidenceRef(membership.evidenceRef),
    ),
    createdAt: row.createdAt.toISOString(),
    ...(row.completedAt ? { completedAt: row.completedAt.toISOString() } : {}),
  };
}

function toFreshnessAssessment(
  row: PrismaFreshnessAssessment,
): DataExtractionFreshnessAssessment {
  return {
    brandId: asBrandId(row.brandId),
    targetType: row.targetType,
    targetRef:
      row.targetType === "RESOURCE"
        ? asResourceRef(row.targetRef)
        : row.targetType === "CAPTURE"
          ? asCaptureRef(row.targetRef)
          : asEvidenceRef(row.targetRef),
    state: row.state,
    evaluatedAt: row.evaluatedAt.toISOString(),
    basis: row.basis,
    ...(row.priorCaptureRef
      ? { priorCaptureRef: asCaptureRef(row.priorCaptureRef) }
      : {}),
    ...(row.sourceRevisionRef
      ? { sourceRevisionRef: row.sourceRevisionRef }
      : {}),
    ...(row.invalidatingRef ? { invalidatingRef: row.invalidatingRef } : {}),
  };
}

function toProviderExecutionLink(
  row: PrismaProviderExecutionLink,
): DataExtractionProviderExecutionLink {
  return {
    brandId: asBrandId(row.brandId),
    providerExecutionRef: asProviderExecutionRef(row.providerExecutionRef),
    ...(row.captureRef ? { captureRef: asCaptureRef(row.captureRef) } : {}),
    ...(row.capabilityExecutionRef
      ? {
          capabilityExecutionRef: asCapabilityExecutionRef(
            row.capabilityExecutionRef,
          ),
        }
      : {}),
    attemptRole: row.attemptRole,
  };
}

async function runAtomic<T>(
  db: DataExtractionDb,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (db instanceof PrismaService) {
    return db.$transaction(operation);
  }
  return operation(db);
}

async function ownedResource(
  db: DataExtractionDb,
  brandId: BrandId,
  resourceRef: ResourceRef,
): Promise<PrismaResource> {
  const row = await db.dataExtractionResource.findUnique({
    where: { resourceRef },
  });
  if (!row) {
    throw persistenceError("RESOURCE_NOT_FOUND");
  }
  if (row.brandId !== brandId) {
    throw persistenceError("TENANCY_VIOLATION");
  }
  return row;
}

async function ownedCapture(
  db: DataExtractionDb,
  brandId: BrandId,
  captureRef: CaptureRef,
): Promise<CaptureRow> {
  const row = await db.dataExtractionCapture.findUnique({
    where: { captureRef },
    include: { providerExecutionLinks: true },
  });
  if (!row) {
    throw persistenceError("CAPTURE_NOT_FOUND");
  }
  if (row.brandId !== brandId) {
    throw persistenceError("TENANCY_VIOLATION");
  }
  return row;
}

async function ownedCapabilityExecution(
  db: DataExtractionDb,
  brandId: BrandId,
  ref: CapabilityExecutionRef,
): Promise<CapabilityExecutionRow> {
  const row = await db.dataExtractionCapabilityExecution.findUnique({
    where: { capabilityExecutionRef: ref },
    include: { resourceScope: true, evidenceMemberships: true },
  });
  if (!row) {
    throw persistenceError("CAPABILITY_EXECUTION_NOT_FOUND");
  }
  if (row.brandId !== brandId) {
    throw persistenceError("TENANCY_VIOLATION");
  }
  return row;
}

async function ownedEvidence(
  db: DataExtractionDb,
  brandId: BrandId,
  evidenceRef: EvidenceRef,
): Promise<PrismaEvidenceItem> {
  const row = await db.dataExtractionEvidenceItem.findUnique({
    where: { evidenceRef },
  });
  if (!row) {
    throw persistenceError("EVIDENCE_NOT_FOUND");
  }
  if (row.brandId !== brandId) {
    throw persistenceError("TENANCY_VIOLATION");
  }
  return row;
}

async function findObservationRow(
  db: DataExtractionDb,
  brandId: BrandId,
  key: SemanticObservationKey,
): Promise<ObservationRow | null> {
  return db.dataExtractionSemanticObservation.findFirst({
    where: { brandId, semanticObservationKey: key },
    include: {
      supports: true,
      outgoingRelations: true,
      incomingRelations: true,
    },
  });
}

function toObservation(
  row: ObservationRow,
): DataExtractionSemanticObservationRecord {
  const equivalent = new Set<string>();
  const conflicts = new Set<string>();
  for (const relation of [...row.outgoingRelations, ...row.incomingRelations]) {
    const counterpart =
      relation.sourceObservationKey === row.semanticObservationKey
        ? relation.targetObservationKey
        : relation.sourceObservationKey;
    if (relation.relationType === "EQUIVALENT_TO") {
      equivalent.add(counterpart);
    } else {
      conflicts.add(counterpart);
    }
  }
  return {
    brandId: asBrandId(row.brandId),
    semanticObservationKey: asSemanticObservationKey(
      row.semanticObservationKey,
    ),
    capabilityId: row.capabilityId as EvidenceCapabilityId,
    supportingEvidenceRefs: row.supports.map((support) =>
      asEvidenceRef(support.evidenceRef),
    ),
    repetitionCount: row.repetitionCount,
    equivalentObservationKeys: [...equivalent].map(asSemanticObservationKey),
    conflictingObservationKeys: [...conflicts].map(asSemanticObservationKey),
    createdAt: row.createdAt.toISOString(),
  };
}

async function toEvidence(
  db: DataExtractionDb,
  row: EvidenceRow,
): Promise<DataExtractionEvidenceItemRecord> {
  if (!row.capture.capturedAt) {
    throw persistenceError("PERSISTENCE_INVARIANT");
  }

  let repetitionCount = 1;
  let supportingResourceRefs: ResourceRef[] = [asResourceRef(row.resourceRef)];
  let relationshipRefs: SemanticObservationKey[] = [];
  if (row.semanticObservationKey) {
    const observation = await findObservationRow(
      db,
      asBrandId(row.brandId),
      asSemanticObservationKey(row.semanticObservationKey),
    );
    if (observation) {
      repetitionCount = observation.repetitionCount;
      const supportRows = await db.dataExtractionObservationSupport.findMany({
        where: {
          brandId: row.brandId,
          semanticObservationKey: row.semanticObservationKey,
        },
        include: { evidence: true },
      });
      supportingResourceRefs = [
        ...new Set(supportRows.map((support) => support.evidence.resourceRef)),
      ].map(asResourceRef);
      relationshipRefs = [
        ...new Set([
          ...observation.outgoingRelations.map((relation) =>
            relation.sourceObservationKey === row.semanticObservationKey
              ? relation.targetObservationKey
              : relation.sourceObservationKey,
          ),
          ...observation.incomingRelations.map((relation) =>
            relation.sourceObservationKey === row.semanticObservationKey
              ? relation.targetObservationKey
              : relation.sourceObservationKey,
          ),
        ]),
      ].map(asSemanticObservationKey);
    }
  }

  const providerLink = row.capture.providerExecutionLinks[0];
  const capabilityExecutionRef =
    row.capabilityMemberships[0]?.capabilityExecutionRef;
  const captureMethodClass = row.capabilityId.startsWith("derived_")
    ? "DETERMINISTIC_DERIVATION"
    : providerLink
      ? "PROVIDER_MEDIATED_FETCH"
      : "DIRECT_FETCH";

  return {
    brandId: asBrandId(row.brandId),
    evidenceRef: asEvidenceRef(row.evidenceRef),
    capabilityId: row.capabilityId as EvidenceCapabilityId,
    normalizationContractVersion: row.normalizationContractVersion,
    resourceRef: asResourceRef(row.resourceRef),
    captureRef: asCaptureRef(row.captureRef),
    sourceClass: row.resource.sourceClass,
    resourceType: row.resource.resourceType,
    ...(row.resource.pageRole ? { pageRole: row.resource.pageRole } : {}),
    capturedAt: row.capture.capturedAt.toISOString(),
    freshnessAtEmission: {
      state: row.freshnessAtEmission,
      basis: row.freshnessBasis,
      evaluatedAt: row.freshnessEvaluatedAt.toISOString(),
      ...(row.freshnessPriorCaptureRef
        ? { priorCaptureRef: asCaptureRef(row.freshnessPriorCaptureRef) }
        : {}),
      ...(row.freshnessSourceRevisionRef
        ? { sourceRevisionRef: row.freshnessSourceRevisionRef }
        : {}),
    },
    representativeness: row.representativeness,
    coverageSnapshot: row.coverageSnapshot,
    qualitySnapshot: {
      state: row.qualitySnapshot,
      failureCategories: row.qualityFailureCategories,
      detailCodes: row.qualityDetailCodes,
    },
    provenance: {
      acquisitionOrNormalizationRunRef:
        capabilityExecutionRef ?? row.captureRef,
      captureMethodClass,
      normalizationContractVersion: row.normalizationContractVersion,
      parentEvidenceRefs: [],
      parentCaptureRefs: [],
      ...(providerLink
        ? {
            providerExecutionRef: asProviderExecutionRef(
              providerLink.providerExecutionRef,
            ),
          }
        : {}),
    },
    deduplication: {
      itemFingerprint: row.itemFingerprint,
      repetitionCount,
      supportingResourceRefs,
    },
    ...(row.contentArtifactRef
      ? { normalizedContentRef: asNormalizedContentRef(row.contentArtifactRef) }
      : {}),
    ...(row.boundedPayload
      ? {
          boundedNormalizedPayload: row.boundedPayload as Readonly<
            Record<string, unknown>
          >,
        }
      : {}),
    contentHash: row.contentHash,
    ...(row.polarity ? { polarity: row.polarity } : {}),
    ...(row.semanticObservationKey
      ? {
          semanticObservationKey: asSemanticObservationKey(
            row.semanticObservationKey,
          ),
        }
      : {}),
    relationshipRefs,
  };
}

export class PrismaResourceRepository implements ResourceRepository {
  constructor(private readonly db: DataExtractionDb) {}

  async createOrGet(
    input: CreateOrGetResourceInput,
  ): Promise<DataExtractionResourceRecord> {
    return withPersistenceErrorMapping(async () => {
      const hash = canonicalResourceKeyHash(input.canonicalResourceKey);
      const existing = await this.db.dataExtractionResource.findFirst({
        where: {
          brandId: input.brandId,
          sourceClass: input.sourceClass,
          canonicalResourceKeyHash: hash,
        },
      });
      if (existing) {
        if (
          existing.resourceType !== input.resourceType ||
          existing.pageRole !== (input.pageRole ?? null) ||
          existing.canonicalResourceKey !== input.canonicalResourceKey ||
          existing.canonicalUrl !== input.canonicalUrl
        ) {
          throw persistenceError("IDEMPOTENCY_CONFLICT");
        }
        return toResource(existing);
      }

      const row = await this.db.dataExtractionResource.create({
        data: {
          resourceRef: input.resourceRef,
          brandId: input.brandId,
          sourceClass: input.sourceClass,
          resourceType: input.resourceType,
          pageRole: input.pageRole,
          canonicalResourceKey: input.canonicalResourceKey,
          canonicalResourceKeyHash: hash,
          canonicalUrl: input.canonicalUrl,
        },
      });
      return toResource(row);
    });
  }

  async findByRef(
    brandId: BrandId,
    resourceRef: ResourceRef,
  ): Promise<DataExtractionResourceRecord | null> {
    return withPersistenceErrorMapping(async () => {
      const row = await this.db.dataExtractionResource.findUnique({
        where: { resourceRef },
      });
      if (!row) return null;
      if (row.brandId !== brandId) throw persistenceError("TENANCY_VIOLATION");
      return toResource(row);
    });
  }

  async findByCanonicalIdentity(
    brandId: BrandId,
    sourceClass: EvidenceSourceClass,
    canonicalResourceKey: string,
  ): Promise<DataExtractionResourceRecord | null> {
    return withPersistenceErrorMapping(async () => {
      const row = await this.db.dataExtractionResource.findFirst({
        where: {
          brandId,
          sourceClass,
          canonicalResourceKeyHash:
            canonicalResourceKeyHash(canonicalResourceKey),
        },
      });
      return row ? toResource(row) : null;
    });
  }

  async findByCanonicalKey(
    brandId: BrandId,
    canonicalResourceKey: string,
  ): Promise<DataExtractionResourceRecord | null> {
    return this.findByCanonicalIdentity(
      brandId,
      "OWNED_WEBSITE",
      canonicalResourceKey,
    );
  }

  async listForBrand(
    brandId: BrandId,
  ): Promise<readonly DataExtractionResourceRecord[]> {
    return withPersistenceErrorMapping(async () =>
      (
        await this.db.dataExtractionResource.findMany({
          where: { brandId },
          orderBy: { createdAt: "asc" },
        })
      ).map(toResource),
    );
  }

  async insert(record: DataExtractionResourceRecord): Promise<void> {
    await this.createOrGet({
      brandId: record.brandId,
      resourceRef: record.resourceRef,
      sourceClass: record.sourceClass,
      resourceType: record.resourceType,
      canonicalResourceKey: record.canonicalResourceKey,
      canonicalUrl: record.canonicalUrl,
      ...(record.pageRole ? { pageRole: record.pageRole } : {}),
    });
  }
}

export class PrismaCaptureRepository implements CaptureRepository {
  constructor(private readonly db: DataExtractionDb) {}

  async create(
    input: CreateCaptureInput,
  ): Promise<DataExtractionCaptureRecord> {
    return withPersistenceErrorMapping(async () => {
      await ownedResource(this.db, input.brandId, input.resourceRef);
      if (input.capabilityExecutionRef) {
        await ownedCapabilityExecution(
          this.db,
          input.brandId,
          input.capabilityExecutionRef,
        );
      }

      const existing = await this.db.dataExtractionCapture.findFirst({
        where: {
          brandId: input.brandId,
          acquisitionRequestKey: input.acquisitionRequestKey,
        },
        include: { providerExecutionLinks: true },
      });
      if (existing) {
        if (
          existing.resourceRef !== input.resourceRef ||
          existing.capabilityExecutionRef !==
            (input.capabilityExecutionRef ?? null)
        ) {
          throw persistenceError("IDEMPOTENCY_CONFLICT");
        }
        return toCapture(existing);
      }

      const row = await this.db.dataExtractionCapture.create({
        data: {
          captureRef: input.captureRef,
          brandId: input.brandId,
          resourceRef: input.resourceRef,
          capabilityExecutionRef: input.capabilityExecutionRef,
          acquisitionRequestKey: input.acquisitionRequestKey,
          status: "RUNNING",
          startedAt: new Date(input.startedAt),
          acquisitionQuality: input.acquisitionQuality.state,
          qualityFailureCategories: [
            ...input.acquisitionQuality.failureCategories,
          ],
          qualityDetailCodes: [...input.acquisitionQuality.detailCodes],
        },
        include: { providerExecutionLinks: true },
      });
      return toCapture(row);
    });
  }

  async findByRef(
    brandId: BrandId,
    captureRef: CaptureRef,
  ): Promise<DataExtractionCaptureRecord | null> {
    return withPersistenceErrorMapping(async () => {
      const row = await this.db.dataExtractionCapture.findUnique({
        where: { captureRef },
        include: { providerExecutionLinks: true },
      });
      if (!row) return null;
      if (row.brandId !== brandId) throw persistenceError("TENANCY_VIOLATION");
      return toCapture(row);
    });
  }

  async findByAcquisitionRequestKey(
    brandId: BrandId,
    acquisitionRequestKey: string,
  ): Promise<DataExtractionCaptureRecord | null> {
    return withPersistenceErrorMapping(async () => {
      const row = await this.db.dataExtractionCapture.findFirst({
        where: { brandId, acquisitionRequestKey },
        include: { providerExecutionLinks: true },
      });
      return row ? toCapture(row) : null;
    });
  }

  async findLatestForResource(
    brandId: BrandId,
    resourceRef: ResourceRef,
  ): Promise<DataExtractionCaptureRecord | null> {
    return withPersistenceErrorMapping(async () => {
      await ownedResource(this.db, brandId, resourceRef);
      const row = await this.db.dataExtractionCapture.findFirst({
        where: { brandId, resourceRef },
        orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
        include: { providerExecutionLinks: true },
      });
      return row ? toCapture(row) : null;
    });
  }

  private async finish(
    brandId: BrandId,
    captureRef: CaptureRef,
    targetStatus: "COMPLETED" | "FAILED",
    result: CompleteCaptureInput | FailCaptureInput,
  ): Promise<DataExtractionCaptureRecord> {
    return withPersistenceErrorMapping(async () => {
      const existing = await ownedCapture(this.db, brandId, captureRef);
      if (existing.status !== "RUNNING") {
        const sameTerminal =
          existing.status === targetStatus &&
          existing.capturedAt?.toISOString() ===
            (result.capturedAt ?? existing.capturedAt?.toISOString()) &&
          existing.observedAt?.toISOString() ===
            (result.observedAt ?? existing.observedAt?.toISOString()) &&
          existing.sourceRevisionRef === (result.sourceRevisionRef ?? null) &&
          existing.sourceContentHash === (result.sourceContentHash ?? null) &&
          sameQuality(existing, result.acquisitionQuality);
        if (sameTerminal) return toCapture(existing);
        throw persistenceError("INVALID_LIFECYCLE_TRANSITION");
      }

      const row = await this.db.dataExtractionCapture.update({
        where: { captureRef },
        data: {
          status: targetStatus,
          ...(result.capturedAt
            ? { capturedAt: new Date(result.capturedAt) }
            : {}),
          ...(result.observedAt
            ? { observedAt: new Date(result.observedAt) }
            : {}),
          sourceRevisionRef: result.sourceRevisionRef,
          sourceContentHash: result.sourceContentHash,
          acquisitionQuality: result.acquisitionQuality.state,
          qualityFailureCategories: [
            ...result.acquisitionQuality.failureCategories,
          ],
          qualityDetailCodes: [...result.acquisitionQuality.detailCodes],
        },
        include: { providerExecutionLinks: true },
      });
      return toCapture(row);
    });
  }

  async markCompleted(
    brandId: BrandId,
    captureRef: CaptureRef,
    result: CompleteCaptureInput,
  ): Promise<DataExtractionCaptureRecord> {
    return this.finish(brandId, captureRef, "COMPLETED", result);
  }

  async markFailed(
    brandId: BrandId,
    captureRef: CaptureRef,
    result: FailCaptureInput,
  ): Promise<DataExtractionCaptureRecord> {
    return this.finish(brandId, captureRef, "FAILED", result);
  }

  async insert(record: DataExtractionCaptureRecord): Promise<void> {
    await this.create({
      brandId: record.brandId,
      captureRef: record.captureRef,
      resourceRef: record.resourceRef,
      ...(record.capabilityExecutionRef
        ? { capabilityExecutionRef: record.capabilityExecutionRef }
        : {}),
      acquisitionRequestKey: record.acquisitionRequestKey,
      startedAt: record.startedAt,
      acquisitionQuality: record.acquisitionQuality,
    });
  }
}

export class PrismaContentArtifactRepository implements ContentArtifactRepository {
  constructor(private readonly db: DataExtractionDb) {}

  async findByRef(
    brandId: BrandId,
    contentRef: DataExtractionContentArtifactRecord["contentArtifactRef"],
  ): Promise<DataExtractionContentArtifactRecord | null> {
    return withPersistenceErrorMapping(async () => {
      const row = await this.db.dataExtractionContentArtifact.findUnique({
        where: { contentArtifactRef: contentRef },
      });
      if (!row) return null;
      if (row.brandId !== brandId) throw persistenceError("TENANCY_VIOLATION");
      return toContentArtifact(row);
    });
  }

  async findForCapture(
    brandId: BrandId,
    captureRef: CaptureRef,
  ): Promise<readonly DataExtractionContentArtifactRecord[]> {
    return this.listForCapture(brandId, captureRef);
  }

  async listForCapture(
    brandId: BrandId,
    captureRef: CaptureRef,
  ): Promise<readonly DataExtractionContentArtifactRecord[]> {
    return withPersistenceErrorMapping(async () => {
      await ownedCapture(this.db, brandId, captureRef);
      return (
        await this.db.dataExtractionContentArtifact.findMany({
          where: { brandId, captureRef },
          orderBy: { createdAt: "asc" },
        })
      ).map(toContentArtifact);
    });
  }

  async insert(record: DataExtractionContentArtifactRecord): Promise<void> {
    await withPersistenceErrorMapping(async () => {
      await ownedCapture(this.db, record.brandId, record.captureRef);
      if (!record.inlineContent && !record.objectStoreRef) {
        throw persistenceError("PERSISTENCE_INVARIANT");
      }
      const existing = await this.db.dataExtractionContentArtifact.findUnique({
        where: { contentArtifactRef: record.contentArtifactRef },
      });
      if (existing) {
        if (existing.brandId !== record.brandId) {
          throw persistenceError("TENANCY_VIOLATION");
        }
        if (
          existing.captureRef !== record.captureRef ||
          existing.kind !== record.artifactKind ||
          existing.mediaType !== record.mediaType ||
          existing.contentHash !== record.contentHash ||
          existing.byteLength !== record.byteLength ||
          existing.inlineContent !== (record.inlineContent ?? null) ||
          existing.objectStoreRef !== (record.objectStoreRef ?? null) ||
          existing.normalizationContractVersion !==
            (record.normalizationContractVersion ?? null)
        ) {
          throw persistenceError("IDEMPOTENCY_CONFLICT");
        }
        return;
      }
      await this.db.dataExtractionContentArtifact.create({
        data: {
          contentArtifactRef: record.contentArtifactRef,
          brandId: record.brandId,
          captureRef: record.captureRef,
          kind: record.artifactKind,
          mediaType: record.mediaType,
          contentHash: record.contentHash,
          byteLength: record.byteLength,
          inlineContent: record.inlineContent,
          objectStoreRef: record.objectStoreRef,
          normalizationContractVersion: record.normalizationContractVersion,
        },
      });
    });
  }
}

export class PrismaCapabilityExecutionRepository implements CapabilityExecutionRepository {
  constructor(private readonly db: DataExtractionDb) {}

  async createOrGet(
    input: CreateCapabilityExecutionInput,
  ): Promise<DataExtractionCapabilityExecutionRecord> {
    return withPersistenceErrorMapping(async () => {
      const existing =
        await this.db.dataExtractionCapabilityExecution.findFirst({
          where: { brandId: input.brandId, requestKey: input.requestKey },
          include: { resourceScope: true, evidenceMemberships: true },
        });
      if (existing) {
        if (
          existing.capabilityId !== input.capabilityId ||
          existing.normalizationContractVersion !==
            input.normalizationContractVersion ||
          existing.resourceScopeHash !== input.resourceScopeHash ||
          existing.freshnessIntent !== input.freshnessIntent ||
          existing.sourceRevisionRef !== (input.sourceRevisionRef ?? null) ||
          existing.coverage !== input.coverage
        ) {
          throw persistenceError("IDEMPOTENCY_CONFLICT");
        }
        return toCapabilityExecution(existing);
      }

      const row = await this.db.dataExtractionCapabilityExecution.create({
        data: {
          capabilityExecutionRef: input.capabilityExecutionRef,
          brandId: input.brandId,
          capabilityId: input.capabilityId,
          normalizationContractVersion: input.normalizationContractVersion,
          resourceScopeHash: input.resourceScopeHash,
          freshnessIntent: input.freshnessIntent,
          sourceRevisionRef: input.sourceRevisionRef,
          requestKey: input.requestKey,
          availability: "NOT_REQUESTED",
          retryability: "NOT_APPLICABLE",
          reasonCodes: [],
          coverage: input.coverage,
          acquisitionQuality: "UNAVAILABLE",
          qualityFailureCategories: [],
          qualityDetailCodes: [],
        },
        include: { resourceScope: true, evidenceMemberships: true },
      });
      return toCapabilityExecution(row);
    });
  }

  async findByRef(
    brandId: BrandId,
    ref: CapabilityExecutionRef,
  ): Promise<DataExtractionCapabilityExecutionRecord | null> {
    return withPersistenceErrorMapping(async () => {
      const row = await this.db.dataExtractionCapabilityExecution.findUnique({
        where: { capabilityExecutionRef: ref },
        include: { resourceScope: true, evidenceMemberships: true },
      });
      if (!row) return null;
      if (row.brandId !== brandId) throw persistenceError("TENANCY_VIOLATION");
      return toCapabilityExecution(row);
    });
  }

  async findByRequestKey(
    brandId: BrandId,
    requestKey: string,
  ): Promise<DataExtractionCapabilityExecutionRecord | null> {
    return withPersistenceErrorMapping(async () => {
      const row = await this.db.dataExtractionCapabilityExecution.findFirst({
        where: { brandId, requestKey },
        include: { resourceScope: true, evidenceMemberships: true },
      });
      return row ? toCapabilityExecution(row) : null;
    });
  }

  async findLatestReusable(
    brandId: BrandId,
    capabilityId: EvidenceCapabilityId,
  ): Promise<DataExtractionCapabilityExecutionRecord | null> {
    return withPersistenceErrorMapping(async () => {
      const row = await this.db.dataExtractionCapabilityExecution.findFirst({
        where: {
          brandId,
          capabilityId,
          completedAt: { not: null },
          availability: { in: ["AVAILABLE", "PARTIAL", "DEGRADED"] },
        },
        orderBy: { completedAt: "desc" },
        include: { resourceScope: true, evidenceMemberships: true },
      });
      return row ? toCapabilityExecution(row) : null;
    });
  }

  async complete(
    brandId: BrandId,
    ref: CapabilityExecutionRef,
    result: CompleteCapabilityExecutionInput,
  ): Promise<DataExtractionCapabilityExecutionRecord> {
    return withPersistenceErrorMapping(async () => {
      const existing = await ownedCapabilityExecution(this.db, brandId, ref);
      if (existing.completedAt) {
        const sameTerminal =
          existing.availability === result.availability &&
          existing.retryability === result.retryability &&
          sameStrings(existing.reasonCodes, result.reasonCodes) &&
          existing.coverage === result.coverage &&
          sameQuality(existing, result.acquisitionQuality) &&
          existing.completedAt.toISOString() === result.completedAt;
        if (sameTerminal) return toCapabilityExecution(existing);
        throw persistenceError("INVALID_LIFECYCLE_TRANSITION");
      }

      const row = await this.db.dataExtractionCapabilityExecution.update({
        where: { capabilityExecutionRef: ref },
        data: {
          availability: result.availability,
          retryability: result.retryability,
          reasonCodes: [...result.reasonCodes],
          coverage: result.coverage,
          acquisitionQuality: result.acquisitionQuality.state,
          qualityFailureCategories: [
            ...result.acquisitionQuality.failureCategories,
          ],
          qualityDetailCodes: [...result.acquisitionQuality.detailCodes],
          completedAt: new Date(result.completedAt),
        },
        include: { resourceScope: true, evidenceMemberships: true },
      });
      return toCapabilityExecution(row);
    });
  }

  async insert(record: DataExtractionCapabilityExecutionRecord): Promise<void> {
    const requestKey =
      record.correlationRef ?? `legacy:${record.capabilityExecutionRef}`;
    const resourceScopeHash = createHash("sha256")
      .update([...record.resourceScope].sort().join("\n"))
      .digest("hex");
    const created = await this.createOrGet({
      brandId: record.brandId,
      capabilityExecutionRef: record.capabilityExecutionRef,
      capabilityId: record.capabilityId,
      normalizationContractVersion: record.normalizationContractVersion,
      resourceScopeHash,
      freshnessIntent: record.freshnessIntent,
      ...(record.sourceRevisionRef
        ? { sourceRevisionRef: record.sourceRevisionRef }
        : {}),
      requestKey,
      coverage: record.coverage,
    });
    if (record.completedAt && !created.completedAt) {
      await this.complete(record.brandId, record.capabilityExecutionRef, {
        availability: record.availability,
        retryability: record.retryability,
        reasonCodes: record.reasonCodes,
        coverage: record.coverage,
        acquisitionQuality: record.acquisitionQuality,
        completedAt: record.completedAt,
      });
    }
  }
}

export class PrismaCapabilityResourceRepository implements CapabilityResourceRepository {
  constructor(private readonly db: DataExtractionDb) {}

  async attach(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
    resourceRef: ResourceRef,
  ): Promise<void> {
    await withPersistenceErrorMapping(async () => {
      const execution = await ownedCapabilityExecution(
        this.db,
        brandId,
        capabilityExecutionRef,
      );
      await ownedResource(this.db, brandId, resourceRef);
      const existing = await this.db.dataExtractionCapabilityResource.findFirst(
        {
          where: { brandId, capabilityExecutionRef, resourceRef },
        },
      );
      if (existing) return;
      await this.db.dataExtractionCapabilityResource.create({
        data: {
          brandId,
          capabilityExecutionRef,
          capabilityId: execution.capabilityId,
          resourceRef,
        },
      });
    });
  }

  async listForExecution(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
  ): Promise<readonly ResourceRef[]> {
    return withPersistenceErrorMapping(async () => {
      await ownedCapabilityExecution(this.db, brandId, capabilityExecutionRef);
      return (
        await this.db.dataExtractionCapabilityResource.findMany({
          where: { brandId, capabilityExecutionRef },
          orderBy: { createdAt: "asc" },
        })
      ).map((row) => asResourceRef(row.resourceRef));
    });
  }
}

export class PrismaEvidenceItemRepository implements EvidenceItemRepository {
  constructor(private readonly db: DataExtractionDb) {}

  private async hydrate(
    row: PrismaEvidenceItem,
  ): Promise<DataExtractionEvidenceItemRecord> {
    const full = await this.db.dataExtractionEvidenceItem.findUnique({
      where: { evidenceRef: row.evidenceRef },
      include: {
        resource: true,
        capture: { include: { providerExecutionLinks: true } },
        capabilityMemberships: true,
      },
    });
    if (!full) throw persistenceError("EVIDENCE_NOT_FOUND");
    return toEvidence(this.db, full);
  }

  async insertOrGetExact(
    record: DataExtractionEvidenceItemRecord,
  ): Promise<DataExtractionEvidenceItemRecord> {
    return withPersistenceErrorMapping(async () => {
      const resource = await ownedResource(
        this.db,
        record.brandId,
        record.resourceRef,
      );
      const capture = await ownedCapture(
        this.db,
        record.brandId,
        record.captureRef,
      );
      if (capture.resourceRef !== record.resourceRef || !capture.capturedAt) {
        throw persistenceError("PERSISTENCE_INVARIANT");
      }
      if (
        resource.sourceClass !== record.sourceClass ||
        resource.resourceType !== record.resourceType ||
        resource.pageRole !== (record.pageRole ?? null)
      ) {
        throw persistenceError("PERSISTENCE_INVARIANT");
      }
      if (record.normalizedContentRef) {
        const artifact = await this.db.dataExtractionContentArtifact.findUnique(
          {
            where: { contentArtifactRef: record.normalizedContentRef },
          },
        );
        if (!artifact) throw persistenceError("PERSISTENCE_INVARIANT");
        if (artifact.brandId !== record.brandId) {
          throw persistenceError("TENANCY_VIOLATION");
        }
        if (artifact.captureRef !== record.captureRef) {
          throw persistenceError("PERSISTENCE_INVARIANT");
        }
      }

      const existing = await this.db.dataExtractionEvidenceItem.findFirst({
        where: {
          brandId: record.brandId,
          captureRef: record.captureRef,
          capabilityId: record.capabilityId,
          normalizationContractVersion: record.normalizationContractVersion,
          itemFingerprint: record.deduplication.itemFingerprint,
        },
      });
      if (existing) {
        const exact =
          existing.resourceRef === record.resourceRef &&
          existing.contentArtifactRef ===
            (record.normalizedContentRef ?? null) &&
          canonicalJson(existing.boundedPayload) ===
            canonicalJson(record.boundedNormalizedPayload ?? null) &&
          existing.contentHash === record.contentHash &&
          existing.polarity === (record.polarity ?? null) &&
          existing.representativeness === record.representativeness &&
          existing.coverageSnapshot === record.coverageSnapshot &&
          existing.freshnessAtEmission === record.freshnessAtEmission.state &&
          existing.freshnessBasis === record.freshnessAtEmission.basis &&
          existing.freshnessEvaluatedAt.toISOString() ===
            record.freshnessAtEmission.evaluatedAt &&
          existing.freshnessPriorCaptureRef ===
            (record.freshnessAtEmission.priorCaptureRef ?? null) &&
          existing.freshnessSourceRevisionRef ===
            (record.freshnessAtEmission.sourceRevisionRef ?? null) &&
          existing.qualitySnapshot === record.qualitySnapshot.state &&
          sameStrings(
            existing.qualityFailureCategories,
            record.qualitySnapshot.failureCategories,
          ) &&
          sameStrings(
            existing.qualityDetailCodes,
            record.qualitySnapshot.detailCodes,
          ) &&
          existing.semanticObservationKey ===
            (record.semanticObservationKey ?? null);
        if (!exact) throw persistenceError("IDEMPOTENCY_CONFLICT");
        return this.hydrate(existing);
      }

      const row = await this.db.dataExtractionEvidenceItem.create({
        data: {
          evidenceRef: record.evidenceRef,
          brandId: record.brandId,
          capabilityId: record.capabilityId,
          normalizationContractVersion: record.normalizationContractVersion,
          resourceRef: record.resourceRef,
          captureRef: record.captureRef,
          contentArtifactRef: record.normalizedContentRef,
          boundedPayload: record.boundedNormalizedPayload
            ? (record.boundedNormalizedPayload as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          contentHash: record.contentHash,
          polarity: record.polarity,
          representativeness: record.representativeness,
          coverageSnapshot: record.coverageSnapshot,
          freshnessAtEmission: record.freshnessAtEmission.state,
          freshnessBasis: record.freshnessAtEmission.basis,
          freshnessEvaluatedAt: new Date(
            record.freshnessAtEmission.evaluatedAt,
          ),
          freshnessPriorCaptureRef: record.freshnessAtEmission.priorCaptureRef,
          freshnessSourceRevisionRef:
            record.freshnessAtEmission.sourceRevisionRef,
          qualitySnapshot: record.qualitySnapshot.state,
          qualityFailureCategories: [
            ...record.qualitySnapshot.failureCategories,
          ],
          qualityDetailCodes: [...record.qualitySnapshot.detailCodes],
          itemFingerprint: record.deduplication.itemFingerprint,
          semanticObservationKey: record.semanticObservationKey,
        },
      });
      return this.hydrate(row);
    });
  }

  async findByRef(
    brandId: BrandId,
    evidenceRef: EvidenceRef,
  ): Promise<DataExtractionEvidenceItemRecord | null> {
    return withPersistenceErrorMapping(async () => {
      const row = await this.db.dataExtractionEvidenceItem.findUnique({
        where: { evidenceRef },
      });
      if (!row) return null;
      if (row.brandId !== brandId) throw persistenceError("TENANCY_VIOLATION");
      return this.hydrate(row);
    });
  }

  async findByCapability(
    brandId: BrandId,
    capabilityId: EvidenceCapabilityId,
  ): Promise<readonly DataExtractionEvidenceItemRecord[]> {
    return this.listByCapability(brandId, capabilityId);
  }

  async listByCapability(
    brandId: BrandId,
    capabilityId: EvidenceCapabilityId,
  ): Promise<readonly DataExtractionEvidenceItemRecord[]> {
    return withPersistenceErrorMapping(async () => {
      const rows = await this.db.dataExtractionEvidenceItem.findMany({
        where: { brandId, capabilityId },
        orderBy: { createdAt: "asc" },
      });
      return Promise.all(rows.map((row) => this.hydrate(row)));
    });
  }

  async listByCapture(
    brandId: BrandId,
    captureRef: CaptureRef,
  ): Promise<readonly DataExtractionEvidenceItemRecord[]> {
    return withPersistenceErrorMapping(async () => {
      await ownedCapture(this.db, brandId, captureRef);
      const rows = await this.db.dataExtractionEvidenceItem.findMany({
        where: { brandId, captureRef },
        orderBy: { createdAt: "asc" },
      });
      return Promise.all(rows.map((row) => this.hydrate(row)));
    });
  }

  async insert(record: DataExtractionEvidenceItemRecord): Promise<void> {
    await this.insertOrGetExact(record);
  }
}

export class PrismaCapabilityEvidenceRepository implements CapabilityEvidenceRepository {
  constructor(private readonly db: DataExtractionDb) {}

  async attach(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
    evidenceRef: EvidenceRef,
  ): Promise<void> {
    await withPersistenceErrorMapping(async () => {
      const execution = await ownedCapabilityExecution(
        this.db,
        brandId,
        capabilityExecutionRef,
      );
      const evidence = await ownedEvidence(this.db, brandId, evidenceRef);
      if (execution.capabilityId !== evidence.capabilityId) {
        throw persistenceError("PERSISTENCE_INVARIANT");
      }
      const existing = await this.db.dataExtractionCapabilityEvidence.findFirst(
        {
          where: { brandId, capabilityExecutionRef, evidenceRef },
        },
      );
      if (existing) return;
      await this.db.dataExtractionCapabilityEvidence.create({
        data: {
          brandId,
          capabilityExecutionRef,
          capabilityId: execution.capabilityId,
          evidenceRef,
        },
      });
    });
  }

  async listEvidenceForExecution(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
  ): Promise<readonly EvidenceRef[]> {
    return withPersistenceErrorMapping(async () => {
      await ownedCapabilityExecution(this.db, brandId, capabilityExecutionRef);
      return (
        await this.db.dataExtractionCapabilityEvidence.findMany({
          where: { brandId, capabilityExecutionRef },
          orderBy: { createdAt: "asc" },
        })
      ).map((row) => asEvidenceRef(row.evidenceRef));
    });
  }
}

export class PrismaSemanticObservationRepository implements SemanticObservationRepository {
  constructor(private readonly db: DataExtractionDb) {}

  async createOrGet(
    brandId: BrandId,
    key: SemanticObservationKey,
    capabilityId: EvidenceCapabilityId,
  ): Promise<DataExtractionSemanticObservationRecord> {
    return withPersistenceErrorMapping(async () => {
      const existing = await findObservationRow(this.db, brandId, key);
      if (existing) {
        if (existing.capabilityId !== capabilityId) {
          throw persistenceError("IDEMPOTENCY_CONFLICT");
        }
        return toObservation(existing);
      }
      await this.db.dataExtractionSemanticObservation.create({
        data: {
          brandId,
          semanticObservationKey: key,
          capabilityId,
          repetitionCount: 1,
        },
      });
      const row = await findObservationRow(this.db, brandId, key);
      if (!row) throw persistenceError("PERSISTENCE_INVARIANT");
      return toObservation(row);
    });
  }

  async findByKey(
    brandId: BrandId,
    key: SemanticObservationKey,
  ): Promise<DataExtractionSemanticObservationRecord | null> {
    return withPersistenceErrorMapping(async () => {
      const row = await findObservationRow(this.db, brandId, key);
      return row ? toObservation(row) : null;
    });
  }

  async findByCapability(
    brandId: BrandId,
    capabilityId: EvidenceCapabilityId,
  ): Promise<readonly DataExtractionSemanticObservationRecord[]> {
    return withPersistenceErrorMapping(async () => {
      const rows = await this.db.dataExtractionSemanticObservation.findMany({
        where: { brandId, capabilityId },
        orderBy: { createdAt: "asc" },
        include: {
          supports: true,
          outgoingRelations: true,
          incomingRelations: true,
        },
      });
      return rows.map(toObservation);
    });
  }

  async attachSupport(
    brandId: BrandId,
    key: SemanticObservationKey,
    evidenceRef: EvidenceRef,
  ): Promise<DataExtractionSemanticObservationRecord> {
    return withPersistenceErrorMapping(async () =>
      runAtomic(this.db, async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 FROM "data_extraction_semantic_observations" WHERE "brand_id" = ${brandId} AND "semantic_observation_key" = ${key} FOR UPDATE`,
        );
        const observation = await findObservationRow(tx, brandId, key);
        if (!observation) throw persistenceError("PERSISTENCE_INVARIANT");
        const evidence = await ownedEvidence(tx, brandId, evidenceRef);
        if (observation.capabilityId !== evidence.capabilityId) {
          throw persistenceError("PERSISTENCE_INVARIANT");
        }
        const existing = await tx.dataExtractionObservationSupport.findFirst({
          where: { brandId, semanticObservationKey: key, evidenceRef },
        });
        if (!existing) {
          await tx.dataExtractionObservationSupport.create({
            data: {
              brandId,
              semanticObservationKey: key,
              capabilityId: observation.capabilityId,
              evidenceRef,
            },
          });
        }
        const distinctSupportCount =
          await tx.dataExtractionObservationSupport.count({
            where: { brandId, semanticObservationKey: key },
          });
        await tx.dataExtractionSemanticObservation.update({
          where: { id: observation.id },
          data: { repetitionCount: Math.max(1, distinctSupportCount) },
        });
        const row = await findObservationRow(tx, brandId, key);
        if (!row) throw persistenceError("PERSISTENCE_INVARIANT");
        return toObservation(row);
      }),
    );
  }

  async listSupport(
    brandId: BrandId,
    key: SemanticObservationKey,
  ): Promise<readonly EvidenceRef[]> {
    return withPersistenceErrorMapping(async () => {
      const observation = await findObservationRow(this.db, brandId, key);
      if (!observation) return [];
      return observation.supports.map((support) =>
        asEvidenceRef(support.evidenceRef),
      );
    });
  }

  private async relation(
    brandId: BrandId,
    sourceKey: SemanticObservationKey,
    targetKey: SemanticObservationKey,
    relationType: SemanticObservationRelationType,
  ): Promise<void> {
    await withPersistenceErrorMapping(async () => {
      if (sourceKey === targetKey) {
        throw persistenceError("PERSISTENCE_INVARIANT");
      }
      const [source, target] = await Promise.all([
        findObservationRow(this.db, brandId, sourceKey),
        findObservationRow(this.db, brandId, targetKey),
      ]);
      if (!source || !target) throw persistenceError("PERSISTENCE_INVARIANT");
      if (source.capabilityId !== target.capabilityId) {
        throw persistenceError("PERSISTENCE_INVARIANT");
      }
      const [left, right] =
        sourceKey.localeCompare(targetKey) <= 0
          ? [sourceKey, targetKey]
          : [targetKey, sourceKey];
      const existing =
        await this.db.dataExtractionObservationRelation.findFirst({
          where: {
            brandId,
            sourceObservationKey: left,
            targetObservationKey: right,
            relationType,
          },
        });
      if (existing) return;
      await this.db.dataExtractionObservationRelation.create({
        data: {
          brandId,
          sourceObservationKey: left,
          targetObservationKey: right,
          capabilityId: source.capabilityId,
          relationType,
        },
      });
    });
  }

  async relateEquivalent(
    brandId: BrandId,
    sourceKey: SemanticObservationKey,
    targetKey: SemanticObservationKey,
  ): Promise<void> {
    return this.relation(brandId, sourceKey, targetKey, "EQUIVALENT_TO");
  }

  async relateConflict(
    brandId: BrandId,
    sourceKey: SemanticObservationKey,
    targetKey: SemanticObservationKey,
  ): Promise<void> {
    return this.relation(brandId, sourceKey, targetKey, "CONFLICTS_WITH");
  }

  async relate(
    brandId: BrandId,
    sourceKey: SemanticObservationKey,
    targetKey: SemanticObservationKey,
    relationType: SemanticObservationRelationType,
  ): Promise<void> {
    return this.relation(brandId, sourceKey, targetKey, relationType);
  }

  async insert(record: DataExtractionSemanticObservationRecord): Promise<void> {
    await this.createOrGet(
      record.brandId,
      record.semanticObservationKey,
      record.capabilityId,
    );
    for (const evidenceRef of record.supportingEvidenceRefs) {
      await this.attachSupport(
        record.brandId,
        record.semanticObservationKey,
        evidenceRef,
      );
    }
    for (const key of record.equivalentObservationKeys) {
      await this.relateEquivalent(
        record.brandId,
        record.semanticObservationKey,
        key,
      );
    }
    for (const key of record.conflictingObservationKeys) {
      await this.relateConflict(
        record.brandId,
        record.semanticObservationKey,
        key,
      );
    }
  }
}

export class PrismaFreshnessAssessmentRepository implements FreshnessAssessmentRepository {
  constructor(private readonly db: DataExtractionDb) {}

  async record(input: RecordFreshnessAssessmentInput): Promise<void> {
    await withPersistenceErrorMapping(async () => {
      if (input.targetType === "RESOURCE") {
        await ownedResource(
          this.db,
          input.brandId,
          input.targetRef as ResourceRef,
        );
      } else if (input.targetType === "CAPTURE") {
        await ownedCapture(
          this.db,
          input.brandId,
          input.targetRef as CaptureRef,
        );
      } else {
        await ownedEvidence(
          this.db,
          input.brandId,
          input.targetRef as EvidenceRef,
        );
      }
      if (input.priorCaptureRef) {
        await ownedCapture(this.db, input.brandId, input.priorCaptureRef);
      }
      await this.db.dataExtractionFreshnessAssessment.create({
        data: {
          brandId: input.brandId,
          targetType: input.targetType,
          targetRef: input.targetRef,
          state: input.state,
          evaluatedAt: new Date(input.evaluatedAt),
          basis: input.basis,
          priorCaptureRef: input.priorCaptureRef,
          sourceRevisionRef: input.sourceRevisionRef,
          invalidatingRef: input.invalidatingRef,
        },
      });
    });
  }

  async listForTarget(
    brandId: BrandId,
    targetType: DataExtractionFreshnessAssessment["targetType"],
    targetRef: string,
  ): Promise<readonly DataExtractionFreshnessAssessment[]> {
    return withPersistenceErrorMapping(async () =>
      (
        await this.db.dataExtractionFreshnessAssessment.findMany({
          where: { brandId, targetType, targetRef },
          orderBy: [{ evaluatedAt: "asc" }, { createdAt: "asc" }],
        })
      ).map(toFreshnessAssessment),
    );
  }

  async latestForTarget(
    brandId: BrandId,
    targetType: DataExtractionFreshnessAssessment["targetType"],
    targetRef: string,
  ): Promise<DataExtractionFreshnessAssessment | null> {
    return withPersistenceErrorMapping(async () => {
      const row = await this.db.dataExtractionFreshnessAssessment.findFirst({
        where: { brandId, targetType, targetRef },
        orderBy: [{ evaluatedAt: "desc" }, { createdAt: "desc" }],
      });
      return row ? toFreshnessAssessment(row) : null;
    });
  }
}

export class PrismaProviderExecutionLinkRepository implements ProviderExecutionLinkRepository {
  constructor(private readonly db: DataExtractionDb) {}

  private async attach(
    link: DataExtractionProviderExecutionLink,
  ): Promise<void> {
    await withPersistenceErrorMapping(async () => {
      if (link.captureRef) {
        await ownedCapture(this.db, link.brandId, link.captureRef);
      }
      if (link.capabilityExecutionRef) {
        await ownedCapabilityExecution(
          this.db,
          link.brandId,
          link.capabilityExecutionRef,
        );
      }
      if (!link.captureRef && !link.capabilityExecutionRef) {
        throw persistenceError("PERSISTENCE_INVARIANT");
      }
      const existing =
        await this.db.dataExtractionProviderExecutionLink.findFirst({
          where: {
            brandId: link.brandId,
            captureRef: link.captureRef ?? null,
            capabilityExecutionRef: link.capabilityExecutionRef ?? null,
            providerExecutionRef: link.providerExecutionRef,
            attemptRole: link.attemptRole,
          },
        });
      if (existing) return;
      await this.db.dataExtractionProviderExecutionLink.create({
        data: {
          brandId: link.brandId,
          captureRef: link.captureRef,
          capabilityExecutionRef: link.capabilityExecutionRef,
          providerExecutionRef: link.providerExecutionRef,
          attemptRole: link.attemptRole,
        },
      });
    });
  }

  async attachToCapture(
    brandId: BrandId,
    captureRef: CaptureRef,
    providerExecutionRef: ProviderExecutionRef,
    attemptRole: string,
  ): Promise<void> {
    return this.attach({
      brandId,
      captureRef,
      providerExecutionRef,
      attemptRole,
    });
  }

  async attachToCapabilityExecution(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
    providerExecutionRef: ProviderExecutionRef,
    attemptRole: string,
  ): Promise<void> {
    return this.attach({
      brandId,
      capabilityExecutionRef,
      providerExecutionRef,
      attemptRole,
    });
  }

  async listForCapture(
    brandId: BrandId,
    captureRef: CaptureRef,
  ): Promise<readonly DataExtractionProviderExecutionLink[]> {
    return withPersistenceErrorMapping(async () => {
      await ownedCapture(this.db, brandId, captureRef);
      return (
        await this.db.dataExtractionProviderExecutionLink.findMany({
          where: { brandId, captureRef },
          orderBy: { createdAt: "asc" },
        })
      ).map(toProviderExecutionLink);
    });
  }

  async listForCapabilityExecution(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
  ): Promise<readonly DataExtractionProviderExecutionLink[]> {
    return withPersistenceErrorMapping(async () => {
      await ownedCapabilityExecution(this.db, brandId, capabilityExecutionRef);
      return (
        await this.db.dataExtractionProviderExecutionLink.findMany({
          where: { brandId, capabilityExecutionRef },
          orderBy: { createdAt: "asc" },
        })
      ).map(toProviderExecutionLink);
    });
  }
}

export interface DataExtractionRepositorySet {
  readonly resources: PrismaResourceRepository;
  readonly captures: PrismaCaptureRepository;
  readonly contentArtifacts: PrismaContentArtifactRepository;
  readonly capabilityExecutions: PrismaCapabilityExecutionRepository;
  readonly capabilityResources: PrismaCapabilityResourceRepository;
  readonly evidenceItems: PrismaEvidenceItemRepository;
  readonly capabilityEvidence: PrismaCapabilityEvidenceRepository;
  readonly semanticObservations: PrismaSemanticObservationRepository;
  readonly freshnessAssessments: PrismaFreshnessAssessmentRepository;
  readonly providerExecutionLinks: PrismaProviderExecutionLinkRepository;
}

export function createDataExtractionRepositorySet(
  db: DataExtractionDb,
): DataExtractionRepositorySet {
  return {
    resources: new PrismaResourceRepository(db),
    captures: new PrismaCaptureRepository(db),
    contentArtifacts: new PrismaContentArtifactRepository(db),
    capabilityExecutions: new PrismaCapabilityExecutionRepository(db),
    capabilityResources: new PrismaCapabilityResourceRepository(db),
    evidenceItems: new PrismaEvidenceItemRepository(db),
    capabilityEvidence: new PrismaCapabilityEvidenceRepository(db),
    semanticObservations: new PrismaSemanticObservationRepository(db),
    freshnessAssessments: new PrismaFreshnessAssessmentRepository(db),
    providerExecutionLinks: new PrismaProviderExecutionLinkRepository(db),
  };
}

@Injectable()
export class DataExtractionPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  repositories(): DataExtractionRepositorySet {
    return createDataExtractionRepositorySet(this.prisma);
  }

  async withTransaction<T>(
    operation: (repositories: DataExtractionRepositorySet) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction((tx) =>
        operation(createDataExtractionRepositorySet(tx)),
      );
    } catch (error) {
      if (isDataExtractionPersistenceError(error)) throw error;
      return withPersistenceErrorMapping(async () => Promise.reject(error));
    }
  }
}
