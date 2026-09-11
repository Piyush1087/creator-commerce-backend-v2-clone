import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramIntelligenceConnectionReadService } from "../../brand-settings/services/instagram-intelligence-provider-read.service";
import { IntelligenceCurrentProjectionService } from "../../brand-intelligence/projection/intelligence-current-projection.service";
import { ContractBundleIntegrityVerifier } from "../../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { BundlePathOwnershipRegistry } from "../../brand-intelligence/contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../../brand-intelligence/contracts/registry/contract-runtime.registry";
import { PersistenceTransitionValidator } from "../../brand-intelligence/contracts/validation/persistence-transition.validator";
import { SemanticValidator } from "../../brand-intelligence/contracts/validation/semantic.validator";
import { StructuralValidator } from "../../brand-intelligence/contracts/validation/structural.validator";
import { ExecutionAggregationService } from "../../brand-intelligence/execution/execution-aggregation.service";
import { ProcessorExecutorRegistry } from "../../brand-intelligence/execution/executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "../../brand-intelligence/execution/executor/synthetic-processor.executor";
import { IntelligenceExecutionService } from "../../brand-intelligence/execution/intelligence-execution.service";
import { RetryBackoffPolicy } from "../../brand-intelligence/execution/policy/retry-backoff.policy";
import { ProcessorExecutionRepository } from "../../brand-intelligence/execution/processor-execution.repository";
import { ProcessorFinalizationService } from "../../brand-intelligence/execution/processor-finalization.service";
import { ProcessorPersistenceRouter } from "../../brand-intelligence/execution/processor-persistence.router";
import { ProcessorWorkerService } from "../../brand-intelligence/execution/processor-worker.service";
import { ExecutionContractGate } from "../../brand-intelligence/execution/registry/execution-contract.gate";
import { IntelligenceActionRepository } from "../../brand-intelligence/persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "../../brand-intelligence/persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "../../brand-intelligence/persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "../../brand-intelligence/persistence/intelligence-generation.repository";
import { IntelligenceCurrentContractScopeService } from "../../brand-intelligence/projection/intelligence-current-contract-scope.service";
import { IntelligenceCurrentProjectionRepository } from "../../brand-intelligence/projection/intelligence-current-projection.repository";
import { IntelligenceObjectAssembler } from "../../brand-intelligence/projection/intelligence-object-assembler";
import { ComponentPathCodec } from "../../brand-intelligence/semantic-path/component-path.codec";
import { IntelligenceTransitionService } from "../../brand-intelligence/transitions/intelligence-transition.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import { InstagramB4ConsumerService } from "../consumer/instagram-b4-consumer.service";
import { InstagramB3aImagePipelineService } from "../media/instagram-b3a-image-pipeline.service";
import { InstagramB3aVisualModelPort } from "../media/instagram-b3a-visual-observation";
import { InstagramContentBehaviorRuntimeService } from "./instagram-content-behavior.runtime.service";
import { InstagramContentBehaviorProcessor } from "./instagram-content-behavior.processor";
import { InstagramContentBehaviorPersistenceHook } from "./instagram-content-behavior.persistence";

const databaseUrl = process.env.B4_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const postgres = databaseUrl ? describe : describe.skip;

class FixtureVisualModel extends InstagramB3aVisualModelPort {
  readonly providerIdentity = "DETERMINISTIC_FIXTURE";
  readonly modelIdentity = "fixture-image-observer";
  readonly modelProfileVersion = "fixture-v1";
  observe = vi.fn().mockResolvedValue({
    description: "A centered blue geometric composition.",
    visibleElements: ["blue rectangle"],
    dominantColors: ["blue"],
    composition: "Centered with an even margin.",
  });
}

postgres("B4 database-backed vertical slice", () => {
  let prisma: PrismaService;
  let root: string;
  let runtime: InstagramContentBehaviorRuntimeService;
  let consumer: InstagramB4ConsumerService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const codec = new ComponentPathCodec();
    const semantic = new SemanticValidator();
    const contracts = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      semantic,
    );
    contracts.verifyAtRoot(
      join(
        __dirname,
        "..",
        "..",
        "brand-intelligence",
        "generated",
        "contract-bundles",
      ),
    );
    const ownership = new BundlePathOwnershipRegistry(contracts, codec);
    const processor = new InstagramContentBehaviorProcessor(
      prisma,
      contracts,
      new StructuralValidator(),
      semantic,
    );
    const executors = new ProcessorExecutorRegistry(
      new SyntheticProcessorExecutor(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      processor,
    );
    const gate = new ExecutionContractGate(contracts, executors);
    const executions = new IntelligenceExecutionService(
      prisma,
      gate,
      ownership,
      codec,
    );
    const aggregation = new ExecutionAggregationService();
    const retry = new RetryBackoffPolicy();
    const repository = new ProcessorExecutionRepository(
      prisma,
      aggregation,
      retry,
    );
    const finalization = new ProcessorFinalizationService(
      prisma,
      repository,
      aggregation,
      retry,
    );
    const current = new IntelligenceCurrentStateRepository(prisma);
    const transitions = new IntelligenceTransitionService(
      prisma,
      current,
      new IntelligenceCandidateRepository(prisma),
      new IntelligenceActionRepository(prisma),
      codec,
    );
    const persistence = new InstagramContentBehaviorPersistenceHook(
      new IntelligenceGenerationRepository(prisma, codec),
      current,
      transitions,
      new PersistenceTransitionValidator(contracts, ownership),
      contracts,
    );
    const router = new ProcessorPersistenceRouter(
      undefined as never,
      undefined as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      persistence,
    );
    const worker = new ProcessorWorkerService(
      repository,
      finalization,
      executors,
      router,
    );
    runtime = new InstagramContentBehaviorRuntimeService(executions, worker);
    const projection = new IntelligenceCurrentProjectionService(
      new IntelligenceCurrentProjectionRepository(prisma),
      new IntelligenceCurrentContractScopeService(contracts, ownership, codec),
      new IntelligenceObjectAssembler(codec),
    );
    consumer = new InstagramB4ConsumerService(
      prisma,
      new InstagramIntelligenceConnectionReadService(prisma),
      projection,
    );
    root = await mkdtemp(join(tmpdir(), "instagram-b4-vertical-"));
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("flows completed B3A Evidence through shared generation/current and preserves it after failure", async () => {
    const brand = await prisma.brandProfile.create({
      data: {
        domain: `b4-${randomUUID()}.example.test`,
        name: "B4 Fixture",
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    const otherBrand = await prisma.brandProfile.create({
      data: {
        domain: `b4-other-${randomUUID()}.example.test`,
        name: "B4 Other",
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    const providerAccountId = `account-${randomUUID()}`;
    const integration = await prisma.brandIntegration.create({
      data: {
        brandProfileId: brand.id,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        isActive: true,
        providerAccountId,
        providerAppScopedUserId: `app-${randomUUID()}`,
        currentPlatformHandle: "fixture-handle",
        authorizationGeneration: 7,
        credentialVersion: 2,
        identityVerification: "VERIFIED",
        authorizationHealth: "CONNECTED_FULL",
        firstPartyProfileCapability: "YES",
      },
    });

    const store = new InstagramImageTemporaryStore(join(root, "owned"));
    const acquisition = {
      acquire: vi
        .fn()
        .mockImplementation(
          async (input: { brandProfileId: string; mediaId: string }) => {
            const created = await store.create(input.brandProfileId);
            const bytes = Buffer.from("deterministic fixture image bytes");
            await created.handle.writeFile(bytes);
            await created.handle.close();
            return {
              artifact: {
                temporaryPath: created.path,
                mediaType: "image/png",
                byteLength: bytes.length,
                width: 2,
                height: 3,
                sha256: createHash("sha256").update(bytes).digest("hex"),
                acquiredAt: "2026-09-11T10:00:00.000Z",
              },
              providerMediaId: input.mediaId,
              providerObservedAt: "2026-09-10T08:00:00.000Z",
            };
          },
        ),
    };
    const pipeline = new InstagramB3aImagePipelineService(
      acquisition as never,
      new FixtureVisualModel(),
      new InstagramCaptureWriterService(prisma),
      store,
    );
    const b3a = await pipeline.execute({
      brandProfileId: brand.id,
      integrationId: integration.id,
      providerAccountId,
      authorizationGeneration: 7,
      mediaId: "one-image",
      selection: "SELECTED",
      now: () => new Date("2026-09-11T10:00:01.000Z"),
    });
    expect(b3a.reasonCode).toBe("INSPECTED");
    const evidenceRef = b3a.lineage?.evidenceRefs[0];
    expect(evidenceRef).toBeTruthy();

    const successInput = {
      kind: "INSTAGRAM_CONTENT_BEHAVIOR_B4_INPUT_V1" as const,
      brandProfileId: brand.id,
      integrationId: integration.id,
      providerAccountId,
      authorizationGeneration: 7,
      evidenceRef: evidenceRef!,
      windowEnd: "2026-09-11T10:00:01.000Z",
      triggerIdempotencyKey: "b4-success",
      correlationRef: "b4-success",
    };
    const success = await runtime.execute(successInput);
    expect(success.processorStatus).toBe("COMPLETED");
    const replay = await runtime.execute(successInput);
    expect(replay).toMatchObject({
      executionId: success.executionId,
      processorExecutionId: success.processorExecutionId,
      replayed: true,
    });

    const currentBefore =
      await prisma.intelligenceCurrentComponent.findFirstOrThrow({
        where: {
          brandId: brand.id,
          objectSemanticId: "instagram_content_behavior",
          componentSemanticPath: "$",
        },
        include: {
          currentComponentGeneration: {
            include: {
              objectGeneration: { include: { evidenceReferences: true } },
            },
          },
        },
      });
    expect(
      currentBefore.currentComponentGeneration.objectGeneration.evidenceReferences.map(
        (item) => item.evidenceRef,
      ),
    ).toEqual([evidenceRef]);
    expect(
      await prisma.intelligenceObjectGeneration.count({
        where: {
          brandId: brand.id,
          objectSemanticId: "instagram_content_behavior",
        },
      }),
    ).toBe(1);

    const failure = await runtime.execute({
      ...successInput,
      evidenceRef: "missing-evidence",
      triggerIdempotencyKey: "b4-failure",
      correlationRef: "b4-failure",
    });
    expect(failure.processorStatus).toBe("FAILED_TERMINAL");
    const currentAfter =
      await prisma.intelligenceCurrentComponent.findUniqueOrThrow({
        where: { id: currentBefore.id },
        include: {
          currentComponentGeneration: {
            include: {
              objectGeneration: { include: { evidenceReferences: true } },
            },
          },
        },
      });
    expect({
      id: currentAfter.id,
      revision: currentAfter.revision,
      generationId: currentAfter.currentComponentGenerationId,
      valueHash: currentAfter.currentComponentGeneration.valueHash,
      evidence:
        currentAfter.currentComponentGeneration.objectGeneration.evidenceReferences.map(
          (item) => item.evidenceRef,
        ),
    }).toEqual({
      id: currentBefore.id,
      revision: currentBefore.revision,
      generationId: currentBefore.currentComponentGenerationId,
      valueHash: currentBefore.currentComponentGeneration.valueHash,
      evidence: [evidenceRef],
    });

    const conflictingOffering = await prisma.offering.create({
      data: {
        brandProfileId: brand.id,
        type: "PRODUCT",
        name: "Adversarial subject fixture",
        url: "https://example.test/adversarial-subject",
        locationIds: [],
      },
    });
    const conflictingSubject = await prisma.intelligenceSubject.create({
      data: {
        brandId: brand.id,
        subjectType: "OFFERING",
        subjectRef: conflictingOffering.id,
        offeringId: conflictingOffering.id,
      },
    });
    const conflictingExecution = await prisma.intelligenceExecution.create({
      data: {
        brandId: brand.id,
        subjectId: conflictingSubject.id,
        triggerType: "ADVERSARIAL_SUBJECT_TEST",
        triggerRef: "other-subject",
        triggerIdempotencyKey: `other-subject-${randomUUID()}`,
        correlationRef: "other-subject",
        requestedImpact: {
          objectSemanticId: "instagram_content_behavior",
          componentSemanticPath: "$",
        },
        status: "COMPLETED",
      },
    });
    await prisma.intelligenceProcessorExecution.create({
      data: {
        executionId: conflictingExecution.id,
        brandId: brand.id,
        subjectId: conflictingSubject.id,
        processorId: "instagram_content_behavior",
        processorVersion: "1.0",
        bundleId:
          currentAfter.currentComponentGeneration.objectGeneration.bundleId,
        bundleVersion:
          currentAfter.currentComponentGeneration.objectGeneration
            .bundleVersion,
        bundleHash:
          currentAfter.currentComponentGeneration.objectGeneration.bundleHash,
        outputContractId: "instagram_content_behavior_output_contract",
        outputContractVersion: "1.0",
        activeScope: [
          {
            brandId: brand.id,
            subjectId: conflictingSubject.id,
            objectSemanticId: "instagram_content_behavior",
            pathSchemeVersion: 1,
            componentSemanticPath: "$",
          },
        ],
        activeScopeHash: createHash("sha256")
          .update(`scope:${conflictingSubject.id}`)
          .digest("hex"),
        dependencyManifest: {},
        dependencyManifestHash: createHash("sha256")
          .update(`dependency:${conflictingSubject.id}`)
          .digest("hex"),
        evidenceManifest: {},
        evidenceManifestHash: createHash("sha256")
          .update(`evidence:${conflictingSubject.id}`)
          .digest("hex"),
        triggerIntentKey: "other-subject",
        processorExecutionKey: createHash("sha256")
          .update(`processor:${conflictingSubject.id}`)
          .digest("hex"),
        maxAttempts: 1,
        status: "FAILED_TERMINAL",
        lastErrorCategory: "VALIDATION_FAILURE",
        lastErrorCode: "OTHER_SUBJECT_FAILURE_MUST_NOT_LEAK",
        createdAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    });

    const visible = await consumer.read(brand.id, new Date());
    expect(visible.contentBehavior).toMatchObject({
      currentPreserved: true,
      freshness: "CURRENT",
      readiness: "PARTIAL",
      evidence: { count: 1, refs: [evidenceRef] },
      limitation: "Not enough posts to identify patterns or learnings",
    });
    expect(visible.latestProcessing.state).toBe("DEGRADED");
    expect(visible.latestProcessing.reasonCode).toBe("B4_EVIDENCE_UNAVAILABLE");
    expect((await consumer.read(otherBrand.id)).contentBehavior).toBeNull();

    await prisma.brandIntegration.update({
      where: { id: integration.id },
      data: { authorizationGeneration: 8 },
    });
    expect((await consumer.read(brand.id)).contentBehavior).toBeNull();
    expect(
      (
        await runtime.execute({
          ...successInput,
          triggerIdempotencyKey: "b4-stale-generation",
          correlationRef: "b4-stale-generation",
        })
      ).processorStatus,
    ).toBe("FAILED_TERMINAL");
    await prisma.brandIntegration.update({
      where: { id: integration.id },
      data: {
        authorizationGeneration: 7,
        providerAccountId: "changed-account",
      },
    });
    expect((await consumer.read(brand.id)).contentBehavior).toBeNull();
    expect(
      (
        await runtime.execute({
          ...successInput,
          triggerIdempotencyKey: "b4-changed-account",
          correlationRef: "b4-changed-account",
        })
      ).processorStatus,
    ).toBe("FAILED_TERMINAL");
    expect(acquisition.acquire).toHaveBeenCalledTimes(1);
  }, 60_000);
});
