import {
  IndustryVertical,
  IntelligenceExecutionAggregateResult,
  IntelligenceExecutionStatus,
  IntelligenceProcessorAttemptStatus,
  IntelligenceProcessorExecutionStatus,
  IntelligenceReadiness,
  PrismaClient,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import { BundlePathOwnershipRegistry } from "../contracts/registry/bundle-path-ownership.registry";
import type { ContractRuntimeRegistry } from "../contracts/registry/contract-runtime.registry";
import { ComponentPathCodec } from "../semantic-path/component-path.codec";
import {
  SYNTHETIC_OUTPUT_CONTRACT_ID,
  SYNTHETIC_OUTPUT_CONTRACT_VERSION,
  SYNTHETIC_PROCESSOR_ID,
  SYNTHETIC_PROCESSOR_VERSION,
  type CreateIntelligenceExecutionCommand,
  type SyntheticProcessorScenario,
} from "./domain/intelligence-execution.types";
import { ExecutionAggregationService } from "./execution-aggregation.service";
import { ProcessorExecutorRegistry } from "./executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "./executor/synthetic-processor.executor";
import { IntelligenceExecutionService } from "./intelligence-execution.service";
import { RetryBackoffPolicy } from "./policy/retry-backoff.policy";
import { ProcessorExecutionRepository } from "./processor-execution.repository";
import { ProcessorFinalizationService } from "./processor-finalization.service";
import { NoopProcessorSuccessPersistenceHook } from "./processor-persistence.hook";
import { ProcessorWorkerService } from "./processor-worker.service";
import { ExecutionContractGate } from "./registry/execution-contract.gate";

const databaseEnabled =
  process.env.BRAND_INTELLIGENCE_EXECUTION_DATABASE_TEST === "true";
const hash = (seed: string) =>
  createHash("sha256").update(seed, "utf8").digest("hex");

describe.skipIf(!databaseEnabled)("W1.0D PostgreSQL execution runtime", () => {
  const prisma = new PrismaClient({
    transactionOptions: { maxWait: 10_000 },
  });
  const prismaService = prisma as unknown as PrismaService;
  const aggregation = new ExecutionAggregationService();
  const retryBackoff = new RetryBackoffPolicy();
  const repository = new ProcessorExecutionRepository(
    prismaService,
    aggregation,
    retryBackoff,
  );
  const finalization = new ProcessorFinalizationService(
    prismaService,
    repository,
    aggregation,
    retryBackoff,
  );
  const syntheticExecutor = new SyntheticProcessorExecutor();
  const executors = new ProcessorExecutorRegistry(syntheticExecutor);
  const contractRuntime = {
    isReady: () => true,
  } as unknown as ContractRuntimeRegistry;
  const codec = new ComponentPathCodec();
  const contractGate = new ExecutionContractGate(contractRuntime, executors);
  const service = new IntelligenceExecutionService(
    prismaService,
    contractGate,
    new BundlePathOwnershipRegistry(contractRuntime, codec),
    codec,
  );
  const persistenceHook = new NoopProcessorSuccessPersistenceHook();
  const worker = new ProcessorWorkerService(
    repository,
    finalization,
    executors,
    persistenceHook,
  );
  const brandId = randomUUID();

  function command(
    scenario: SyntheticProcessorScenario,
    options: {
      triggerKey?: string;
      intent?: string;
      dependency?: unknown;
      evidence?: unknown;
      maxAttempts?: number;
      dependencyEligible?: boolean;
      requestedImpact?: unknown;
    } = {},
  ): CreateIntelligenceExecutionCommand {
    return {
      brandId,
      triggerType: "W1_0D_DATABASE_TEST",
      triggerRef: `trigger:${randomUUID()}`,
      triggerIdempotencyKey: options.triggerKey ?? randomUUID(),
      correlationRef: `correlation:${randomUUID()}`,
      requestedImpact: (options.requestedImpact ?? {
        object: "synthetic",
      }) as never,
      processors: [
        {
          registryKey: {
            processorId: SYNTHETIC_PROCESSOR_ID,
            processorVersion: SYNTHETIC_PROCESSOR_VERSION,
            outputContractId: SYNTHETIC_OUTPUT_CONTRACT_ID,
            outputContractVersion: SYNTHETIC_OUTPUT_CONTRACT_VERSION,
          },
          activeScope: [
            {
              brandId,
              objectSemanticId: "synthetic_test_object",
              pathSchemeVersion: 1,
              componentSemanticPath: "$",
            },
          ],
          dependencyManifest: (options.dependency ?? { revision: 1 }) as never,
          evidenceManifest: (options.evidence ?? {
            evidence: ["one"],
          }) as never,
          executionIntentKey: options.intent ?? randomUUID(),
          maxAttempts: options.maxAttempts ?? 2,
          dependencyEligible: options.dependencyEligible ?? true,
          syntheticHarness: { explicit: true, scenario },
        },
      ],
    };
  }

  const leaseOf = (claim: Awaited<ReturnType<typeof repository.claimNext>>) => {
    if (!claim) throw new Error("Expected claimed work");
    return {
      processorExecutionId: claim.processorExecution.id,
      attemptId: claim.attempt.id,
      workerIdentity: claim.attempt.workerIdentityRef,
      leaseToken: claim.attempt.leaseToken,
    };
  };

  beforeAll(async () => {
    await prisma.brandProfile.create({
      data: {
        id: brandId,
        domain: `w1-0d-${brandId}.example`,
        name: "W1.0D PostgreSQL test",
        industry: IndustryVertical.D2C,
        brandValues: [],
        policyFlags: [],
        targetAudience: {},
      },
    });
  });

  afterAll(async () => {
    await prisma.intelligenceProcessorAttempt.deleteMany({
      where: { brandId },
    });
    await prisma.intelligenceProcessorExecution.deleteMany({
      where: { brandId },
    });
    await prisma.intelligenceExecution.deleteMany({ where: { brandId } });
    await prisma.brandProfile.delete({ where: { id: brandId } });
    await prisma.$disconnect();
  });

  it("converges duplicate trigger requests and rejects semantic replay drift", async () => {
    const triggerKey = randomUUID();
    const request = command("SUCCEED_READY", {
      triggerKey,
      intent: "same-work",
    });
    const [left, right] = await Promise.all([
      service.createOrReturn(request),
      service.createOrReturn(request),
    ]);
    expect(left.execution.id).toBe(right.execution.id);
    expect(
      await prisma.intelligenceExecution.count({
        where: { brandId, triggerIdempotencyKey: triggerKey },
      }),
    ).toBe(1);
    expect(
      await prisma.intelligenceProcessorExecution.count({
        where: { executionId: left.execution.id },
      }),
    ).toBe(1);
    await expect(
      service.createOrReturn({
        ...request,
        requestedImpact: { object: "different" },
      }),
    ).rejects.toMatchObject({ code: "EXECUTION_IDEMPOTENCY_CONFLICT" });
    await repository.cancelExecution(left.execution.id);
  });

  it("creates distinct logical work when dependency or Evidence identity changes", async () => {
    const intent = randomUUID();
    const baseline = await service.createOrReturn(
      command("SUCCEED_READY", { intent }),
    );
    const dependencyChanged = await service.createOrReturn(
      command("SUCCEED_READY", { intent, dependency: { revision: 2 } }),
    );
    const evidenceChanged = await service.createOrReturn(
      command("SUCCEED_READY", { intent, evidence: { evidence: ["two"] } }),
    );
    expect(
      new Set([
        baseline.processorExecutions[0].processorExecutionKey,
        dependencyChanged.processorExecutions[0].processorExecutionKey,
        evidenceChanged.processorExecutions[0].processorExecutionKey,
      ]).size,
    ).toBe(3);
    await Promise.all(
      [baseline, dependencyChanged, evidenceChanged].map((created) =>
        repository.cancelExecution(created.execution.id),
      ),
    );
  });

  it("uses SKIP LOCKED so concurrent workers create exactly one first attempt", async () => {
    const created = await service.createOrReturn(command("SUCCEED_READY"));
    const claims = await Promise.all([
      repository.claimNext("worker-a", 60_000),
      repository.claimNext("worker-b", 60_000),
    ]);
    const winners = claims.filter((claim) => claim !== null);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.attempt.attemptNumber).toBe(1);
    expect(
      await prisma.intelligenceProcessorAttempt.count({
        where: { processorExecutionId: created.processorExecutions[0].id },
      }),
    ).toBe(1);
    await expect(
      repository.heartbeat(
        { ...leaseOf(winners[0]!), leaseToken: randomUUID() },
        60_000,
      ),
    ).rejects.toMatchObject({ code: "LEASE_LOST" });
    await repository.cancelExecution(created.execution.id);
  });

  it("reclaims an expired lease once and rejects stale completion before persistence", async () => {
    const created = await service.createOrReturn(
      command("HANG_UNTIL_LEASE_EXPIRES", { maxAttempts: 2 }),
    );
    const claim = await repository.claimNext("stale-worker", 5);
    expect(claim).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const reclaimed = await Promise.all([
      repository.reclaimOne(),
      repository.reclaimOne(),
    ]);
    expect(reclaimed.filter(Boolean)).toHaveLength(1);
    let persistenceCalls = 0;
    await expect(
      finalization.complete(
        claim!,
        { readiness: IntelligenceReadiness.READY },
        {
          persistBeforeCompletion: async () => {
            persistenceCalls += 1;
          },
        },
      ),
    ).rejects.toMatchObject({ code: "LEASE_LOST" });
    expect(persistenceCalls).toBe(0);
    expect(
      await prisma.intelligenceProcessorAttempt.findUniqueOrThrow({
        where: { id: claim!.attempt.id },
      }),
    ).toMatchObject({ status: IntelligenceProcessorAttemptStatus.LEASE_LOST });

    await prisma.intelligenceProcessorExecution.update({
      where: { id: claim!.processorExecution.id },
      data: { eligibleAt: new Date() },
    });
    const retry = await repository.claimNext("replacement-worker", 60_000);
    expect(retry?.attempt.attemptNumber).toBe(2);
    await finalization.complete(
      retry!,
      { readiness: IntelligenceReadiness.READY },
      persistenceHook,
    );
    expect(
      await prisma.intelligenceExecution.findUniqueOrThrow({
        where: { id: created.execution.id },
      }),
    ).toMatchObject({
      status: IntelligenceExecutionStatus.COMPLETED,
      aggregateResult: IntelligenceExecutionAggregateResult.SUCCEEDED,
    });
  });

  it("classifies retry, exhaustion, and explicit dependency wake-up", async () => {
    const retryable = await service.createOrReturn(
      command("FAIL_RETRYABLE", { maxAttempts: 2 }),
    );
    const first = await repository.claimNext("retry-worker", 60_000);
    const queued = await finalization.fail(first!, {
      category: "RETRYABLE_TECHNICAL",
      code: "TRANSIENT",
    });
    expect(queued.status).toBe(IntelligenceProcessorExecutionStatus.QUEUED);
    await prisma.intelligenceProcessorExecution.update({
      where: { id: queued.id },
      data: { eligibleAt: new Date() },
    });
    const second = await repository.claimNext("retry-worker", 60_000);
    const exhausted = await finalization.fail(second!, {
      category: "RETRYABLE_TECHNICAL",
      code: "TRANSIENT",
    });
    expect(exhausted).toMatchObject({
      status: IntelligenceProcessorExecutionStatus.FAILED_TERMINAL,
      lastErrorCode: "ATTEMPT_EXHAUSTED",
      attemptCount: 2,
    });
    expect(
      (
        await prisma.intelligenceProcessorAttempt.findMany({
          where: { processorExecutionId: exhausted.id },
          orderBy: { attemptNumber: "asc" },
          select: { attemptNumber: true },
        })
      ).map((attempt) => attempt.attemptNumber),
    ).toEqual([1, 2]);
    expect(
      await prisma.intelligenceExecution.findUniqueOrThrow({
        where: { id: retryable.execution.id },
      }),
    ).toMatchObject({
      status: IntelligenceExecutionStatus.FAILED,
      aggregateResult: IntelligenceExecutionAggregateResult.FAILED,
    });

    const dependency = await service.createOrReturn(
      command("WAIT_DEPENDENCY", { dependencyEligible: false }),
    );
    expect(await repository.claimNext("blind-poller", 60_000)).toBeNull();
    const resumed = await repository.resumeDependency({
      processorExecutionId: dependency.processorExecutions[0].id,
      expectedAttemptCount: 0,
    });
    expect(resumed.status).toBe(IntelligenceProcessorExecutionStatus.QUEUED);
    await repository.cancelExecution(dependency.execution.id);
  });

  it("cancels queued and active work and makes stale completion impossible", async () => {
    const queued = await service.createOrReturn(command("SUCCEED_READY"));
    await repository.cancelExecution(queued.execution.id);
    expect(await repository.claimNext("after-cancel", 60_000)).toBeNull();

    const active = await service.createOrReturn(command("SUCCEED_READY"));
    const claim = await repository.claimNext("active-worker", 60_000);
    const cancelled = await repository.cancelExecution(active.execution.id);
    expect(cancelled.cancelledProcessorExecutionIds).toEqual([
      active.processorExecutions[0].id,
    ]);
    await expect(
      finalization.complete(
        claim!,
        { readiness: IntelligenceReadiness.READY },
        persistenceHook,
      ),
    ).rejects.toMatchObject({ code: "LEASE_LOST" });
    expect(
      await prisma.intelligenceProcessorAttempt.findUniqueOrThrow({
        where: { id: claim!.attempt.id },
      }),
    ).toMatchObject({ status: IntelligenceProcessorAttemptStatus.CANCELLED });
  });

  it("records executor-internal retries in one successful attempt", async () => {
    const created = await service.createOrReturn(
      command("INTERNAL_RETRY_THEN_SUCCESS", { maxAttempts: 3 }),
    );
    const result = await worker.runOnce("synthetic-worker", 60_000);
    expect(result.processorExecution).toMatchObject({
      id: created.processorExecutions[0].id,
      status: IntelligenceProcessorExecutionStatus.COMPLETED,
      attemptCount: 1,
      resultReadiness: IntelligenceReadiness.READY,
    });
    const attempt = await prisma.intelligenceProcessorAttempt.findUniqueOrThrow(
      {
        where: { id: result.claim.attempt.id },
      },
    );
    expect(attempt.runtimeTelemetry).toEqual({
      internalSubcallCount: 2,
      internalRetries: 1,
    });
  });

  it("keeps a parent non-terminal while any child waits for a dependency", async () => {
    const waiting = await service.createOrReturn(
      command("WAIT_DEPENDENCY", { dependencyEligible: false }),
    );
    const execution = await prisma.intelligenceExecution.create({
      data: {
        brandId,
        triggerType: "WAITING_AGGREGATION_TEST",
        triggerRef: randomUUID(),
        triggerIdempotencyKey: randomUUID(),
        correlationRef: randomUUID(),
        requestedImpact: {},
      },
    });
    await prisma.intelligenceProcessorExecution.update({
      where: { id: waiting.processorExecutions[0].id },
      data: { executionId: execution.id },
    });
    await prisma.intelligenceProcessorExecution.create({
      data: {
        executionId: execution.id,
        brandId,
        processorId: "completed-sibling",
        processorVersion: "1",
        bundleId: "aggregate-test",
        bundleVersion: "1",
        bundleHash: hash("waiting-bundle"),
        outputContractId: "aggregate.output",
        outputContractVersion: "1",
        activeScope: [],
        activeScopeHash: hash("waiting-scope"),
        dependencyManifest: {},
        dependencyManifestHash: hash("waiting-dependency"),
        evidenceManifest: {},
        evidenceManifestHash: hash("waiting-evidence"),
        triggerIntentKey: randomUUID(),
        processorExecutionKey: hash(`waiting-key-${execution.id}`),
        maxAttempts: 1,
        status: IntelligenceProcessorExecutionStatus.COMPLETED,
        resultReadiness: IntelligenceReadiness.READY,
        completedAt: new Date(),
      },
    });
    await prisma.$transaction((tx) =>
      aggregation.refreshInTransaction(tx, execution.id, new Date()),
    );
    expect(
      await prisma.intelligenceExecution.findUniqueOrThrow({
        where: { id: execution.id },
      }),
    ).toMatchObject({
      status: IntelligenceExecutionStatus.PENDING,
      aggregateResult: null,
      completedAt: null,
    });
  });

  it.each([
    {
      name: "all usable",
      children: [
        [
          IntelligenceProcessorExecutionStatus.COMPLETED,
          IntelligenceReadiness.READY,
        ],
        [
          IntelligenceProcessorExecutionStatus.COMPLETED,
          IntelligenceReadiness.PARTIAL,
        ],
      ],
      status: IntelligenceExecutionStatus.COMPLETED,
      result: IntelligenceExecutionAggregateResult.SUCCEEDED,
    },
    {
      name: "mixed usable and failure",
      children: [
        [
          IntelligenceProcessorExecutionStatus.COMPLETED,
          IntelligenceReadiness.READY,
        ],
        [IntelligenceProcessorExecutionStatus.FAILED_TERMINAL, null],
      ],
      status: IntelligenceExecutionStatus.COMPLETED,
      result: IntelligenceExecutionAggregateResult.PARTIAL,
    },
    {
      name: "all failed",
      children: [
        [IntelligenceProcessorExecutionStatus.FAILED_TERMINAL, null],
        [IntelligenceProcessorExecutionStatus.FAILED_TERMINAL, null],
      ],
      status: IntelligenceExecutionStatus.FAILED,
      result: IntelligenceExecutionAggregateResult.FAILED,
    },
    {
      name: "completed but not ready",
      children: [
        [
          IntelligenceProcessorExecutionStatus.COMPLETED,
          IntelligenceReadiness.NOT_READY,
        ],
        [
          IntelligenceProcessorExecutionStatus.COMPLETED,
          IntelligenceReadiness.NOT_READY,
        ],
      ],
      status: IntelligenceExecutionStatus.COMPLETED,
      result: IntelligenceExecutionAggregateResult.NO_RESULT,
    },
  ])("derives $name aggregate state", async ({ children, status, result }) => {
    const execution = await prisma.intelligenceExecution.create({
      data: {
        brandId,
        triggerType: "AGGREGATION_TEST",
        triggerRef: randomUUID(),
        triggerIdempotencyKey: randomUUID(),
        correlationRef: randomUUID(),
        requestedImpact: {},
      },
    });
    for (const [index, [childStatus, readiness]] of children.entries()) {
      const terminal =
        childStatus === IntelligenceProcessorExecutionStatus.COMPLETED ||
        childStatus === IntelligenceProcessorExecutionStatus.FAILED_TERMINAL;
      await prisma.intelligenceProcessorExecution.create({
        data: {
          executionId: execution.id,
          brandId,
          processorId: `aggregate-${index}`,
          processorVersion: "1",
          bundleId: "aggregate-test",
          bundleVersion: "1",
          bundleHash: hash(`bundle-${index}`),
          outputContractId: "aggregate.output",
          outputContractVersion: "1",
          activeScope: [],
          activeScopeHash: hash(`scope-${execution.id}-${index}`),
          dependencyManifest: {},
          dependencyManifestHash: hash(`dependency-${index}`),
          evidenceManifest: {},
          evidenceManifestHash: hash(`evidence-${index}`),
          triggerIntentKey: randomUUID(),
          processorExecutionKey: hash(`key-${execution.id}-${index}`),
          maxAttempts: 1,
          status: childStatus,
          resultReadiness: readiness,
          completedAt: terminal ? new Date() : null,
        },
      });
    }
    await prisma.$transaction((tx) =>
      aggregation.refreshInTransaction(tx, execution.id, new Date()),
    );
    expect(
      await prisma.intelligenceExecution.findUniqueOrThrow({
        where: { id: execution.id },
      }),
    ).toMatchObject({ status, aggregateResult: result });
  });
});
