import assert from "node:assert/strict";
import test from "node:test";

import {
  CollaborationActorClass,
  CollaborationFinancialOutcome,
  CollaborationLifecycle,
  CollaborationPublishingState,
  CollaborationResolutionStatus,
  CollaborationSettlementLegState,
  CollaborationSettlementState,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
} from "@prisma/client";

import {
  confirmRefundExecutionSchema,
  confirmSettlementExecutionSchema,
  requestSettlementExecutionSchema,
} from "../schemas/collaboration-settlement-command.schema";
import { resolveFinancialOutcome } from "../utils/collaboration-financial-resolution.policy";
import {
  deriveActionRequiredBy,
  projectCanonicalCollaborationDetail,
} from "../utils/collaboration-thread.mapper";
import { CollaborationSettlementService } from "./collaboration-settlement.service";

const d = (value: number) => new Prisma.Decimal(value);
const command = {
  collaborationId: "10000000-0000-4000-8000-000000000001",
  commandId: "20000000-0000-4000-8000-000000000001",
  expectedAggregateVersion: 8,
};

test("normal success uses the Phase 3.1 calculator with full Creator entitlement", () => {
  const resolution = resolveFinancialOutcome(
    {
      agreedCreatorFee: d(100000),
      platformCommissionRateSnapshot: d(7),
      platformCommissionAmount: d(7000),
      platformCommissionGstRateSnapshot: d(18),
      platformCommissionGstAmount: d(1260),
      currency: "INR",
    },
    d(100000),
    CollaborationFinancialOutcome.NORMAL_SUCCESS,
    "NORMAL_SUCCESS",
  );
  assert.equal(resolution.creatorGrossEntitlementAmount.toString(), "100000");
  assert.equal(resolution.creatorCommercialRefundAmount.toString(), "0");
  assert.equal(resolution.platformCommissionRetainedAmount.toString(), "7000");
  assert.equal(resolution.platformCommissionRefundAmount.toString(), "0");
  assert.equal(
    resolution.platformCommissionGstRetainedAmount.toString(),
    "1260",
  );
  assert.equal(resolution.platformCommissionGstRefundAmount.toString(), "0");
  assert.equal(
    resolution.brandCommercialRefundEntitlementAmount.toString(),
    "0",
  );
});

test("confirmation contracts require exact provider-neutral correlation and money", () => {
  assert.equal(
    requestSettlementExecutionSchema.parse(command).expectedAggregateVersion,
    8,
  );
  assert.equal(
    confirmSettlementExecutionSchema.parse({
      ...command,
      amount: "40000.00",
      currency: "inr",
      payoutInstructionRef: "instruction:payout",
      payoutExecutionRef: "execution:payout",
      authoritativeConfirmationRef: "confirmation:payout",
    }).currency,
    "INR",
  );
  assert.equal(
    confirmRefundExecutionSchema.parse({
      ...command,
      amount: "64956.00",
      currency: "INR",
      refundInstructionRef: "instruction:refund",
      refundExecutionRef: "execution:refund",
      authoritativeConfirmationRef: "confirmation:refund",
    }).amount,
    "64956.00",
  );
  assert.throws(() =>
    confirmSettlementExecutionSchema.parse({
      ...command,
      amount: "1.001",
      currency: "INR",
      payoutInstructionRef: "i",
      payoutExecutionRef: "e",
      authoritativeConfirmationRef: "c",
    }),
  );
});

test("Settlement projection separates entitlement execution and exposes SYSTEM ownership", () => {
  const row: any = {
    sourceApplicationId: "application-1",
    lifecycle: CollaborationLifecycle.TERMINATED,
    settlement: {
      state: CollaborationSettlementState.PROCESSING,
      creatorPayoutState: CollaborationSettlementLegState.CONFIRMED,
      brandRefundState: CollaborationSettlementLegState.PROCESSING,
    },
  };
  assert.equal(deriveActionRequiredBy(row), CollaborationActorClass.SYSTEM);
});

test("settled terminal Collaboration retains terminal lifecycle ownership", () => {
  const row: any = {
    sourceApplicationId: "application-1",
    lifecycle: CollaborationLifecycle.CANCELLED,
    settlement: {
      state: CollaborationSettlementState.SETTLED,
      creatorPayoutState: CollaborationSettlementLegState.NOT_REQUIRED,
      brandRefundState: CollaborationSettlementLegState.CONFIRMED,
    },
  };
  assert.equal(deriveActionRequiredBy(row), "NONE");
  assert.equal(row.lifecycle, CollaborationLifecycle.CANCELLED);
});

test("canonical Settlement implementation does not use legacy tranche or TDS inputs", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(__dirname + "/collaboration-settlement.service.ts", "utf8"),
  );
  assert.ok(!source.includes("ADVANCE_30"));
  assert.ok(!source.includes("FINAL_70"));
  assert.ok(!source.includes("calculatedTdsDeduction"));
  assert.ok(!source.includes("gatewayProcessing"));
  assert.ok(!source.includes("projectCanonicalCollaborationDetail"));
});

test("ordinary read actions never expose trusted Settlement commands", () => {
  const trusted = [
    "RequestSettlementExecution",
    "ConfirmSettlementExecution",
    "ConfirmRefundExecution",
  ];
  const mapperSource = projectCanonicalCollaborationDetail.toString();
  for (const action of trusted) assert.ok(!mapperSource.includes(action));
});

function clone<T>(value: T): T {
  if (value instanceof Date) return new Date(value) as T;
  if (Prisma.Decimal.isDecimal(value))
    return new Prisma.Decimal(value.toString()) as T;
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)]),
    ) as T;
  return value;
}

function harness(
  options: {
    terminal?: boolean;
    gatewayStatus?: "ACCEPTED" | "RETRYABLE_FAILURE";
  } = {},
) {
  const events: any[] = [];
  const requests: any[] = [];
  const normalResolution = resolveFinancialOutcome(
    {
      agreedCreatorFee: d(100000),
      platformCommissionRateSnapshot: d(7),
      platformCommissionAmount: d(7000),
      platformCommissionGstRateSnapshot: d(18),
      platformCommissionGstAmount: d(1260),
      currency: "INR",
    },
    options.terminal ? d(40000) : d(100000),
    options.terminal
      ? CollaborationFinancialOutcome.PRODUCTION_HARD_STOP
      : CollaborationFinancialOutcome.NORMAL_SUCCESS,
    options.terminal ? "PRODUCTION_HARD_STOP" : "NORMAL_SUCCESS",
  );
  const row: any = {
    id: command.collaborationId,
    sourceApplicationId: "application-1",
    creatorUserId: "creator-1",
    brandProfileId: "brand-1",
    lifecycle: options.terminal
      ? CollaborationLifecycle.TERMINATED
      : CollaborationLifecycle.ACTIVE,
    canonicalStage: CollaborationStage.PUBLISHING_SETTLEMENT,
    currentStageStatus: options.terminal
      ? CollaborationStageStatus.BLOCKED
      : CollaborationStageStatus.IN_PROGRESS,
    aggregateVersion: 8,
    commercialAgreement: {
      agreedCreatorFee: d(100000),
      currency: "INR",
      platformCommissionRateSnapshot: d(7),
      platformCommissionAmount: d(7000),
      platformCommissionGstRateSnapshot: d(18),
      platformCommissionGstAmount: d(1260),
      escrowLockRef: "escrow-lock-1",
    },
    deliverables: [
      {
        state: "APPROVED",
        publishingRequired: true,
        publishing: { state: CollaborationPublishingState.COMPLIANCE_VERIFIED },
      },
    ],
    financialResolution: options.terminal
      ? {
          id: "resolution-1",
          collaborationId: command.collaborationId,
          ...normalResolution,
        }
      : null,
    settlement: null,
  };
  const tx: any = {
    collaboration: {
      findUniqueOrThrow: async () => row,
      updateMany: async ({ where, data }: any) => {
        if (where.aggregateVersion !== row.aggregateVersion)
          return { count: 0 };
        const { aggregateVersion: _increment, ...rest } = data;
        Object.assign(row, rest);
        row.aggregateVersion += 1;
        return { count: 1 };
      },
    },
    collaborationEvent: {
      findFirst: async ({ where }: any) =>
        events.find((event) => event.commandId === where.commandId) ?? null,
      create: async ({ data }: any) => void events.push(data),
      createMany: async ({ data }: any) => void events.push(...data),
    },
    collaborationFinancialResolution: {
      upsert: async ({ create }: any) => {
        row.financialResolution = { id: "resolution-1", ...create };
        return row.financialResolution;
      },
    },
    collaborationSettlement: {
      upsert: async ({ create, update }: any) => {
        row.settlement = row.settlement
          ? Object.assign(row.settlement, update)
          : { id: "settlement-1", ...create };
        return row.settlement;
      },
      create: async ({ data }: any) => {
        row.settlement = { id: "settlement-1", ...data };
        return row.settlement;
      },
      update: async ({ data }: any) => Object.assign(row.settlement, data),
    },
  };
  const prisma: any = {
    $transaction: async (fn: any) => {
      const before = clone(row);
      const eventCount = events.length;
      try {
        return await fn(tx);
      } catch (error) {
        for (const key of Object.keys(row)) delete row[key];
        Object.assign(row, before);
        events.splice(eventCount);
        throw error;
      }
    },
  };
  const gateway: any = {
    requestExecution: async (instruction: any) => {
      requests.push(instruction);
      return { status: options.gatewayStatus ?? "ACCEPTED" };
    },
  };
  const service = new CollaborationSettlementService(prisma, gateway, {
    broadcast: async () => undefined,
  } as any);
  return { service, row, events, requests };
}

test("normal eligibility, request acceptance and confirmation remain distinct", async () => {
  const h = harness();
  await h.service.establishNormalEligibility(command);
  assert.equal(h.row.settlement.state, CollaborationSettlementState.ELIGIBLE);
  assert.equal(
    h.row.financialResolution.outcome,
    CollaborationFinancialOutcome.NORMAL_SUCCESS,
  );
  assert.equal(
    h.row.financialResolution.creatorGrossEntitlementAmount.toString(),
    "100000",
  );
  assert.equal(
    h.row.financialResolution.brandCommercialRefundEntitlementAmount.toString(),
    "0",
  );
  await h.service.requestExecution({
    ...command,
    commandId: "request",
    expectedAggregateVersion: 9,
  });
  assert.equal(h.row.settlement.state, CollaborationSettlementState.PROCESSING);
  assert.equal(h.row.lifecycle, CollaborationLifecycle.ACTIVE);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].creatorPayoutAmount, "100000.00");
  assert.equal(h.requests[0].brandRefundAmount, "0.00");
  await h.service.confirmCreatorSettlement({
    ...command,
    commandId: "confirm",
    expectedAggregateVersion: 10,
    amount: "100000.00",
    currency: "INR",
    payoutInstructionRef: h.row.settlement.payoutInstructionRef,
    payoutExecutionRef: "payout:executed",
    authoritativeConfirmationRef: "payout:confirmed",
  });
  assert.equal(h.row.settlement.state, CollaborationSettlementState.SETTLED);
  assert.equal(h.row.lifecycle, CollaborationLifecycle.COMPLETED);
  assert.ok(h.row.completedAt instanceof Date);
});

test("terminal entitlement is reused and partial confirmation cannot complete", async () => {
  const h = harness({ terminal: true });
  await h.service.requestExecution(command);
  assert.equal(h.requests[0].creatorPayoutAmount, "40000.00");
  assert.equal(h.requests[0].brandRefundAmount, "64956.00");
  await h.service.confirmCreatorSettlement({
    ...command,
    commandId: "creator-confirm",
    expectedAggregateVersion: 9,
    amount: "40000.00",
    currency: "INR",
    payoutInstructionRef: h.row.settlement.payoutInstructionRef,
    payoutExecutionRef: "payout:execution",
    authoritativeConfirmationRef: "payout:confirmation",
  });
  assert.equal(h.row.settlement.state, CollaborationSettlementState.PROCESSING);
  assert.equal(h.row.lifecycle, CollaborationLifecycle.TERMINATED);
  await assert.rejects(() =>
    h.service.confirmBrandRefund({
      ...command,
      commandId: "bad-refund",
      expectedAggregateVersion: 10,
      amount: "60000.00",
      currency: "INR",
      refundInstructionRef: h.row.settlement.refundInstructionRef,
      refundExecutionRef: "refund:execution",
      authoritativeConfirmationRef: "refund:confirmation",
    }),
  );
  assert.equal(
    h.row.settlement.brandRefundState,
    CollaborationSettlementLegState.PROCESSING,
  );
  await h.service.confirmBrandRefund({
    ...command,
    commandId: "refund-confirm",
    expectedAggregateVersion: 10,
    amount: "64956.00",
    currency: "INR",
    refundInstructionRef: h.row.settlement.refundInstructionRef,
    refundExecutionRef: "refund:execution",
    authoritativeConfirmationRef: "refund:confirmation",
  });
  assert.equal(h.row.settlement.state, CollaborationSettlementState.SETTLED);
  assert.equal(h.row.lifecycle, CollaborationLifecycle.TERMINATED);
});

test("retryable request failure changes neither entitlement nor lifecycle", async () => {
  const h = harness({ terminal: true, gatewayStatus: "RETRYABLE_FAILURE" });
  const result = await h.service.requestExecution(command);
  assert.equal(result.accepted, false);
  assert.equal(h.row.settlement.state, CollaborationSettlementState.ELIGIBLE);
  assert.equal(
    h.row.financialResolution.creatorGrossEntitlementAmount.toString(),
    "40000",
  );
  assert.equal(h.row.lifecycle, CollaborationLifecycle.TERMINATED);
  assert.equal(h.events.length, 0);
});
