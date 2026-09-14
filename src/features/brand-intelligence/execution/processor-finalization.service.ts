import { Injectable } from "@nestjs/common";
import {
  IntelligenceProcessorAttemptStatus,
  IntelligenceProcessorExecutionStatus,
  Prisma,
  type IntelligenceProcessorExecution,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { executionErrorBoundary } from "./domain/execution-error-boundary";
import { IntelligenceExecutionError } from "./domain/intelligence-execution.error";
import type {
  ClaimedProcessorWork,
  LeaseIdentity,
  ProcessorExecutionResult,
  ProcessorFailure,
} from "./domain/intelligence-execution.types";
import { ExecutionAggregationService } from "./execution-aggregation.service";
import type { ProcessorSuccessPersistenceHook } from "./processor-persistence.hook";
import { ProcessorExecutionRepository } from "./processor-execution.repository";
import { RetryBackoffPolicy } from "./policy/retry-backoff.policy";
import { ProcessorExecutorFailure } from "./executor/processor-executor";

@Injectable()
export class ProcessorFinalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: ProcessorExecutionRepository,
    private readonly aggregation: ExecutionAggregationService,
    private readonly retryBackoff: RetryBackoffPolicy,
  ) {}

  async complete(
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
    persistenceHook: ProcessorSuccessPersistenceHook,
  ): Promise<IntelligenceProcessorExecution> {
    if ((claim.processorExecution.brandId as string | null) === null) {
      return this.completeOwnerScoped(claim, result, persistenceHook);
    }
    const lease = this.leaseIdentity(claim);
    return executionErrorBoundary(
      () =>
        this.prisma.$transaction(async (tx) => {
          const locked = await this.repository.lockLiveLease(tx, lease);
          await persistenceHook.persistBeforeCompletion(tx, claim, result);
          await tx.intelligenceProcessorAttempt.update({
            where: { id: locked.attempt.id },
            data: {
              status: IntelligenceProcessorAttemptStatus.SUCCEEDED,
              completedAt: locked.now,
              runtimeTelemetry: result.telemetry
                ? (result.telemetry as Prisma.InputJsonValue)
                : undefined,
            },
          });
          const completed = await tx.intelligenceProcessorExecution.update({
            where: { id: locked.processorExecution.id },
            data: {
              status: IntelligenceProcessorExecutionStatus.COMPLETED,
              resultReadiness: result.readiness,
              eligibleAt: null,
              leaseToken: null,
              leaseOwnerRef: null,
              leaseExpiresAt: null,
              lastHeartbeatAt: null,
              lastErrorCategory: null,
              lastErrorCode: null,
              completedAt: locked.now,
            },
          });
          await this.aggregation.refreshInTransaction(
            tx,
            locked.processorExecution.executionId,
            locked.now,
          );
          return completed;
        }),
      "Processor completion failed a persistence invariant",
      (error) => error instanceof ProcessorExecutorFailure,
    );
  }

  async fail(
    claim: ClaimedProcessorWork,
    failure: ProcessorFailure,
  ): Promise<IntelligenceProcessorExecution> {
    if (failure.category === "LEASE_LOST") {
      throw new IntelligenceExecutionError(
        "LEASE_LOST",
        "Lease-loss disposition is owned by the reclaimer",
      );
    }
    if ((claim.processorExecution.brandId as string | null) === null) {
      return this.failOwnerScoped(claim, failure);
    }
    const lease = this.leaseIdentity(claim);
    return executionErrorBoundary(
      () =>
        this.prisma.$transaction(async (tx) => {
          const locked = await this.repository.lockLiveLease(tx, lease);
          const attemptsRemain =
            locked.processorExecution.attemptCount <
            locked.processorExecution.maxAttempts;
          const retryable = failure.category === "RETRYABLE_TECHNICAL";
          const waiting = failure.category === "DEPENDENCY_UNAVAILABLE";
          const cancelled = failure.category === "CANCELLED";
          const processorStatus = waiting
            ? IntelligenceProcessorExecutionStatus.WAITING_FOR_DEPENDENCY
            : retryable && attemptsRemain
              ? IntelligenceProcessorExecutionStatus.QUEUED
              : cancelled
                ? IntelligenceProcessorExecutionStatus.CANCELLED
                : IntelligenceProcessorExecutionStatus.FAILED_TERMINAL;
          const attemptStatus = waiting
            ? IntelligenceProcessorAttemptStatus.WAITING_DEPENDENCY
            : retryable
              ? IntelligenceProcessorAttemptStatus.FAILED_RETRYABLE
              : cancelled
                ? IntelligenceProcessorAttemptStatus.CANCELLED
                : IntelligenceProcessorAttemptStatus.FAILED_TERMINAL;
          await tx.intelligenceProcessorAttempt.update({
            where: { id: locked.attempt.id },
            data: {
              status: attemptStatus,
              completedAt: locked.now,
              errorCategory: failure.category,
              errorCode: failure.code,
              runtimeTelemetry: failure.telemetry
                ? (failure.telemetry as Prisma.InputJsonValue)
                : undefined,
            },
          });
          const terminal =
            processorStatus ===
              IntelligenceProcessorExecutionStatus.FAILED_TERMINAL ||
            processorStatus === IntelligenceProcessorExecutionStatus.CANCELLED;
          const updated = await tx.intelligenceProcessorExecution.update({
            where: { id: locked.processorExecution.id },
            data: {
              status: processorStatus,
              resultReadiness: null,
              eligibleAt:
                processorStatus === IntelligenceProcessorExecutionStatus.QUEUED
                  ? this.retryBackoff.eligibilityAfter(
                      locked.processorExecution.attemptCount,
                      locked.now,
                    )
                  : null,
              leaseToken: null,
              leaseOwnerRef: null,
              leaseExpiresAt: null,
              lastHeartbeatAt: null,
              lastErrorCategory: failure.category,
              lastErrorCode:
                retryable && !attemptsRemain
                  ? "ATTEMPT_EXHAUSTED"
                  : failure.code,
              completedAt: terminal ? locked.now : null,
            },
          });
          await this.aggregation.refreshInTransaction(
            tx,
            locked.processorExecution.executionId,
            locked.now,
          );
          return updated;
        }),
      "Processor failure disposition failed a persistence invariant",
    );
  }

  private leaseIdentity(claim: ClaimedProcessorWork): LeaseIdentity {
    return {
      processorExecutionId: claim.processorExecution.id,
      attemptId: claim.attempt.id,
      workerIdentity: claim.attempt.workerIdentityRef,
      leaseToken: claim.attempt.leaseToken,
    };
  }

  private async completeOwnerScoped(
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
    persistenceHook: ProcessorSuccessPersistenceHook,
  ): Promise<IntelligenceProcessorExecution> {
    const lease = this.leaseIdentity(claim);
    return executionErrorBoundary(
      () =>
        this.prisma.$transaction(async (tx) => {
          const locked = await this.repository.lockLiveLease(tx, lease);
          await persistenceHook.persistBeforeCompletion(tx, claim, result);
          await tx.$executeRaw(Prisma.sql`
            UPDATE intelligence_processor_attempts
            SET status='SUCCEEDED'::"IntelligenceProcessorAttemptStatus",
              completed_at=${locked.now},
              runtime_telemetry_summary=${result.telemetry ? JSON.stringify(result.telemetry) : null}::jsonb
            WHERE attempt_id=${locked.attempt.id}
          `);
          await tx.$executeRaw(Prisma.sql`
            UPDATE intelligence_processor_executions
            SET status='COMPLETED'::"IntelligenceProcessorExecutionStatus",
              result_readiness=${result.readiness}::"IntelligenceReadiness",
              eligible_at=NULL, lease_token=NULL, lease_owner_ref=NULL,
              lease_expires_at=NULL, last_heartbeat_at=NULL,
              last_error_category=NULL, last_error_code=NULL,
              completed_at=${locked.now}, updated_at=${locked.now}
            WHERE processor_execution_id=${locked.processorExecution.id}
          `);
          await tx.$executeRaw(Prisma.sql`
            UPDATE intelligence_executions
            SET status='COMPLETED'::"IntelligenceExecutionStatus",
              aggregate_result='SUCCEEDED'::"IntelligenceExecutionAggregateResult",
              completed_at=${locked.now}
            WHERE execution_id=${locked.processorExecution.executionId}
          `);
          return this.repository.readProcessorRaw(
            tx,
            locked.processorExecution.id,
          );
        }),
      "Owner-scoped Processor completion failed a persistence invariant",
      (error) => error instanceof ProcessorExecutorFailure,
    );
  }

  private async failOwnerScoped(
    claim: ClaimedProcessorWork,
    failure: ProcessorFailure,
  ): Promise<IntelligenceProcessorExecution> {
    const lease = this.leaseIdentity(claim);
    return executionErrorBoundary(
      () =>
        this.prisma.$transaction(async (tx) => {
          const locked = await this.repository.lockLiveLease(tx, lease);
          await tx.$executeRaw(Prisma.sql`
            UPDATE intelligence_processor_attempts
            SET status='FAILED_TERMINAL'::"IntelligenceProcessorAttemptStatus",
              completed_at=${locked.now}, error_category=${failure.category},
              error_code=${failure.code},
              runtime_telemetry_summary=${failure.telemetry ? JSON.stringify(failure.telemetry) : null}::jsonb
            WHERE attempt_id=${locked.attempt.id}
          `);
          await tx.$executeRaw(Prisma.sql`
            UPDATE intelligence_processor_executions
            SET status='FAILED_TERMINAL'::"IntelligenceProcessorExecutionStatus",
              result_readiness=NULL, eligible_at=NULL, lease_token=NULL,
              lease_owner_ref=NULL, lease_expires_at=NULL,
              last_heartbeat_at=NULL, last_error_category=${failure.category},
              last_error_code=${failure.code}, completed_at=${locked.now},
              updated_at=${locked.now}
            WHERE processor_execution_id=${locked.processorExecution.id}
          `);
          await tx.$executeRaw(Prisma.sql`
            UPDATE intelligence_executions
            SET status='FAILED'::"IntelligenceExecutionStatus",
              aggregate_result='FAILED'::"IntelligenceExecutionAggregateResult",
              completed_at=${locked.now}
            WHERE execution_id=${locked.processorExecution.executionId}
          `);
          return this.repository.readProcessorRaw(
            tx,
            locked.processorExecution.id,
          );
        }),
      "Owner-scoped Processor failure disposition failed a persistence invariant",
    );
  }
}
