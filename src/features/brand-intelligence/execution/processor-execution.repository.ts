import { Injectable } from "@nestjs/common";
import {
  IntelligenceExecutionStatus,
  IntelligenceProcessorAttemptStatus,
  IntelligenceProcessorExecutionStatus,
  Prisma,
  type IntelligenceProcessorAttempt,
  type IntelligenceProcessorExecution,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { executionErrorBoundary } from "./domain/execution-error-boundary";
import { IntelligenceExecutionError } from "./domain/intelligence-execution.error";
import type {
  CancellationResult,
  ClaimedProcessorWork,
  DependencyResumeCommand,
  LeaseIdentity,
} from "./domain/intelligence-execution.types";
import { ExecutionAggregationService } from "./execution-aggregation.service";
import { RetryBackoffPolicy } from "./policy/retry-backoff.policy";

interface DatabaseClockRow {
  readonly now: Date;
}

@Injectable()
export class ProcessorExecutionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregation: ExecutionAggregationService,
    private readonly retryBackoff: RetryBackoffPolicy,
  ) {}

  async claimNext(
    workerIdentity: string,
    leaseDurationMs: number,
  ): Promise<ClaimedProcessorWork | null> {
    this.assertLeaseDuration(leaseDurationMs);
    return executionErrorBoundary(
      () =>
        this.prisma.$transaction(async (tx) => {
          const now = await this.databaseNow(tx);
          const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "processor_execution_id" AS "id"
        FROM "intelligence_processor_executions"
        WHERE "status" = 'QUEUED'::"IntelligenceProcessorExecutionStatus"
          AND "eligible_at" IS NOT NULL
          AND "eligible_at" <= ${now}
          AND "lease_token" IS NULL
          AND "attempt_count" < "max_attempts"
        ORDER BY "eligible_at" ASC, "created_at" ASC, "processor_execution_id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);
          if (!rows[0]) return null;
          const current = await this.readProcessorRaw(tx, rows[0].id);
          const attemptNumber = current.attemptCount + 1;
          const leaseToken = randomUUID();
          const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
          await tx.$executeRaw(Prisma.sql`
            UPDATE intelligence_processor_executions
            SET status='RUNNING'::"IntelligenceProcessorExecutionStatus",
              attempt_count=${attemptNumber}, lease_token=${leaseToken},
              lease_owner_ref=${workerIdentity}, lease_expires_at=${leaseExpiresAt},
              last_heartbeat_at=${now}, started_at=COALESCE(started_at, ${now}),
              completed_at=NULL, updated_at=${now}
            WHERE processor_execution_id=${current.id}
          `);
          const processorExecution = await this.readProcessorRaw(
            tx,
            current.id,
          );
          const attempt = await this.createAttempt(
            tx,
            current,
            attemptNumber,
            workerIdentity,
            leaseToken,
            now,
            leaseExpiresAt,
          );
          await tx.$executeRaw(Prisma.sql`
        UPDATE "intelligence_executions"
        SET "status" = 'RUNNING'::"IntelligenceExecutionStatus",
            "started_at" = COALESCE("started_at", ${now})
        WHERE "execution_id" = ${current.executionId}
          AND "status" IN (
            'PENDING'::"IntelligenceExecutionStatus",
            'RUNNING'::"IntelligenceExecutionStatus"
          )
      `);
          return { processorExecution, attempt };
        }),
      "Processor claim failed a persistence invariant",
    );
  }

  /** Direct bounded execution path for an already-created exact processor identity. */
  async claimExact(
    processorExecutionId: string,
    workerIdentity: string,
    leaseDurationMs: number,
  ): Promise<ClaimedProcessorWork | null> {
    this.assertLeaseDuration(leaseDurationMs);
    return executionErrorBoundary(
      () =>
        this.prisma.$transaction(async (tx) => {
          const now = await this.databaseNow(tx);
          const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "processor_execution_id" AS "id"
        FROM "intelligence_processor_executions"
        WHERE "processor_execution_id" = ${processorExecutionId}
          AND "status" = 'QUEUED'::"IntelligenceProcessorExecutionStatus"
          AND "eligible_at" IS NOT NULL
          AND "eligible_at" <= ${now}
          AND "lease_token" IS NULL
          AND "attempt_count" < "max_attempts"
        FOR UPDATE SKIP LOCKED
      `);
          if (!rows[0]) return null;
          const current = await this.readProcessorRaw(tx, rows[0].id);
          const attemptNumber = current.attemptCount + 1;
          const leaseToken = randomUUID();
          const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
          await tx.$executeRaw(Prisma.sql`
            UPDATE intelligence_processor_executions
            SET status='RUNNING'::"IntelligenceProcessorExecutionStatus",
              attempt_count=${attemptNumber}, lease_token=${leaseToken},
              lease_owner_ref=${workerIdentity}, lease_expires_at=${leaseExpiresAt},
              last_heartbeat_at=${now}, started_at=COALESCE(started_at, ${now}),
              completed_at=NULL, updated_at=${now}
            WHERE processor_execution_id=${current.id}
          `);
          const processorExecution = await this.readProcessorRaw(
            tx,
            current.id,
          );
          const attempt = await this.createAttempt(
            tx,
            current,
            attemptNumber,
            workerIdentity,
            leaseToken,
            now,
            leaseExpiresAt,
          );
          await tx.$executeRaw(Prisma.sql`
            UPDATE intelligence_executions
            SET status='RUNNING'::"IntelligenceExecutionStatus",
              started_at=COALESCE(started_at, ${now})
            WHERE execution_id=${current.executionId}
              AND status IN ('PENDING'::"IntelligenceExecutionStatus", 'RUNNING'::"IntelligenceExecutionStatus")
          `);
          return { processorExecution, attempt };
        }),
      "Exact Processor claim failed a persistence invariant",
    );
  }

  async heartbeat(
    lease: LeaseIdentity,
    leaseDurationMs: number,
  ): Promise<Date> {
    this.assertLeaseDuration(leaseDurationMs);
    return executionErrorBoundary(
      () =>
        this.prisma.$transaction(async (tx) => {
          const now = await this.databaseNow(tx);
          const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
          const processor = await tx.intelligenceProcessorExecution.updateMany({
            where: {
              id: lease.processorExecutionId,
              status: IntelligenceProcessorExecutionStatus.RUNNING,
              leaseToken: lease.leaseToken,
              leaseOwnerRef: lease.workerIdentity,
              leaseExpiresAt: { gt: now },
            },
            data: { leaseExpiresAt, lastHeartbeatAt: now },
          });
          if (processor.count !== 1) this.leaseLost();
          const attempt = await tx.intelligenceProcessorAttempt.updateMany({
            where: {
              id: lease.attemptId,
              processorExecutionId: lease.processorExecutionId,
              workerIdentityRef: lease.workerIdentity,
              leaseToken: lease.leaseToken,
              status: IntelligenceProcessorAttemptStatus.RUNNING,
              leaseExpiresAt: { gt: now },
            },
            data: { leaseExpiresAt, lastHeartbeatAt: now },
          });
          if (attempt.count !== 1) this.leaseLost();
          return leaseExpiresAt;
        }),
      "Processor heartbeat failed a persistence invariant",
    );
  }

  async resumeDependency(
    command: DependencyResumeCommand,
  ): Promise<IntelligenceProcessorExecution> {
    return executionErrorBoundary(
      () =>
        this.prisma.$transaction(async (tx) => {
          const now = await this.databaseNow(tx);
          const updated = await tx.intelligenceProcessorExecution.updateMany({
            where: {
              id: command.processorExecutionId,
              status:
                IntelligenceProcessorExecutionStatus.WAITING_FOR_DEPENDENCY,
              attemptCount: command.expectedAttemptCount,
              leaseToken: null,
            },
            data: {
              status: IntelligenceProcessorExecutionStatus.QUEUED,
              eligibleAt: now,
              lastErrorCategory: null,
              lastErrorCode: null,
            },
          });
          if (updated.count !== 1) {
            throw new IntelligenceExecutionError(
              "INVALID_EXECUTION_STATE",
              "Dependency signal did not match the expected waiting execution state",
            );
          }
          return tx.intelligenceProcessorExecution.findUniqueOrThrow({
            where: { id: command.processorExecutionId },
          });
        }),
      "Dependency resume failed a persistence invariant",
    );
  }

  async reclaimOne(): Promise<ClaimedProcessorWork | null> {
    return executionErrorBoundary(
      () =>
        this.prisma.$transaction(async (tx) => {
          const now = await this.databaseNow(tx);
          const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "processor_execution_id" AS "id"
        FROM "intelligence_processor_executions"
        WHERE "status" = 'RUNNING'::"IntelligenceProcessorExecutionStatus"
          AND "lease_expires_at" IS NOT NULL
          AND "lease_expires_at" <= ${now}
        ORDER BY "lease_expires_at" ASC, "processor_execution_id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);
          if (!rows[0]) return null;
          const current =
            await tx.intelligenceProcessorExecution.findUniqueOrThrow({
              where: { id: rows[0].id },
            });
          const attempt = await tx.intelligenceProcessorAttempt.findFirst({
            where: {
              processorExecutionId: current.id,
              leaseToken: current.leaseToken!,
              status: IntelligenceProcessorAttemptStatus.RUNNING,
            },
          });
          if (!attempt) {
            throw new IntelligenceExecutionError(
              "INVALID_EXECUTION_STATE",
              "Expired execution has no matching RUNNING attempt",
            );
          }
          await tx.$queryRaw(Prisma.sql`
        SELECT "attempt_id"
        FROM "intelligence_processor_attempts"
        WHERE "attempt_id" = ${attempt.id}
        FOR UPDATE
      `);
          const lostAttempt = await tx.intelligenceProcessorAttempt.update({
            where: { id: attempt.id },
            data: {
              status: IntelligenceProcessorAttemptStatus.LEASE_LOST,
              completedAt: now,
              errorCategory: "LEASE_LOST",
              errorCode: "LEASE_EXPIRED_RECLAIMED",
            },
          });
          const attemptsRemain = current.attemptCount < current.maxAttempts;
          const processorExecution =
            await tx.intelligenceProcessorExecution.update({
              where: { id: current.id },
              data: {
                status: attemptsRemain
                  ? IntelligenceProcessorExecutionStatus.QUEUED
                  : IntelligenceProcessorExecutionStatus.FAILED_TERMINAL,
                eligibleAt: attemptsRemain
                  ? this.retryBackoff.eligibilityAfter(
                      current.attemptCount,
                      now,
                    )
                  : null,
                leaseToken: null,
                leaseOwnerRef: null,
                leaseExpiresAt: null,
                lastHeartbeatAt: null,
                lastErrorCategory: "LEASE_LOST",
                lastErrorCode: attemptsRemain
                  ? "LEASE_EXPIRED_RECLAIMED"
                  : "ATTEMPT_EXHAUSTED",
                completedAt: attemptsRemain ? null : now,
              },
            });
          await this.aggregation.refreshInTransaction(
            tx,
            current.executionId,
            now,
          );
          return { processorExecution, attempt: lostAttempt };
        }),
      "Lease reclaim failed a persistence invariant",
    );
  }

  async cancelExecution(executionId: string): Promise<CancellationResult> {
    return executionErrorBoundary(
      () =>
        this.prisma.$transaction(async (tx) => {
          const now = await this.databaseNow(tx);
          await tx.$queryRaw(Prisma.sql`
        SELECT "execution_id"
        FROM "intelligence_executions"
        WHERE "execution_id" = ${executionId}
        FOR UPDATE
      `);
          const execution = await tx.intelligenceExecution.findUnique({
            where: { id: executionId },
          });
          if (!execution) {
            throw new IntelligenceExecutionError(
              "INVALID_EXECUTION_STATE",
              "Intelligence execution does not exist",
            );
          }
          if (execution.status === IntelligenceExecutionStatus.CANCELLED) {
            return { executionId, cancelledProcessorExecutionIds: [] };
          }
          if (
            execution.status === IntelligenceExecutionStatus.COMPLETED ||
            execution.status === IntelligenceExecutionStatus.FAILED
          ) {
            throw new IntelligenceExecutionError(
              "INVALID_EXECUTION_STATE",
              "A terminal Intelligence execution cannot be cancelled",
            );
          }
          const children = await tx.intelligenceProcessorExecution.findMany({
            where: { executionId },
            orderBy: { id: "asc" },
          });
          const cancelledIds: string[] = [];
          for (const child of children) {
            await tx.$queryRaw(Prisma.sql`
          SELECT "processor_execution_id"
          FROM "intelligence_processor_executions"
          WHERE "processor_execution_id" = ${child.id}
          FOR UPDATE
        `);
            if (
              child.status === IntelligenceProcessorExecutionStatus.COMPLETED ||
              child.status ===
                IntelligenceProcessorExecutionStatus.FAILED_TERMINAL ||
              child.status === IntelligenceProcessorExecutionStatus.CANCELLED
            ) {
              continue;
            }
            if (child.status === IntelligenceProcessorExecutionStatus.RUNNING) {
              await tx.intelligenceProcessorAttempt.updateMany({
                where: {
                  processorExecutionId: child.id,
                  leaseToken: child.leaseToken!,
                  status: IntelligenceProcessorAttemptStatus.RUNNING,
                },
                data: {
                  status: IntelligenceProcessorAttemptStatus.CANCELLED,
                  completedAt: now,
                  errorCategory: "CANCELLED",
                  errorCode: "EXECUTION_CANCELLED",
                },
              });
            }
            await tx.intelligenceProcessorExecution.update({
              where: { id: child.id },
              data: {
                status: IntelligenceProcessorExecutionStatus.CANCELLED,
                resultReadiness: null,
                eligibleAt: null,
                leaseToken: null,
                leaseOwnerRef: null,
                leaseExpiresAt: null,
                lastHeartbeatAt: null,
                lastErrorCategory: "CANCELLED",
                lastErrorCode: "EXECUTION_CANCELLED",
                completedAt: now,
              },
            });
            cancelledIds.push(child.id);
          }
          await tx.intelligenceExecution.update({
            where: { id: executionId },
            data: {
              status: IntelligenceExecutionStatus.CANCELLED,
              aggregateResult: null,
              completedAt: now,
            },
          });
          return { executionId, cancelledProcessorExecutionIds: cancelledIds };
        }),
      "Execution cancellation failed a persistence invariant",
    );
  }

  async lockLiveLease(
    tx: Prisma.TransactionClient,
    lease: LeaseIdentity,
  ): Promise<{
    processorExecution: IntelligenceProcessorExecution;
    attempt: IntelligenceProcessorAttempt;
    now: Date;
  }> {
    const now = await this.databaseNow(tx);
    await tx.$queryRaw(Prisma.sql`
      SELECT "processor_execution_id"
      FROM "intelligence_processor_executions"
      WHERE "processor_execution_id" = ${lease.processorExecutionId}
      FOR UPDATE
    `);
    const processorExecution = await this.readProcessorRawOrNull(
      tx,
      lease.processorExecutionId,
    );
    await tx.$queryRaw(Prisma.sql`
      SELECT "attempt_id"
      FROM "intelligence_processor_attempts"
      WHERE "attempt_id" = ${lease.attemptId}
      FOR UPDATE
    `);
    const attempt = await this.readAttemptRawOrNull(tx, lease.attemptId);
    if (
      !processorExecution ||
      !attempt ||
      processorExecution.status !==
        IntelligenceProcessorExecutionStatus.RUNNING ||
      processorExecution.leaseToken !== lease.leaseToken ||
      processorExecution.leaseOwnerRef !== lease.workerIdentity ||
      !processorExecution.leaseExpiresAt ||
      processorExecution.leaseExpiresAt <= now ||
      attempt.processorExecutionId !== lease.processorExecutionId ||
      attempt.status !== IntelligenceProcessorAttemptStatus.RUNNING ||
      attempt.leaseToken !== lease.leaseToken ||
      attempt.workerIdentityRef !== lease.workerIdentity ||
      attempt.leaseExpiresAt <= now
    ) {
      this.leaseLost();
    }
    return { processorExecution, attempt, now };
  }

  private async databaseNow(tx: Prisma.TransactionClient): Promise<Date> {
    const rows = await tx.$queryRaw<DatabaseClockRow[]>(Prisma.sql`
      SELECT CURRENT_TIMESTAMP AS "now"
    `);
    return rows[0].now;
  }

  private async createAttempt(
    tx: Prisma.TransactionClient,
    current: IntelligenceProcessorExecution,
    attemptNumber: number,
    workerIdentity: string,
    leaseToken: string,
    now: Date,
    leaseExpiresAt: Date,
  ): Promise<IntelligenceProcessorAttempt> {
    if ((current.brandId as string | null) !== null) {
      return tx.intelligenceProcessorAttempt.create({
        data: {
          processorExecutionId: current.id,
          brandId: current.brandId,
          attemptNumber,
          workerIdentityRef: workerIdentity,
          leaseToken,
          leaseAcquiredAt: now,
          leaseExpiresAt,
          lastHeartbeatAt: now,
        },
      });
    }
    const attemptId = randomUUID();
    const scope = await tx.$queryRaw<Array<{ ownerScopeId: string }>>(
      Prisma.sql`SELECT owner_scope_id AS "ownerScopeId"
        FROM intelligence_processor_executions
        WHERE processor_execution_id=${current.id}`,
    );
    if (!scope[0]) this.leaseLost();
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO intelligence_processor_attempts
        (attempt_id, processor_execution_id, owner_scope_id, brand_id,
         attempt_number, worker_identity_ref, lease_token, lease_acquired_at,
         lease_expires_at, last_heartbeat_at, status)
      VALUES (${attemptId}, ${current.id}, ${scope[0].ownerScopeId}, NULL,
        ${attemptNumber}, ${workerIdentity}, ${leaseToken}, ${now},
        ${leaseExpiresAt}, ${now}, 'RUNNING'::"IntelligenceProcessorAttemptStatus")
    `);
    return this.readAttemptRaw(tx, attemptId);
  }

  async readProcessorRaw(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<IntelligenceProcessorExecution> {
    const row = await this.readProcessorRawOrNull(tx, id);
    if (!row) this.leaseLost();
    return row;
  }

  private async readProcessorRawOrNull(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<IntelligenceProcessorExecution | null> {
    const rows = await tx.$queryRaw<
      IntelligenceProcessorExecution[]
    >(Prisma.sql`
      SELECT processor_execution_id AS id, execution_id AS "executionId",
        brand_id AS "brandId", owner_scope_id AS "ownerScopeId",
        subject_id AS "subjectId", processor_id AS "processorId",
        processor_version AS "processorVersion", bundle_id AS "bundleId",
        bundle_version AS "bundleVersion", bundle_hash AS "bundleHash",
        output_contract_id AS "outputContractId",
        output_contract_version AS "outputContractVersion",
        active_scope AS "activeScope", active_scope_hash AS "activeScopeHash",
        dependency_manifest AS "dependencyManifest",
        dependency_manifest_hash AS "dependencyManifestHash",
        evidence_manifest AS "evidenceManifest",
        evidence_manifest_hash AS "evidenceManifestHash",
        trigger_intent_key AS "triggerIntentKey",
        processor_execution_key AS "processorExecutionKey",
        processor_key_version AS "processorKeyVersion", max_attempts AS "maxAttempts",
        status, result_readiness AS "resultReadiness", eligible_at AS "eligibleAt",
        attempt_count AS "attemptCount", lease_token AS "leaseToken",
        lease_owner_ref AS "leaseOwnerRef", lease_expires_at AS "leaseExpiresAt",
        last_heartbeat_at AS "lastHeartbeatAt",
        last_error_category AS "lastErrorCategory", last_error_code AS "lastErrorCode",
        created_at AS "createdAt", started_at AS "startedAt",
        completed_at AS "completedAt", updated_at AS "updatedAt"
      FROM intelligence_processor_executions
      WHERE processor_execution_id=${id}
    `);
    return rows[0] ?? null;
  }

  async readAttemptRaw(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<IntelligenceProcessorAttempt> {
    const row = await this.readAttemptRawOrNull(tx, id);
    if (!row) this.leaseLost();
    return row;
  }

  private async readAttemptRawOrNull(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<IntelligenceProcessorAttempt | null> {
    const rows = await tx.$queryRaw<IntelligenceProcessorAttempt[]>(Prisma.sql`
      SELECT attempt_id AS id, processor_execution_id AS "processorExecutionId",
        brand_id AS "brandId", owner_scope_id AS "ownerScopeId",
        attempt_number AS "attemptNumber", worker_identity_ref AS "workerIdentityRef",
        lease_token AS "leaseToken", lease_acquired_at AS "leaseAcquiredAt",
        lease_expires_at AS "leaseExpiresAt", last_heartbeat_at AS "lastHeartbeatAt",
        started_at AS "startedAt", completed_at AS "completedAt", status,
        prompt_build_ref AS "promptBuildRef", runtime_telemetry_summary AS "runtimeTelemetry",
        error_category AS "errorCategory", error_code AS "errorCode"
      FROM intelligence_processor_attempts WHERE attempt_id=${id}
    `);
    return rows[0] ?? null;
  }

  private assertLeaseDuration(leaseDurationMs: number): void {
    if (!Number.isFinite(leaseDurationMs) || leaseDurationMs <= 0) {
      throw new IntelligenceExecutionError(
        "INVALID_EXECUTION_STATE",
        "Lease duration must be positive",
      );
    }
  }

  private leaseLost(): never {
    throw new IntelligenceExecutionError(
      "LEASE_LOST",
      "Worker no longer owns a live matching lease",
    );
  }
}
