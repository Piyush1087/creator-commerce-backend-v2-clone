import { Injectable } from "@nestjs/common";
import {
  IntelligenceExecutionAggregateResult,
  IntelligenceExecutionStatus,
  IntelligenceProcessorExecutionStatus,
  IntelligenceReadiness,
  type Prisma,
} from "@prisma/client";
import { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";

const TERMINAL = new Set<IntelligenceProcessorExecutionStatus>([
  IntelligenceProcessorExecutionStatus.COMPLETED,
  IntelligenceProcessorExecutionStatus.FAILED_TERMINAL,
  IntelligenceProcessorExecutionStatus.CANCELLED,
]);

@Injectable()
export class ExecutionAggregationService {
  constructor(private readonly notifications?: NotificationDispatchService) {}

  async refreshInTransaction(
    tx: Prisma.TransactionClient,
    executionId: string,
    now: Date,
  ): Promise<void> {
    const parent = await tx.intelligenceExecution.findUniqueOrThrow({
      where: { id: executionId },
      select: { status: true, aggregateResult: true, brandId: true },
    });
    if (parent.status === IntelligenceExecutionStatus.CANCELLED) return;
    const children = await tx.intelligenceProcessorExecution.findMany({
      where: { executionId },
      select: { status: true, resultReadiness: true },
    });
    if (children.length === 0) return;
    if (children.some((child) => !TERMINAL.has(child.status))) {
      if (
        children.some(
          (child) =>
            child.status === IntelligenceProcessorExecutionStatus.RUNNING,
        )
      ) {
        await tx.intelligenceExecution.update({
          where: { id: executionId },
          data: { status: IntelligenceExecutionStatus.RUNNING },
        });
      }
      return;
    }

    const cancelled = children.filter(
      (child) =>
        child.status === IntelligenceProcessorExecutionStatus.CANCELLED,
    ).length;
    if (cancelled === children.length) {
      await tx.intelligenceExecution.update({
        where: { id: executionId },
        data: {
          status: IntelligenceExecutionStatus.CANCELLED,
          aggregateResult: null,
          completedAt: now,
        },
      });
      return;
    }

    const usable = children.filter(
      (child) =>
        child.status === IntelligenceProcessorExecutionStatus.COMPLETED &&
        (child.resultReadiness === IntelligenceReadiness.READY ||
          child.resultReadiness === IntelligenceReadiness.PARTIAL),
    ).length;
    const failures = children.filter(
      (child) =>
        child.status === IntelligenceProcessorExecutionStatus.FAILED_TERMINAL ||
        child.status === IntelligenceProcessorExecutionStatus.CANCELLED,
    ).length;

    let aggregate: IntelligenceExecutionAggregateResult;
    let status: IntelligenceExecutionStatus;
    if (usable === children.length) {
      aggregate = IntelligenceExecutionAggregateResult.SUCCEEDED;
      status = IntelligenceExecutionStatus.COMPLETED;
    } else if (usable > 0) {
      aggregate = IntelligenceExecutionAggregateResult.PARTIAL;
      status = IntelligenceExecutionStatus.COMPLETED;
    } else if (failures === children.length) {
      aggregate = IntelligenceExecutionAggregateResult.FAILED;
      status = IntelligenceExecutionStatus.FAILED;
    } else {
      aggregate = IntelligenceExecutionAggregateResult.NO_RESULT;
      status = IntelligenceExecutionStatus.COMPLETED;
    }
    await tx.intelligenceExecution.update({
      where: { id: executionId },
      data: { status, aggregateResult: aggregate, completedAt: now },
    });
    const wasTerminal =
      parent.status === IntelligenceExecutionStatus.COMPLETED ||
      parent.status === IntelligenceExecutionStatus.FAILED;
    if (wasTerminal) return;
    if (
      status === IntelligenceExecutionStatus.COMPLETED &&
      (aggregate === IntelligenceExecutionAggregateResult.SUCCEEDED ||
        aggregate === IntelligenceExecutionAggregateResult.PARTIAL)
    ) {
      await this.notifications?.enqueueWithinTransaction(tx, {
        workspaceId: parent.brandId,
        eventType: "intelligence.execution_completed",
        source: {
          sourceType: "intelligence_execution",
          sourceId: executionId,
          transitionId: `terminal:COMPLETED:${aggregate}`,
        },
        payload: { execution_id: executionId, aggregate_result: aggregate },
        triggerUserId: null,
      });
    } else if (
      status === IntelligenceExecutionStatus.FAILED &&
      aggregate === IntelligenceExecutionAggregateResult.FAILED
    ) {
      await this.notifications?.enqueueWithinTransaction(tx, {
        workspaceId: parent.brandId,
        eventType: "intelligence.execution_failed",
        source: {
          sourceType: "intelligence_execution",
          sourceId: executionId,
          transitionId: "terminal:FAILED:FAILED",
        },
        payload: { execution_id: executionId, aggregate_result: aggregate },
        triggerUserId: null,
      });
    }
  }
}
