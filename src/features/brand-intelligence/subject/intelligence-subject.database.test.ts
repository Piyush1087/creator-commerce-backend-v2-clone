import {
  IndustryVertical,
  IntelligenceActionActorType,
  IntelligenceAuthority,
  IntelligenceFreshness,
  IntelligenceNodeKind,
  IntelligenceProcessorExecutionStatus,
  IntelligenceProducerKind,
  IntelligenceReadiness,
  IntelligenceValueState,
  OfferingKind,
  OfferingLifecycle,
  OfferingType,
  PrismaClient,
  type IntelligenceComponentGeneration,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import { ProcessorRuntimeProjectionService } from "../../brand-centre/consumer/processor-runtime-projection.service";
import { processorLogicalKeyV2 } from "../execution/domain/execution-hash";
import { IntelligenceActionRepository } from "../persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "../persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "../persistence/intelligence-current-state.repository";
import { ComponentPathCodec } from "../semantic-path/component-path.codec";
import { IntelligenceTransitionService } from "../transitions/intelligence-transition.service";
import { resolveIntelligenceSubject } from "./intelligence-subject.resolver";

const enabled = process.env.INTELLIGENCE_SUBJECT_DATABASE_TEST === "true";
const hash = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

describe.skipIf(!enabled)("P1B-2 generic Intelligence subject scope", () => {
  const prisma = new PrismaClient({
    transactionOptions: { maxWait: 10_000 },
  });
  const db = prisma as unknown as PrismaService;
  const currentRepository = new IntelligenceCurrentStateRepository(db);
  const transitions = new IntelligenceTransitionService(
    db,
    currentRepository,
    new IntelligenceCandidateRepository(db),
    new IntelligenceActionRepository(db),
    new ComponentPathCodec(),
  );
  const runtime = new ProcessorRuntimeProjectionService(db);
  const brandId = randomUUID();
  const otherBrandId = randomUUID();
  const offeringAId = randomUUID();
  const offeringBId = randomUUID();
  const otherOfferingId = randomUUID();
  const objectSemanticId = "synthetic_product_subject_test_object";
  const componentSemanticPath = "$/f/factual_summary";
  let subjectAId: string;
  let subjectBId: string;
  let processorAId: string;
  let processorBId: string;

  const address = (subjectId: string) => ({
    brandId,
    subjectId,
    objectSemanticId,
    pathSchemeVersion: 1,
    componentSemanticPath,
  });

  async function createProcessor(
    subjectId: string,
    status: IntelligenceProcessorExecutionStatus,
    createdAt: Date,
  ) {
    const execution = await prisma.intelligenceExecution.create({
      data: {
        brandId,
        subjectId,
        triggerType: "P1B2_TEST",
        triggerRef: randomUUID(),
        triggerIdempotencyKey: randomUUID(),
        correlationRef: randomUUID(),
        requestedImpact: {},
        createdAt,
      },
    });
    return prisma.intelligenceProcessorExecution.create({
      data: {
        executionId: execution.id,
        brandId,
        subjectId,
        processorId: "synthetic_subject_processor",
        processorVersion: "1",
        bundleId: "synthetic-subject-bundle",
        bundleVersion: "1",
        bundleHash: hash("bundle"),
        outputContractId: "synthetic.subject.output",
        outputContractVersion: "1",
        activeScope: [address(subjectId)],
        activeScopeHash: hash(`scope:${subjectId}`),
        dependencyManifest: {},
        dependencyManifestHash: hash("dependency"),
        evidenceManifest: {},
        evidenceManifestHash: hash("evidence"),
        triggerIntentKey: randomUUID(),
        processorExecutionKey: hash(randomUUID()),
        processorKeyVersion: 2,
        maxAttempts: 2,
        status,
        createdAt,
        ...(status === IntelligenceProcessorExecutionStatus.RUNNING
          ? {
              leaseToken: randomUUID(),
              leaseOwnerRef: "p1b2-test-worker",
              leaseExpiresAt: new Date(createdAt.getTime() + 60_000),
              startedAt: createdAt,
            }
          : status === IntelligenceProcessorExecutionStatus.COMPLETED
            ? {
                resultReadiness: IntelligenceReadiness.READY,
                completedAt: createdAt,
              }
            : status === IntelligenceProcessorExecutionStatus.FAILED_TERMINAL
              ? { completedAt: createdAt, lastErrorCode: "SYNTHETIC_FAILURE" }
              : {}),
      },
    });
  }

  async function createGeneration(
    subjectId: string,
    value: string,
    authority = IntelligenceAuthority.CREATOR_SHOP_DERIVED,
    supersedesComponentGenerationId: string | null = null,
  ): Promise<IntelligenceComponentGeneration> {
    const action = await prisma.intelligenceAction.create({
      data: {
        brandId,
        subjectId,
        actionType: "P1B2_TEST_GENERATION",
        actorType: IntelligenceActionActorType.SYSTEM,
        actorRef: "p1b2-test",
        requestIdempotencyKey: randomUUID(),
        correlationRef: randomUUID(),
        reasonCode: "P1B2_TEST",
        requestedAtomicity: "GENERATION_ONLY",
        outcome: "PERSISTED",
      },
    });
    const object = await prisma.intelligenceObjectGeneration.create({
      data: {
        brandId,
        subjectId,
        objectSemanticId,
        objectContractId: "synthetic.product.object",
        objectContractVersion: "1",
        producerKind: IntelligenceProducerKind.AUTHORIZED_APPLICATION_ACTION,
        producerId: "p1b2-test",
        bundleId: "synthetic-subject-bundle",
        bundleVersion: "1",
        bundleHash: hash("bundle"),
        actionId: action.id,
        valueState: IntelligenceValueState.VALUE,
        valuePayload: { factualSummary: value },
        valueHash: hash(value),
        objectMetadataPayload: {},
        readiness: IntelligenceReadiness.READY,
        freshnessAtGeneration: IntelligenceFreshness.CURRENT,
        activeScope: [address(subjectId)],
        activeScopeHash: hash(`scope:${subjectId}`),
      },
    });
    return prisma.intelligenceComponentGeneration.create({
      data: {
        brandId,
        subjectId,
        objectGenerationId: object.id,
        objectSemanticId,
        pathSchemeVersion: 1,
        componentSemanticPath,
        nodeKind: IntelligenceNodeKind.OBJECT_FIELD,
        componentContractId: "synthetic.product.component",
        componentContractVersion: "1",
        valueState: IntelligenceValueState.VALUE,
        valuePayload: value,
        valueHash: hash(value),
        authority,
        sourceClass: "SYNTHETIC_TEST",
        readiness: IntelligenceReadiness.READY,
        freshnessAtGeneration: IntelligenceFreshness.CURRENT,
        metadataPayload: {},
        supersedesComponentGenerationId,
      },
    });
  }

  async function apply(
    subjectId: string,
    generation: IntelligenceComponentGeneration,
    expectedCurrent:
      | { readonly state: "ABSENT" }
      | {
          readonly state: "PRESENT";
          readonly generationId: string;
          readonly revision: bigint;
        },
    processorExecutionId?: string,
  ) {
    return transitions.transition({
      action: {
        id: randomUUID(),
        brandId,
        subjectId,
        actionType: "P1B2_TEST_APPLY",
        actorType: processorExecutionId
          ? IntelligenceActionActorType.PROCESSOR
          : IntelligenceActionActorType.SYSTEM,
        actorRef: processorExecutionId ? "synthetic-processor" : "p1b2-test",
        authorizationDecisionRef: processorExecutionId
          ? undefined
          : `authorization:${randomUUID()}`,
        requestIdempotencyKey: randomUUID(),
        correlationRef: randomUUID(),
        reasonCode: "P1B2_TEST",
        processorExecutionId,
      },
      decisions: [
        {
          kind: "APPLY_GENERATION",
          ...address(subjectId),
          expectedCurrent,
          generationId: generation.id,
        },
      ],
    });
  }

  beforeAll(async () => {
    await prisma.brandProfile.createMany({
      data: [
        { id: brandId, name: "P1B2 subject Brand" },
        { id: otherBrandId, name: "P1B2 other Brand" },
      ].map((brand, index) => ({
        ...brand,
        domain: `p1b2-subject-${index}-${brand.id}.example`,
        industry: IndustryVertical.D2C,
        brandValues: [],
        policyFlags: [],
        targetAudience: {},
      })),
    });
    await prisma.offering.createMany({
      data: [
        { id: offeringAId, brandProfileId: brandId, name: "Offering A" },
        { id: offeringBId, brandProfileId: brandId, name: "Offering B" },
        {
          id: otherOfferingId,
          brandProfileId: otherBrandId,
          name: "Other Offering",
        },
      ].map((offering) => ({
        ...offering,
        type: OfferingType.PRODUCT,
        canonicalKind: OfferingKind.PRODUCT,
        canonicalLifecycle: OfferingLifecycle.ACTIVE,
        url: `https://example.test/${offering.id}`,
        locationIds: [],
      })),
    });
    const [subjectA, subjectB] = await Promise.all([
      resolveIntelligenceSubject(prisma, brandId, {
        type: "OFFERING",
        ref: offeringAId,
      }),
      resolveIntelligenceSubject(prisma, brandId, {
        type: "OFFERING",
        ref: offeringBId,
      }),
    ]);
    subjectAId = subjectA.id;
    subjectBId = subjectB.id;
    processorAId = (
      await createProcessor(
        subjectAId,
        IntelligenceProcessorExecutionStatus.COMPLETED,
        new Date("2026-08-27T01:00:00.000Z"),
      )
    ).id;
    processorBId = (
      await createProcessor(
        subjectBId,
        IntelligenceProcessorExecutionStatus.COMPLETED,
        new Date("2026-08-27T01:00:00.000Z"),
      )
    ).id;
  });

  afterAll(async () => {
    const brands = [brandId, otherBrandId];
    await prisma.intelligenceComponentTransition.deleteMany({
      where: { brandId: { in: brands } },
    });
    await prisma.intelligenceComponentCandidate.deleteMany({
      where: { brandId: { in: brands } },
    });
    await prisma.intelligenceCurrentComponent.deleteMany({
      where: { brandId: { in: brands } },
    });
    await prisma.intelligenceComponentGeneration.deleteMany({
      where: { brandId: { in: brands } },
    });
    await prisma.intelligenceObjectGeneration.deleteMany({
      where: { brandId: { in: brands } },
    });
    await prisma.intelligenceProcessorAttempt.deleteMany({
      where: { brandId: { in: brands } },
    });
    await prisma.intelligenceAction.deleteMany({
      where: { brandId: { in: brands } },
    });
    await prisma.intelligenceProcessorExecution.deleteMany({
      where: { brandId: { in: brands } },
    });
    await prisma.intelligenceExecution.deleteMany({
      where: { brandId: { in: brands } },
    });
    await prisma.intelligenceSubject.deleteMany({
      where: { brandId: { in: brands } },
    });
    await prisma.offering.deleteMany({
      where: { brandProfileId: { in: brands } },
    });
    await prisma.brandProfile.deleteMany({ where: { id: { in: brands } } });
    await prisma.$disconnect();
  });

  it("binds exact same-Brand Offerings and rejects cross-Brand resolution", async () => {
    expect(subjectAId).not.toBe(subjectBId);
    await expect(
      resolveIntelligenceSubject(prisma, brandId, {
        type: "OFFERING",
        ref: otherOfferingId,
      }),
    ).rejects.toMatchObject({ code: "TENANCY_VIOLATION" });

    const manifest = {
      processorId: "synthetic_subject_processor",
      processorVersion: "1",
      bundleId: "synthetic-subject-bundle",
      bundleVersion: "1",
      bundleContentHash: hash("bundle"),
    };
    const key = (subjectId: string, ref: string) =>
      processorLogicalKeyV2({
        brandId,
        subject: { id: subjectId, type: "OFFERING", ref },
        manifest,
        activeScope: [address(subjectId)],
        dependencyManifestHash: hash("dependency"),
        evidenceManifestHash: hash("evidence"),
        executionIntentKey: "same-intent",
      });
    expect(key(subjectAId, offeringAId)).toBe(
      key(subjectAId, offeringAId),
    );
    expect(key(subjectAId, offeringAId)).not.toBe(
      key(subjectBId, offeringBId),
    );
  });

  it("isolates sibling current, candidate, CAS, and stale completion state", async () => {
    const [initialA, initialB] = await Promise.all([
      createGeneration(
        subjectAId,
        "A protected",
        IntelligenceAuthority.BRAND_CONFIRMED,
      ),
      createGeneration(subjectBId, "B current"),
    ]);
    const [appliedA, appliedB] = await Promise.all([
      apply(subjectAId, initialA, { state: "ABSENT" }),
      apply(subjectBId, initialB, { state: "ABSENT" }),
    ]);
    expect(appliedA.outcomes[0].outcome).toBe("APPLIED_CURRENT");
    expect(appliedB.outcomes[0].outcome).toBe("APPLIED_CURRENT");

    const currentA = await currentRepository.getCurrent(address(subjectAId));
    const currentB = await currentRepository.getCurrent(address(subjectBId));
    expect(currentA?.id).not.toBe(currentB?.id);

    const [candidateA, nextB] = await Promise.all([
      createGeneration(subjectAId, "A proposed"),
      createGeneration(subjectBId, "B newer", undefined, initialB.id),
    ]);
    const [candidateResult, updatedB] = await Promise.all([
      apply(
        subjectAId,
        candidateA,
        {
          state: "PRESENT",
          generationId: initialA.id,
          revision: currentA!.revision,
        },
        processorAId,
      ),
      apply(subjectBId, nextB, {
        state: "PRESENT",
        generationId: initialB.id,
        revision: currentB!.revision,
      }),
    ]);
    expect(candidateResult.outcomes[0].outcome).toBe("RECORDED_CANDIDATE");
    expect(updatedB.outcomes[0].outcome).toBe("APPLIED_CURRENT");
    expect(
      await prisma.intelligenceComponentCandidate.count({
        where: { subjectId: subjectAId, status: "PENDING" },
      }),
    ).toBe(1);
    expect(
      await prisma.intelligenceComponentCandidate.count({
        where: { subjectId: subjectBId, status: "PENDING" },
      }),
    ).toBe(0);

    const newerA = await createGeneration(
      subjectAId,
      "A newer confirmed",
      IntelligenceAuthority.BRAND_CONFIRMED,
      initialA.id,
    );
    const advancedA = await apply(subjectAId, newerA, {
      state: "PRESENT",
      generationId: initialA.id,
      revision: currentA!.revision,
    });
    expect(advancedA.outcomes[0].outcome).toBe("APPLIED_CURRENT");

    const bBasis = await currentRepository.getCurrent(address(subjectBId));
    const [concurrentB1, concurrentB2] = await Promise.all([
      createGeneration(subjectBId, "B concurrent 1", undefined, nextB.id),
      createGeneration(subjectBId, "B concurrent 2"),
    ]);
    const concurrentOutcomes = await Promise.all([
      apply(subjectBId, concurrentB1, {
        state: "PRESENT",
        generationId: nextB.id,
        revision: bBasis!.revision,
      }),
      apply(subjectBId, concurrentB2, {
        state: "PRESENT",
        generationId: nextB.id,
        revision: bBasis!.revision,
      }),
    ]);
    expect(
      concurrentOutcomes.map((result) => result.outcomes[0].outcome).sort(),
    ).toEqual(["APPLIED_CURRENT", "REJECTED_CAS"]);
    const finalB = await currentRepository.getCurrent(address(subjectBId));

    const staleForA = await createGeneration(subjectAId, "A stale completion");
    const stale = await apply(subjectAId, staleForA, {
      state: "PRESENT",
      generationId: initialA.id,
      revision: currentA!.revision,
    });
    expect(stale.outcomes[0].outcome).toBe("REJECTED_CAS");
    expect(
      (await currentRepository.getCurrent(address(subjectAId)))
        ?.currentComponentGenerationId,
    ).toBe(newerA.id);
    expect(
      (await currentRepository.getCurrent(address(subjectBId)))
        ?.currentComponentGenerationId,
    ).toBe(finalB?.currentComponentGenerationId);
  });

  it("keeps refresh and failure runtime projections exact to one subject", async () => {
    await createProcessor(
      subjectAId,
      IntelligenceProcessorExecutionStatus.RUNNING,
      new Date("2026-08-27T02:00:00.000Z"),
    );
    expect(
      (
        await runtime.readExact(
          brandId,
          subjectAId,
          "synthetic_subject_processor",
          true,
        )
      ).activity,
    ).toBe("REFRESHING");
    expect(
      (
        await runtime.readExact(
          brandId,
          subjectBId,
          "synthetic_subject_processor",
          true,
        )
      ).activity,
    ).toBe("IDLE");

    await createProcessor(
      subjectAId,
      IntelligenceProcessorExecutionStatus.FAILED_TERMINAL,
      new Date("2026-08-27T03:00:00.000Z"),
    );
    const failedA = await runtime.readExact(
      brandId,
      subjectAId,
      "synthetic_subject_processor",
      true,
    );
    expect(failedA.activity).toBe("TEMPORARILY_UNAVAILABLE");
    expect(failedA.failure?.currentPreserved).toBe(true);
    expect(
      (
        await runtime.readExact(
          brandId,
          subjectBId,
          "synthetic_subject_processor",
          true,
        )
      ).activity,
    ).toBe("IDLE");
    expect(processorBId).not.toBe(processorAId);
  });
});
