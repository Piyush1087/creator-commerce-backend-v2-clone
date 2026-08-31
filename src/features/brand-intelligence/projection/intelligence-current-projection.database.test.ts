import {
  IndustryVertical,
  IntelligenceActionActorType,
  IntelligenceAuthority,
  IntelligenceBusinessStateRevisionKind,
  IntelligenceComponentCandidateStatus,
  IntelligenceCurrentComponentLifecycle,
  IntelligenceEvidenceFreshness,
  IntelligenceFreshness,
  IntelligenceNodeKind,
  IntelligenceProducerKind,
  IntelligenceProtectionState,
  IntelligenceReadiness,
  IntelligenceValueState,
  PrismaClient,
  type IntelligenceComponentGeneration,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import { ComponentPathCodec } from "../semantic-path/component-path.codec";
import type { IntelligenceCurrentContractScopeService } from "./intelligence-current-contract-scope.service";
import { IntelligenceCurrentProjectionRepository } from "./intelligence-current-projection.repository";
import { IntelligenceCurrentProjectionService } from "./intelligence-current-projection.service";
import { IntelligenceObjectAssembler } from "./intelligence-object-assembler";
import { resolveIntelligenceSubject } from "../subject/intelligence-subject.resolver";

const databaseEnabled =
  process.env.BRAND_INTELLIGENCE_PROJECTION_DATABASE_TEST === "true";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

describe.skipIf(!databaseEnabled)("W1.0F current projection database", () => {
  const prisma = new PrismaClient();
  const repository = new IntelligenceCurrentProjectionRepository(
    prisma as unknown as PrismaService,
  );
  const contracts = {
    resolveObject: (objectSemanticId: string) => ({
      objectSemanticId,
      outputContractId: "brand_communication_output_contract",
      outputContractVersion: "1.0",
      ownedPathPatterns: [
        "$",
        "$/f/tone_traits/i/{semantic_id}",
        "$/f/retired",
      ],
      requiredMaterializedPaths: ["$"],
    }),
    ownsPath: (_brandId: string, _objectSemanticId: string, path: string) =>
      path === "$" ||
      path === "$/f/retired" ||
      path.startsWith("$/f/tone_traits/i/"),
  } as unknown as IntelligenceCurrentContractScopeService;
  const service = new IntelligenceCurrentProjectionService(
    repository,
    contracts,
    new IntelligenceObjectAssembler(new ComponentPathCodec()),
  );
  const brandId = randomUUID();
  const otherBrandId = randomUUID();
  const objectSemanticId = "communication_profile";
  let root: IntelligenceComponentGeneration;
  let brandSubjectId: string;
  let otherBrandSubjectId: string;

  async function createGeneration(
    selectedBrandId: string,
    path: string,
    value: unknown,
    options: Partial<{
      authority: IntelligenceAuthority;
      nodeKind: IntelligenceNodeKind;
      presentationOrder: number;
    }> = {},
  ): Promise<IntelligenceComponentGeneration> {
    const subjectId =
      selectedBrandId === brandId ? brandSubjectId : otherBrandSubjectId;
    const actionId = randomUUID();
    await prisma.intelligenceAction.create({
      data: {
        id: actionId,
        brandId: selectedBrandId,
        subjectId,
        actionType: "W1_0F_DATABASE_FIXTURE",
        actorType: IntelligenceActionActorType.SYSTEM,
        actorRef: "w1.0f-database-test",
        requestIdempotencyKey: randomUUID(),
        correlationRef: randomUUID(),
        reasonCode: "TEST_FIXTURE",
        requestedAtomicity: "GENERATION_ONLY",
        outcome: "PERSISTED",
      },
    });
    const object = await prisma.intelligenceObjectGeneration.create({
      data: {
        brandId: selectedBrandId,
        subjectId,
        objectSemanticId,
        objectContractId: "brand_communication",
        objectContractVersion: "1.0",
        outputContractId: "brand_communication_output_contract",
        outputContractVersion: "1.0",
        producerKind: IntelligenceProducerKind.AUTHORIZED_APPLICATION_ACTION,
        producerId: "w1.0f-database-test",
        bundleId: "brand_communication",
        bundleVersion: "1.0",
        bundleHash: hash("brand_communication@1.0"),
        actionId,
        valueState: IntelligenceValueState.VALUE,
        valuePayload: value as never,
        valueHash: hash(JSON.stringify(value)),
        objectMetadataPayload: {},
        readiness: IntelligenceReadiness.READY,
        freshnessAtGeneration: IntelligenceFreshness.CURRENT,
        activeScope: [path],
        activeScopeHash: hash(path),
      },
    });
    return prisma.intelligenceComponentGeneration.create({
      data: {
        brandId: selectedBrandId,
        subjectId,
        objectGenerationId: object.id,
        objectSemanticId,
        pathSchemeVersion: 1,
        componentSemanticPath: path,
        nodeKind:
          options.nodeKind ??
          (path === "$"
            ? IntelligenceNodeKind.COLLECTION
            : IntelligenceNodeKind.SEMANTIC_ITEM),
        componentContractId: "brand_communication.component",
        componentContractVersion: "1.0",
        valueState: IntelligenceValueState.VALUE,
        valuePayload: value as never,
        valueHash: hash(JSON.stringify(value)),
        authority:
          options.authority ?? IntelligenceAuthority.CREATOR_SHOP_DERIVED,
        sourceClass: "OWNED_WEBSITE",
        readiness: IntelligenceReadiness.READY,
        freshnessAtGeneration: IntelligenceFreshness.CURRENT,
        metadataPayload: {},
        presentationOrder: options.presentationOrder,
      },
    });
  }

  async function makeCurrent(
    generation: IntelligenceComponentGeneration,
    lifecycle = IntelligenceCurrentComponentLifecycle.ACTIVE,
  ) {
    return prisma.intelligenceCurrentComponent.create({
      data: {
        brandId: generation.brandId,
        subjectId: generation.subjectId,
        objectSemanticId,
        pathSchemeVersion: 1,
        componentSemanticPath: generation.componentSemanticPath,
        nodeKind: generation.nodeKind,
        currentComponentGenerationId: generation.id,
        currentContractId: generation.componentContractId,
        currentContractVersion: generation.componentContractVersion,
        currentAuthority: generation.authority,
        currentSourceClass: generation.sourceClass,
        currentReadiness: generation.readiness,
        currentFreshness: IntelligenceFreshness.CURRENT,
        protectionState:
          generation.authority === IntelligenceAuthority.BRAND_CONFIRMED
            ? IntelligenceProtectionState.BRAND_CONFIRMED
            : IntelligenceProtectionState.UNPROTECTED,
        lifecycle,
      },
    });
  }

  beforeAll(async () => {
    await prisma.brandProfile.createMany({
      data: [brandId, otherBrandId].map((id, index) => ({
        id,
        domain: `w1-0f-${index}-${id}.example`,
        name: `W1.0F test ${index}`,
        industry: IndustryVertical.D2C,
        brandValues: [],
        policyFlags: [],
        targetAudience: {},
      })),
    });
    [brandSubjectId, otherBrandSubjectId] = await Promise.all([
      resolveIntelligenceSubject(prisma, brandId).then((subject) => subject.id),
      resolveIntelligenceSubject(prisma, otherBrandId).then(
        (subject) => subject.id,
      ),
    ]);

    root = await createGeneration(
      brandId,
      "$",
      { tone_traits: [] },
      { authority: IntelligenceAuthority.BRAND_CONFIRMED },
    );
    const rootCurrent = await makeCurrent(root);
    const toneB = await createGeneration(
      brandId,
      "$/f/tone_traits/i/tone-b",
      { semantic_id: "tone-b", label: "Bold" },
      { presentationOrder: 2 },
    );
    const toneA = await createGeneration(
      brandId,
      "$/f/tone_traits/i/tone-a",
      { semantic_id: "tone-a", label: "Clear" },
      { presentationOrder: 1 },
    );
    await makeCurrent(toneB);
    await makeCurrent(toneA);
    const retired = await createGeneration(brandId, "$/f/retired", "old", {
      nodeKind: IntelligenceNodeKind.OBJECT_FIELD,
    });
    await makeCurrent(retired, IntelligenceCurrentComponentLifecycle.RETIRED);

    const candidatePending = await createGeneration(brandId, "$", {
      tone_traits: [],
      candidate: 1,
    });
    const candidatePendingTwo = await createGeneration(brandId, "$", {
      tone_traits: [],
      candidate: 2,
    });
    const candidateResolved = await createGeneration(brandId, "$", {
      tone_traits: [],
      candidate: 3,
    });
    for (const [generation, status] of [
      [candidatePending, IntelligenceComponentCandidateStatus.PENDING],
      [candidatePendingTwo, IntelligenceComponentCandidateStatus.PENDING],
      [candidateResolved, IntelligenceComponentCandidateStatus.REJECTED],
    ] as const) {
      const producer =
        await prisma.intelligenceObjectGeneration.findUniqueOrThrow({
          where: { id: generation.objectGenerationId },
          select: { actionId: true },
        });
      let resolutionActionId: string | undefined;
      if (status === IntelligenceComponentCandidateStatus.REJECTED) {
        resolutionActionId = randomUUID();
        await prisma.intelligenceAction.create({
          data: {
            id: resolutionActionId,
            brandId,
            subjectId: brandSubjectId,
            actionType: "W1_0F_RESOLVE_FIXTURE",
            actorType: IntelligenceActionActorType.BRAND_ACTOR,
            actorRef: "w1.0f-database-test",
            authorizationDecisionRef: `authorization:${randomUUID()}`,
            requestIdempotencyKey: randomUUID(),
            correlationRef: randomUUID(),
            reasonCode: "TEST_FIXTURE",
            requestedAtomicity: "CANDIDATE_ONLY",
            outcome: "RESOLVED",
          },
        });
      }
      await prisma.intelligenceComponentCandidate.create({
        data: {
          brandId,
          subjectId: brandSubjectId,
          currentComponentId: rootCurrent.id,
          objectSemanticId,
          pathSchemeVersion: 1,
          componentSemanticPath: "$",
          candidateComponentGenerationId: generation.id,
          basisCurrentComponentGenerationId: root.id,
          basisCurrentRevision: 1n,
          candidateValueHash: generation.valueHash,
          discrepancyCode: "PROTECTED_VALUE_CONFLICT",
          producerActionId: producer.actionId,
          status,
          ...(status === IntelligenceComponentCandidateStatus.REJECTED
            ? { resolvedAt: new Date(), resolutionActionId }
            : {}),
        },
      });
    }

    await prisma.intelligenceEvidenceReference.create({
      data: {
        brandId,
        objectGenerationId: root.objectGenerationId,
        componentSemanticPath: "$",
        evidenceRef: "evidence:w1.0f:1",
        capabilityId: "website.observation",
        captureId: "capture:1",
        captureVersion: "1",
        sourceClass: "PUBLIC_WEB",
        capturedAt: new Date("2026-08-25T10:00:00.000Z"),
        observedFreshness: IntelligenceEvidenceFreshness.POSSIBLY_STALE,
        evidenceManifestHash: hash("evidence-manifest"),
      },
    });
    await prisma.intelligenceBusinessStateReference.create({
      data: {
        brandId,
        objectGenerationId: root.objectGenerationId,
        componentSemanticPath: "$",
        entityType: "BrandProfile",
        entityId: brandId,
        semanticFieldPath: "$.name",
        revisionKind: IntelligenceBusinessStateRevisionKind.UPDATED_AT,
        revisionToken: "2026-08-25T09:00:00.000Z",
        observedAt: new Date("2026-08-25T10:00:00.000Z"),
        canonicalSnapshotRef: "brand-profile-snapshot:1",
      },
    });

    const otherRoot = await createGeneration(otherBrandId, "$", {
      tone_traits: [{ semantic_id: "other-brand-only" }],
    });
    await makeCurrent(otherRoot);
  });

  afterAll(async () => {
    await prisma.intelligenceComponentCandidate.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
    await prisma.intelligenceCurrentComponent.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
    await prisma.intelligenceEvidenceReference.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
    await prisma.intelligenceBusinessStateReference.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
    await prisma.intelligenceComponentGeneration.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
    await prisma.intelligenceObjectGeneration.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
    await prisma.intelligenceAction.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
    await prisma.intelligenceSubject.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
    await prisma.brandProfile.deleteMany({
      where: { id: { in: [brandId, otherBrandId] } },
    });
    await prisma.$disconnect();
  });

  it("assembles one Brand-safe active snapshot with mixed generations and bounded lineage", async () => {
    const result = await service.readObject({ brandId, objectSemanticId });
    expect(result).toMatchObject({
      objectState: "CURRENT",
      mixedGeneration: true,
      candidateSummary: {
        status: "CONFLICT",
        pendingCount: 2,
        rawCandidateVisible: false,
      },
      assembledValue: {
        state: "VALUE",
        value: {
          tone_traits: [
            { semantic_id: "tone-a", label: "Clear" },
            { semantic_id: "tone-b", label: "Bold" },
          ],
        },
      },
    });
    expect(
      result.components.map((component) => component.componentSemanticPath),
    ).not.toContain("$/f/retired");
    const rootProjection = result.components.find(
      (component) => component.componentSemanticPath === "$",
    );
    expect(rootProjection).toMatchObject({
      authority: "BRAND_CONFIRMED",
      protectionState: "BRAND_CONFIRMED",
      evidenceReferenceSummary: [
        {
          evidenceRef: "evidence:w1.0f:1",
          observedFreshness: "POSSIBLY_STALE",
        },
      ],
      businessStateReferenceSummary: [
        { canonicalSnapshotRef: "brand-profile-snapshot:1" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("other-brand-only");
    expect(JSON.stringify(result)).not.toContain(
      "candidateComponentGenerationId",
    );
  });

  it("returns only the addressed Brand and component", async () => {
    const own = await service.readComponent({
      brandId,
      objectSemanticId,
      componentSemanticPath: "$",
    });
    expect(own).toMatchObject({ brandId, projectionState: "CURRENT" });

    const other = await service.readObject({
      brandId: otherBrandId,
      objectSemanticId,
    });
    expect(JSON.stringify(other)).toContain("other-brand-only");
    expect(JSON.stringify(other)).not.toContain("evidence:w1.0f:1");
  });
});
