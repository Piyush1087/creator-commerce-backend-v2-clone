import {
  IndustryVertical,
  IntelligenceActionActorType,
  IntelligenceAuthority,
  IntelligenceComponentCandidateStatus,
  IntelligenceComponentTransitionOutcome,
  IntelligenceFreshness,
  IntelligenceNodeKind,
  IntelligenceProducerKind,
  IntelligenceProtectionState,
  IntelligenceReadiness,
  IntelligenceValueState,
  Prisma,
  PrismaClient,
  type IntelligenceComponentGeneration,
  type IntelligenceCurrentComponent,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import { IntelligencePersistenceError } from "./domain/intelligence-persistence.error";
import { IntelligenceActionRepository } from "./persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "./persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "./persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "./persistence/intelligence-generation.repository";
import { ComponentPathCodec } from "./semantic-path/component-path.codec";
import { resolveIntelligenceSubject } from "./subject/intelligence-subject.resolver";
import { IntelligenceTransitionService } from "./transitions/intelligence-transition.service";
import type {
  IntelligenceTransitionDecision,
  TransitionActionContext,
} from "./transitions/intelligence-transition.types";

const databaseEnabled = process.env.BRAND_INTELLIGENCE_DATABASE_TEST === "true";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

describe.skipIf(!databaseEnabled)("W1.0B Brand Intelligence database", () => {
  const prisma = new PrismaClient();
  const prismaService = prisma as unknown as PrismaService;
  const codec = new ComponentPathCodec();
  const generationRepository = new IntelligenceGenerationRepository(
    prismaService,
    codec,
  );
  const currentRepository = new IntelligenceCurrentStateRepository(
    prismaService,
  );
  const candidateRepository = new IntelligenceCandidateRepository(
    prismaService,
  );
  const actionRepository = new IntelligenceActionRepository(prismaService);
  const service = new IntelligenceTransitionService(
    prismaService,
    currentRepository,
    candidateRepository,
    actionRepository,
    codec,
  );
  const brandId = randomUUID();
  const otherBrandId = randomUUID();
  let processorExecutionId: string;
  let brandSubjectId: string;
  let otherBrandSubjectId: string;

  const address = (path: string, selectedBrandId = brandId) => ({
    brandId: selectedBrandId,
    subjectId:
      selectedBrandId === brandId ? brandSubjectId : otherBrandSubjectId,
    objectSemanticId: "w1_0b_test_object",
    pathSchemeVersion: 1,
    componentSemanticPath: path,
  });

  const authorizedAction = (
    actionType: string,
    selectedBrandId = brandId,
  ): TransitionActionContext => ({
    id: randomUUID(),
    brandId: selectedBrandId,
    actionType,
    actorType: IntelligenceActionActorType.BRAND_ACTOR,
    actorRef: "brand-test-actor",
    authorizationDecisionRef: `authorization:${randomUUID()}`,
    requestIdempotencyKey: randomUUID(),
    correlationRef: `correlation:${randomUUID()}`,
    reasonCode: "DATABASE_TEST",
  });

  const processorAction = (actionType: string): TransitionActionContext => ({
    id: randomUUID(),
    brandId,
    actionType,
    actorType: IntelligenceActionActorType.PROCESSOR,
    actorRef: "processor:test",
    requestIdempotencyKey: randomUUID(),
    correlationRef: `correlation:${randomUUID()}`,
    reasonCode: "PROCESSOR_TEST",
    processorExecutionId,
  });

  async function createGeneration(
    path: string,
    value: string,
    authority: IntelligenceAuthority,
    supersedesComponentGenerationId: string | null = null,
    selectedBrandId = brandId,
    freshness = IntelligenceFreshness.CURRENT,
  ): Promise<IntelligenceComponentGeneration> {
    const producerActionId = randomUUID();
    await prisma.intelligenceAction.create({
      data: {
        id: producerActionId,
        brandId: selectedBrandId,
        subjectId:
          selectedBrandId === brandId ? brandSubjectId : otherBrandSubjectId,
        actionType: "TEST_GENERATION_PRODUCER",
        actorType: IntelligenceActionActorType.SYSTEM,
        actorRef: "w1.0b-database-test",
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
        subjectId:
          selectedBrandId === brandId ? brandSubjectId : otherBrandSubjectId,
        objectSemanticId: "w1_0b_test_object",
        objectContractId: "test.object",
        objectContractVersion: "1",
        producerKind: IntelligenceProducerKind.AUTHORIZED_APPLICATION_ACTION,
        producerId: "database-test",
        bundleId: "test-bundle",
        bundleVersion: "1",
        bundleHash: hash("bundle"),
        actionId: producerActionId,
        valueState: IntelligenceValueState.VALUE,
        valuePayload: { value },
        valueHash: hash(value),
        objectMetadataPayload: {},
        readiness: IntelligenceReadiness.READY,
        freshnessAtGeneration: freshness,
        activeScope: [path],
        activeScopeHash: hash(path),
      },
    });
    return prisma.intelligenceComponentGeneration.create({
      data: {
        brandId: selectedBrandId,
        subjectId:
          selectedBrandId === brandId ? brandSubjectId : otherBrandSubjectId,
        objectGenerationId: object.id,
        objectSemanticId: object.objectSemanticId,
        pathSchemeVersion: 1,
        componentSemanticPath: path,
        nodeKind: IntelligenceNodeKind.OBJECT_FIELD,
        componentContractId: "test.component",
        componentContractVersion: "1",
        valueState: IntelligenceValueState.VALUE,
        valuePayload: value,
        valueHash: hash(value),
        authority,
        sourceClass:
          authority === IntelligenceAuthority.BRAND_CONFIRMED
            ? "BRAND_USER_INPUT"
            : "OWNED_WEBSITE",
        readiness: IntelligenceReadiness.READY,
        freshnessAtGeneration: freshness,
        metadataPayload: {},
        supersedesComponentGenerationId,
      },
    });
  }

  async function apply(
    generation: IntelligenceComponentGeneration,
    expectedCurrent: IntelligenceTransitionDecision["expectedCurrent"],
    action: TransitionActionContext,
  ) {
    return service.transition({
      action,
      decisions: [
        {
          kind: "APPLY_GENERATION",
          ...address(generation.componentSemanticPath, generation.brandId),
          expectedCurrent,
          generationId: generation.id,
        },
      ],
    });
  }

  async function current(path: string): Promise<IntelligenceCurrentComponent> {
    return prisma.intelligenceCurrentComponent.findUniqueOrThrow({
      where: {
        brandId_subjectId_objectSemanticId_pathSchemeVersion_componentSemanticPath:
          address(path),
      },
    });
  }

  beforeAll(async () => {
    await prisma.brandProfile.createMany({
      data: [brandId, otherBrandId].map((id, index) => ({
        id,
        domain: `w1-0b-${index}-${id}.example`,
        name: `W1.0B test ${index}`,
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
    const execution = await prisma.intelligenceExecution.create({
      data: {
        brandId,
        subjectId: brandSubjectId,
        triggerType: "TEST",
        triggerRef: randomUUID(),
        triggerIdempotencyKey: randomUUID(),
        correlationRef: randomUUID(),
        requestedImpact: {},
      },
    });
    const processor = await prisma.intelligenceProcessorExecution.create({
      data: {
        executionId: execution.id,
        brandId,
        subjectId: brandSubjectId,
        processorId: "w1.0b-test",
        processorVersion: "1",
        bundleId: "test-bundle",
        bundleVersion: "1",
        bundleHash: hash("bundle"),
        outputContractId: "test.output",
        outputContractVersion: "1",
        activeScope: [],
        activeScopeHash: hash("scope"),
        dependencyManifest: {},
        dependencyManifestHash: hash("dependencies"),
        evidenceManifest: {},
        evidenceManifestHash: hash("evidence"),
        triggerIntentKey: randomUUID(),
        processorExecutionKey: hash(randomUUID()),
        maxAttempts: 3,
      },
    });
    processorExecutionId = processor.id;
  });

  afterAll(async () => {
    await prisma.intelligenceComponentTransition.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
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
    await prisma.intelligenceProcessorAttempt.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
    await prisma.intelligenceAction.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
    await prisma.intelligenceProcessorExecution.deleteMany({
      where: { brandId: { in: [brandId, otherBrandId] } },
    });
    await prisma.intelligenceExecution.deleteMany({
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

  it("persists an immutable Object aggregate idempotently with reference-only lineage", async () => {
    const producerActionId = randomUUID();
    await prisma.intelligenceAction.create({
      data: {
        id: producerActionId,
        brandId,
        subjectId: brandSubjectId,
        actionType: "GENERATION_REPOSITORY_TEST",
        actorType: IntelligenceActionActorType.SYSTEM,
        actorRef: "repository-test",
        requestIdempotencyKey: randomUUID(),
        correlationRef: randomUUID(),
        reasonCode: "TEST",
        requestedAtomicity: "GENERATION_ONLY",
        outcome: "PERSISTED",
      },
    });
    const objectId = randomUUID();
    const path = "$/f/repository";
    const command = {
      object: {
        id: objectId,
        brandId,
        objectSemanticId: "w1_0b_test_object",
        objectContractId: "test.object",
        objectContractVersion: "1",
        outputContractId: null,
        outputContractVersion: null,
        producerKind: IntelligenceProducerKind.AUTHORIZED_APPLICATION_ACTION,
        producerId: "repository-test",
        producerVersion: null,
        bundleId: "test-bundle",
        bundleVersion: "1",
        bundleHash: hash("bundle"),
        processorExecutionId: null,
        successfulAttemptId: null,
        actionId: producerActionId,
        valueState: IntelligenceValueState.VALUE,
        valuePayload: { value: "repository" } as Prisma.InputJsonValue,
        valueHash: hash("repository"),
        objectMetadataPayload: {} as Prisma.InputJsonValue,
        readiness: IntelligenceReadiness.READY,
        freshnessAtGeneration: IntelligenceFreshness.CURRENT,
        activeScope: [path] as Prisma.InputJsonValue,
        activeScopeHash: hash(path),
        basedOnObjectGenerationId: null,
        supersedesObjectGenerationId: null,
        generationOrdinal: 1,
      },
      components: [
        {
          id: randomUUID(),
          pathSchemeVersion: 1,
          componentSemanticPath: path,
          nodeKind: IntelligenceNodeKind.OBJECT_FIELD,
          componentContractId: "test.component",
          componentContractVersion: "1",
          valueState: IntelligenceValueState.VALUE,
          valuePayload: "repository" as Prisma.InputJsonValue,
          valueHash: hash("repository"),
          authority: IntelligenceAuthority.CREATOR_SHOP_DERIVED,
          sourceClass: "OWNED_WEBSITE",
          readiness: IntelligenceReadiness.READY,
          freshnessAtGeneration: IntelligenceFreshness.CURRENT,
          metadataPayload: {} as Prisma.InputJsonValue,
          confidence: null,
          evidenceStrength: null,
          presentationOrder: null,
          supersedesComponentGenerationId: null,
        },
      ],
      evidenceReferences: [
        {
          id: randomUUID(),
          componentSemanticPath: path,
          evidenceRef: "evidence:test:1",
          capabilityId: "owned-website-test",
          captureId: "capture-1",
          captureVersion: "1",
          sourceClass: "OWNED_WEBSITE",
          capturedAt: new Date("2026-08-25T00:00:00.000Z"),
          observedFreshness: "POSSIBLY_STALE" as const,
          evidenceManifestRef: "manifest:test:1",
          evidenceManifestHash: hash("manifest"),
        },
      ],
      businessStateReferences: [
        {
          id: randomUUID(),
          componentSemanticPath: path,
          entityType: "Brand",
          entityId: brandId,
          semanticFieldPath: "domain",
          revisionKind: "SNAPSHOT_FINGERPRINT" as const,
          revisionToken: hash("brand-domain"),
          observedAt: new Date("2026-08-25T00:00:00.000Z"),
          canonicalSnapshotRef: "brand-snapshot:test:1",
        },
      ],
    };
    const first = await generationRepository.persist(command);
    const replay = await generationRepository.persist(command);
    expect(replay.id).toBe(first.id);
    expect(replay.evidenceReferences[0]).not.toHaveProperty("payload");
    await expect(
      generationRepository.persist({
        ...command,
        object: { ...command.object, valueHash: hash("different") },
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("creates expected-absent current and records expected-revision CAS rejection", async () => {
    const path = "$/f/cas";
    const first = await createGeneration(
      path,
      "v1",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
    );
    const firstAction = processorAction("CAS_FIRST");
    const applied = await apply(first, { state: "ABSENT" }, firstAction);
    expect(applied.outcomes[0].outcome).toBe(
      IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
    );
    expect((await current(path)).revision).toBe(1n);
    await expect(
      apply(
        first,
        { state: "PRESENT", generationId: first.id, revision: 1n },
        firstAction,
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

    const second = await createGeneration(
      path,
      "v2",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
      first.id,
    );
    const rejected = await apply(
      second,
      { state: "ABSENT" },
      processorAction("CAS_ABSENT_REPLAY"),
    );
    expect(rejected.outcomes[0].outcome).toBe(
      IntelligenceComponentTransitionOutcome.REJECTED_CAS,
    );
    expect((await current(path)).currentComponentGenerationId).toBe(first.id);

    const missingPath = "$/f/cas_missing";
    const missingGeneration = await createGeneration(
      missingPath,
      "missing",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
    );
    const missing = await apply(
      missingGeneration,
      { state: "PRESENT", generationId: missingGeneration.id, revision: 1n },
      processorAction("CAS_EXPECTED_PRESENT_MISSING"),
    );
    expect(missing.outcomes[0].outcome).toBe(
      IntelligenceComponentTransitionOutcome.REJECTED_CAS,
    );
  });

  it("protects Brand-confirmed and Support-controlled current and supports multiple deduplicated candidates", async () => {
    for (const [path, authority] of [
      ["$/f/brand_protected", IntelligenceAuthority.BRAND_CONFIRMED],
      ["$/f/support_protected", IntelligenceAuthority.SUPPORT_CONTROLLED],
    ] as const) {
      const protectedGeneration = await createGeneration(
        path,
        "protected",
        authority,
      );
      await apply(
        protectedGeneration,
        { state: "ABSENT" },
        authorizedAction(`CREATE_${authority}`),
      );
      expect((await current(path)).protectionState).toBe(
        authority === IntelligenceAuthority.BRAND_CONFIRMED
          ? IntelligenceProtectionState.BRAND_CONFIRMED
          : IntelligenceProtectionState.SUPPORT_CONTROLLED,
      );
      const candidateA = await createGeneration(
        path,
        "candidate-a",
        IntelligenceAuthority.CREATOR_SHOP_DERIVED,
      );
      const candidateB = await createGeneration(
        path,
        "candidate-b",
        IntelligenceAuthority.OBSERVED,
      );
      const basis = await current(path);
      const actionA = processorAction(`CANDIDATE_A_${authority}`);
      const recordedA = await apply(
        candidateA,
        {
          state: "PRESENT",
          generationId: basis.currentComponentGenerationId,
          revision: basis.revision,
        },
        actionA,
      );
      const replayA = await apply(
        candidateA,
        {
          state: "PRESENT",
          generationId: basis.currentComponentGenerationId,
          revision: basis.revision,
        },
        actionA,
      );
      const recordedB = await apply(
        candidateB,
        {
          state: "PRESENT",
          generationId: basis.currentComponentGenerationId,
          revision: basis.revision,
        },
        processorAction(`CANDIDATE_B_${authority}`),
      );
      expect(recordedA.outcomes[0].outcome).toBe(
        IntelligenceComponentTransitionOutcome.RECORDED_CANDIDATE,
      );
      expect(replayA.replayed).toBe(true);
      expect(recordedB.outcomes[0].outcome).toBe(
        IntelligenceComponentTransitionOutcome.RECORDED_CANDIDATE,
      );
      const duplicateValueGeneration = await createGeneration(
        path,
        "candidate-a",
        IntelligenceAuthority.CREATOR_SHOP_DERIVED,
      );
      const duplicateValue = await apply(
        duplicateValueGeneration,
        {
          state: "PRESENT",
          generationId: basis.currentComponentGenerationId,
          revision: basis.revision,
        },
        processorAction(`CANDIDATE_A_DUPLICATE_${authority}`),
      );
      expect(duplicateValue.outcomes[0].candidateId).toBe(
        recordedA.outcomes[0].candidateId,
      );
      await expect(
        prisma.intelligenceComponentCandidate.count({
          where: {
            currentComponentId: basis.id,
            status: IntelligenceComponentCandidateStatus.PENDING,
          },
        }),
      ).resolves.toBe(2);
    }

    const forbiddenPath = "$/f/processor_forbidden_authority";
    const forbidden = await createGeneration(
      forbiddenPath,
      "forbidden",
      IntelligenceAuthority.BRAND_CONFIRMED,
    );
    const rejected = await apply(
      forbidden,
      { state: "ABSENT" },
      processorAction("PROCESSOR_FORBIDDEN_AUTHORITY"),
    );
    expect(rejected.outcomes[0]).toMatchObject({
      outcome: IntelligenceComponentTransitionOutcome.REJECTED_VALIDATION,
      reasonCode: "AUTHORITY_NOT_ALLOWED",
    });
    await expect(
      currentRepository.getCurrent(address(forbiddenPath)),
    ).resolves.toBeNull();
  });

  it("accepts, rejects, and obsoletes candidates only against their exact current basis", async () => {
    const acceptPath = "$/f/candidate_accept";
    const protectedGeneration = await createGeneration(
      acceptPath,
      "protected",
      IntelligenceAuthority.BRAND_CONFIRMED,
    );
    await apply(
      protectedGeneration,
      { state: "ABSENT" },
      authorizedAction("ACCEPT_BASE"),
    );
    const basis = await current(acceptPath);
    const candidateGeneration = await createGeneration(
      acceptPath,
      "candidate",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
    );
    const candidateResult = await apply(
      candidateGeneration,
      {
        state: "PRESENT",
        generationId: basis.currentComponentGenerationId,
        revision: basis.revision,
      },
      processorAction("ACCEPT_CANDIDATE_PRODUCE"),
    );
    const candidateId = candidateResult.outcomes[0].candidateId!;
    const siblingGeneration = await createGeneration(
      acceptPath,
      "candidate-sibling",
      IntelligenceAuthority.OBSERVED,
    );
    const siblingResult = await apply(
      siblingGeneration,
      {
        state: "PRESENT",
        generationId: basis.currentComponentGenerationId,
        revision: basis.revision,
      },
      processorAction("ACCEPT_CANDIDATE_SIBLING"),
    );
    const siblingId = siblingResult.outcomes[0].candidateId!;
    const acceptedGeneration = await createGeneration(
      acceptPath,
      "candidate",
      IntelligenceAuthority.BRAND_CONFIRMED,
      protectedGeneration.id,
    );
    const accepted = await service.transition({
      action: authorizedAction("CANDIDATE_ACCEPT"),
      decisions: [
        {
          kind: "ACCEPT_CANDIDATE",
          ...address(acceptPath),
          expectedCurrent: {
            state: "PRESENT",
            generationId: basis.currentComponentGenerationId,
            revision: basis.revision,
          },
          candidateId,
          acceptedGenerationId: acceptedGeneration.id,
        },
      ],
    });
    expect(accepted.outcomes[0].outcome).toBe(
      IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
    );
    await expect(
      prisma.intelligenceComponentCandidate.findUniqueOrThrow({
        where: { id: candidateId },
      }),
    ).resolves.toMatchObject({
      status: IntelligenceComponentCandidateStatus.ACCEPTED,
    });
    await expect(
      prisma.intelligenceComponentCandidate.findUniqueOrThrow({
        where: { id: siblingId },
      }),
    ).resolves.toMatchObject({
      status: IntelligenceComponentCandidateStatus.OBSOLETE,
    });

    const rejectPath = "$/f/candidate_reject";
    const rejectBase = await createGeneration(
      rejectPath,
      "protected",
      IntelligenceAuthority.BRAND_CONFIRMED,
    );
    await apply(
      rejectBase,
      { state: "ABSENT" },
      authorizedAction("REJECT_BASE"),
    );
    const rejectCurrent = await current(rejectPath);
    const rejectGeneration = await createGeneration(
      rejectPath,
      "reject-me",
      IntelligenceAuthority.OBSERVED,
    );
    const pending = await apply(
      rejectGeneration,
      {
        state: "PRESENT",
        generationId: rejectBase.id,
        revision: rejectCurrent.revision,
      },
      processorAction("REJECT_CANDIDATE_PRODUCE"),
    );
    const rejected = await service.transition({
      action: authorizedAction("CANDIDATE_REJECT"),
      decisions: [
        {
          kind: "REJECT_CANDIDATE",
          ...address(rejectPath),
          expectedCurrent: {
            state: "PRESENT",
            generationId: rejectBase.id,
            revision: rejectCurrent.revision,
          },
          candidateId: pending.outcomes[0].candidateId!,
        },
      ],
    });
    expect(rejected.outcomes[0].reasonCode).toBe("CANDIDATE_REJECTED");

    const staleGeneration = await createGeneration(
      acceptPath,
      "stale",
      IntelligenceAuthority.OBSERVED,
    );
    const obsolete = await apply(
      staleGeneration,
      {
        state: "PRESENT",
        generationId: protectedGeneration.id,
        revision: basis.revision,
      },
      processorAction("STALE_BASIS"),
    );
    expect(obsolete.outcomes[0].outcome).toBe(
      IntelligenceComponentTransitionOutcome.MARKED_OBSOLETE,
    );
  });

  it("records valid partial siblings while retaining a protected conflict", async () => {
    const paths = ["$/f/partial_a", "$/f/partial_b", "$/f/partial_c"];
    const bases = await Promise.all([
      createGeneration(
        paths[0],
        "a1",
        IntelligenceAuthority.CREATOR_SHOP_DERIVED,
      ),
      createGeneration(
        paths[1],
        "b1",
        IntelligenceAuthority.CREATOR_SHOP_DERIVED,
      ),
      createGeneration(paths[2], "c1", IntelligenceAuthority.BRAND_CONFIRMED),
    ]);
    await Promise.all([
      apply(bases[0], { state: "ABSENT" }, processorAction("PARTIAL_BASE_A")),
      apply(bases[1], { state: "ABSENT" }, processorAction("PARTIAL_BASE_B")),
      apply(bases[2], { state: "ABSENT" }, authorizedAction("PARTIAL_BASE_C")),
    ]);
    const currents = await Promise.all(paths.map(current));
    const next = await Promise.all([
      createGeneration(
        paths[0],
        "a2",
        IntelligenceAuthority.CREATOR_SHOP_DERIVED,
        bases[0].id,
      ),
      createGeneration(
        paths[1],
        "b2",
        IntelligenceAuthority.CREATOR_SHOP_DERIVED,
        bases[1].id,
      ),
      createGeneration(
        paths[2],
        "c2",
        IntelligenceAuthority.CREATOR_SHOP_DERIVED,
      ),
    ]);
    const action = processorAction("PARTIAL_SIBLINGS");
    const result = await service.transition({
      action,
      decisions: [2, 1, 0].map((index) => ({
        kind: "APPLY_GENERATION" as const,
        ...address(paths[index]),
        expectedCurrent: {
          state: "PRESENT" as const,
          generationId: bases[index].id,
          revision: currents[index].revision,
        },
        generationId: next[index].id,
      })),
    });
    expect(result.outcomes.map((item) => item.outcome).sort()).toEqual(
      [
        IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
        IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
        IntelligenceComponentTransitionOutcome.RECORDED_CANDIDATE,
      ].sort(),
    );
  });

  it("changes freshness with CAS without changing protected authority", async () => {
    const path = "$/f/freshness";
    const generation = await createGeneration(
      path,
      "confirmed",
      IntelligenceAuthority.BRAND_CONFIRMED,
    );
    await apply(
      generation,
      { state: "ABSENT" },
      authorizedAction("FRESHNESS_BASE"),
    );
    const before = await current(path);
    const stale = await service.transition({
      action: authorizedAction("FRESHNESS_STALE"),
      decisions: [
        {
          kind: "SET_FRESHNESS",
          ...address(path),
          expectedCurrent: {
            state: "PRESENT",
            generationId: generation.id,
            revision: before.revision,
          },
          freshness: IntelligenceFreshness.STALE,
          evaluatedAt: new Date(),
          staleReasonCode: "DEPENDENCY_CHANGED",
          invalidatingRef: "event:test",
        },
      ],
    });
    expect(stale.outcomes[0].outcome).toBe(
      IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
    );
    const after = await current(path);
    expect(after).toMatchObject({
      currentFreshness: IntelligenceFreshness.STALE,
      currentAuthority: IntelligenceAuthority.BRAND_CONFIRMED,
      protectionState: IntelligenceProtectionState.BRAND_CONFIRMED,
    });
    expect(after.revision).toBe(before.revision + 1n);

    const currentAgain = await service.transition({
      action: authorizedAction("FRESHNESS_CURRENT"),
      decisions: [
        {
          kind: "SET_FRESHNESS",
          ...address(path),
          expectedCurrent: {
            state: "PRESENT",
            generationId: generation.id,
            revision: after.revision,
          },
          freshness: IntelligenceFreshness.CURRENT,
          evaluatedAt: new Date(),
        },
      ],
    });
    expect(currentAgain.outcomes[0].outcome).toBe(
      IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
    );

    const unknownPath = "$/f/freshness_unknown";
    const unknownGeneration = await createGeneration(
      unknownPath,
      "unknown",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
      null,
      brandId,
      IntelligenceFreshness.UNKNOWN,
    );
    await apply(
      unknownGeneration,
      { state: "ABSENT" },
      processorAction("FRESHNESS_UNKNOWN_BASE"),
    );
    const unknownCurrent = await current(unknownPath);
    const unknownToCurrent = await service.transition({
      action: processorAction("FRESHNESS_UNKNOWN_CURRENT"),
      decisions: [
        {
          kind: "SET_FRESHNESS",
          ...address(unknownPath),
          expectedCurrent: {
            state: "PRESENT",
            generationId: unknownGeneration.id,
            revision: unknownCurrent.revision,
          },
          freshness: IntelligenceFreshness.CURRENT,
          evaluatedAt: new Date(),
        },
      ],
    });
    expect(unknownToCurrent.outcomes[0].outcome).toBe(
      IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
    );
  });

  it("rejects cross-Brand commands before mutation", async () => {
    const generation = await createGeneration(
      "$/f/cross_brand",
      "other",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
      null,
      otherBrandId,
    );
    await expect(
      service.transition({
        action: processorAction("CROSS_BRAND"),
        decisions: [
          {
            kind: "APPLY_GENERATION",
            ...address(generation.componentSemanticPath, otherBrandId),
            expectedCurrent: { state: "ABSENT" },
            generationId: generation.id,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(IntelligencePersistenceError);
  });

  it("serializes two recomputes so exactly one expected revision wins", async () => {
    const path = "$/f/race_recompute";
    const base = await createGeneration(
      path,
      "base",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
    );
    await apply(
      base,
      { state: "ABSENT" },
      processorAction("RACE_RECOMPUTE_BASE"),
    );
    const basis = await current(path);
    const first = await createGeneration(
      path,
      "first",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
    );
    const second = await createGeneration(
      path,
      "second",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
    );
    const expected = {
      state: "PRESENT" as const,
      generationId: base.id,
      revision: basis.revision,
    };
    const outcomes = await Promise.all([
      apply(first, expected, processorAction("RACE_RECOMPUTE_FIRST")),
      apply(second, expected, processorAction("RACE_RECOMPUTE_SECOND")),
    ]);
    expect(
      outcomes
        .flatMap((item) => item.outcomes)
        .filter(
          (item) =>
            item.outcome ===
            IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
        ),
    ).toHaveLength(1);
    expect(
      outcomes
        .flatMap((item) => item.outcomes)
        .filter(
          (item) =>
            item.outcome ===
            IntelligenceComponentTransitionOutcome.REJECTED_CAS,
        ),
    ).toHaveLength(1);
  });

  it("prevents AI overwrite during Brand edit and candidate acceptance races", async () => {
    const editPath = "$/f/race_brand_edit";
    const base = await createGeneration(
      editPath,
      "derived",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
    );
    await apply(base, { state: "ABSENT" }, processorAction("RACE_EDIT_BASE"));
    const basis = await current(editPath);
    const confirmed = await createGeneration(
      editPath,
      "brand",
      IntelligenceAuthority.BRAND_CONFIRMED,
    );
    const ai = await createGeneration(
      editPath,
      "ai",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
    );
    const expected = {
      state: "PRESENT" as const,
      generationId: base.id,
      revision: basis.revision,
    };
    const [recompute, edit] = await Promise.all([
      apply(ai, expected, processorAction("RACE_AI_RECOMPUTE")),
      apply(confirmed, expected, authorizedAction("RACE_BRAND_EDIT")),
    ]);
    expect(
      [recompute, edit].filter(
        (result) =>
          result.outcomes[0].outcome ===
          IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
      ),
    ).toHaveLength(1);
    const afterRace = await current(editPath);
    if (afterRace.currentAuthority !== IntelligenceAuthority.BRAND_CONFIRMED) {
      const confirmedRetry = await createGeneration(
        editPath,
        "brand",
        IntelligenceAuthority.BRAND_CONFIRMED,
        afterRace.currentComponentGenerationId,
      );
      await apply(
        confirmedRetry,
        {
          state: "PRESENT",
          generationId: afterRace.currentComponentGenerationId,
          revision: afterRace.revision,
        },
        authorizedAction("RACE_BRAND_EDIT_EXPLICIT_RETRY"),
      );
    }

    const candidateGeneration = await createGeneration(
      editPath,
      "candidate-race",
      IntelligenceAuthority.OBSERVED,
    );
    const protectedCurrent = await current(editPath);
    const pending = await apply(
      candidateGeneration,
      {
        state: "PRESENT",
        generationId: protectedCurrent.currentComponentGenerationId,
        revision: protectedCurrent.revision,
      },
      processorAction("RACE_CANDIDATE_SEED"),
    );
    const acceptedGeneration = await createGeneration(
      editPath,
      "candidate-race",
      IntelligenceAuthority.BRAND_CONFIRMED,
      protectedCurrent.currentComponentGenerationId,
    );
    const competing = await createGeneration(
      editPath,
      "new-processor",
      IntelligenceAuthority.CREATOR_SHOP_DERIVED,
    );
    const candidateId = pending.outcomes[0].candidateId!;
    const [acceptance, processor] = await Promise.all([
      service.transition({
        action: authorizedAction("RACE_CANDIDATE_ACCEPT"),
        decisions: [
          {
            kind: "ACCEPT_CANDIDATE",
            ...address(editPath),
            expectedCurrent: {
              state: "PRESENT",
              generationId: protectedCurrent.currentComponentGenerationId,
              revision: protectedCurrent.revision,
            },
            candidateId,
            acceptedGenerationId: acceptedGeneration.id,
          },
        ],
      }),
      apply(
        competing,
        {
          state: "PRESENT",
          generationId: protectedCurrent.currentComponentGenerationId,
          revision: protectedCurrent.revision,
        },
        processorAction("RACE_NEW_PROCESSOR"),
      ),
    ]);
    expect(acceptance.outcomes[0].outcome).toBe(
      IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
    );
    expect([
      IntelligenceComponentTransitionOutcome.RECORDED_CANDIDATE,
      IntelligenceComponentTransitionOutcome.MARKED_OBSOLETE,
    ]).toContain(processor.outcomes[0].outcome);
    expect((await current(editPath)).currentComponentGenerationId).toBe(
      acceptedGeneration.id,
    );
  });
});
