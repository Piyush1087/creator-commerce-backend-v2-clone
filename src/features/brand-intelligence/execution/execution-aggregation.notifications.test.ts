import {
  IntelligenceExecutionAggregateResult,
  IntelligenceExecutionStatus,
  IntelligenceProcessorExecutionStatus,
  IntelligenceReadiness,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ExecutionAggregationService } from "./execution-aggregation.service";

function harness(
  children: Array<{
    status: IntelligenceProcessorExecutionStatus;
    resultReadiness: IntelligenceReadiness | null;
  }>,
) {
  let parent = {
    status: IntelligenceExecutionStatus.RUNNING,
    aggregateResult: null as IntelligenceExecutionAggregateResult | null,
    brandId: "brand-1",
  };
  const notifications = {
    enqueueWithinTransaction: vi.fn().mockResolvedValue({ job_id: "job" }),
  };
  const tx = {
    intelligenceExecution: {
      findUniqueOrThrow: vi
        .fn()
        .mockImplementation(() => Promise.resolve(parent)),
      update: vi.fn().mockImplementation(({ data }) => {
        parent = { ...parent, ...data };
        return Promise.resolve(parent);
      }),
    },
    intelligenceProcessorExecution: {
      findMany: vi.fn().mockResolvedValue(children),
    },
  };
  return {
    service: new ExecutionAggregationService(notifications as never),
    notifications,
    tx,
    getParent: () => parent,
  };
}

describe("P2B aggregate intelligence notifications", () => {
  it.each([
    [
      IntelligenceReadiness.READY,
      IntelligenceExecutionAggregateResult.SUCCEEDED,
    ],
    [
      IntelligenceReadiness.PARTIAL,
      IntelligenceExecutionAggregateResult.SUCCEEDED,
    ],
  ])(
    "emits completed for a fully usable terminal aggregate",
    async (readiness, aggregate) => {
      const h = harness([
        {
          status: IntelligenceProcessorExecutionStatus.COMPLETED,
          resultReadiness: readiness,
        },
      ]);
      await h.service.refreshInTransaction(
        h.tx as never,
        "execution-1",
        new Date(),
      );
      expect(h.getParent()).toMatchObject({
        status: IntelligenceExecutionStatus.COMPLETED,
        aggregateResult: aggregate,
      });
      expect(h.notifications.enqueueWithinTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: "intelligence.execution_completed",
        }),
      );
    },
  );

  it("emits completed for PARTIAL and only once on repeated refresh", async () => {
    const h = harness([
      {
        status: IntelligenceProcessorExecutionStatus.COMPLETED,
        resultReadiness: IntelligenceReadiness.READY,
      },
      {
        status: IntelligenceProcessorExecutionStatus.FAILED_TERMINAL,
        resultReadiness: null,
      },
    ]);
    await h.service.refreshInTransaction(
      h.tx as never,
      "execution-1",
      new Date(),
    );
    await h.service.refreshInTransaction(
      h.tx as never,
      "execution-1",
      new Date(),
    );
    expect(h.getParent().aggregateResult).toBe(
      IntelligenceExecutionAggregateResult.PARTIAL,
    );
    expect(h.notifications.enqueueWithinTransaction).toHaveBeenCalledTimes(1);
  });

  it("emits failed only for aggregate FAILED", async () => {
    const h = harness([
      {
        status: IntelligenceProcessorExecutionStatus.FAILED_TERMINAL,
        resultReadiness: null,
      },
    ]);
    await h.service.refreshInTransaction(
      h.tx as never,
      "execution-1",
      new Date(),
    );
    expect(h.notifications.enqueueWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "intelligence.execution_failed" }),
    );
  });

  it("does not emit for NO_RESULT, CANCELLED, or intermediate work", async () => {
    const noResult = harness([
      {
        status: IntelligenceProcessorExecutionStatus.COMPLETED,
        resultReadiness: IntelligenceReadiness.NOT_READY,
      },
    ]);
    await noResult.service.refreshInTransaction(
      noResult.tx as never,
      "no-result",
      new Date(),
    );
    expect(
      noResult.notifications.enqueueWithinTransaction,
    ).not.toHaveBeenCalled();
    const cancelled = harness([
      {
        status: IntelligenceProcessorExecutionStatus.CANCELLED,
        resultReadiness: null,
      },
    ]);
    await cancelled.service.refreshInTransaction(
      cancelled.tx as never,
      "cancelled",
      new Date(),
    );
    expect(
      cancelled.notifications.enqueueWithinTransaction,
    ).not.toHaveBeenCalled();
    const running = harness([
      {
        status: IntelligenceProcessorExecutionStatus.RUNNING,
        resultReadiness: null,
      },
    ]);
    await running.service.refreshInTransaction(
      running.tx as never,
      "running",
      new Date(),
    );
    expect(
      running.notifications.enqueueWithinTransaction,
    ).not.toHaveBeenCalled();
  });
});
