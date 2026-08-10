import assert from "node:assert/strict";
import test from "node:test";

import {
  CollaborationDeliverableState,
  CollaborationLifecycle,
  CollaborationStage,
  Prisma,
  UserRole,
} from "@prisma/client";

import {
  approveDeliverableSchema,
  submitDeliverableSchema,
} from "../schemas/collaboration-production-command.schema";
import { resolveProductionHardStopFinancialOutcome } from "../utils/collaboration-financial-resolution.policy";
import {
  deriveActionRequiredBy,
  deriveAvailableActions,
} from "../utils/collaboration-thread.mapper";
import { CollaborationProductionService } from "./collaboration-production.service";

const collaborationId = "10000000-0000-4000-8000-000000000001";
const deliverableAId = "20000000-0000-4000-8000-000000000001";
const deliverableBId = "20000000-0000-4000-8000-000000000002";
const creator = { id: "creator-1", role: UserRole.CREATOR } as any;
const brand = { id: "brand-1", role: UserRole.BRAND } as any;
const d = (value: number) => new Prisma.Decimal(value);

function deliverable(id: string, publishingRequired: boolean) {
  return {
    id,
    collaborationId,
    sourceBriefDeliverableId: `source:${id}`,
    displayOrder: id === deliverableAId ? 1 : 2,
    definitionSnapshot: { title: id },
    state: CollaborationDeliverableState.AWAITING_SUBMISSION,
    revisionRequestCount: 0,
    publishingRequired,
    approvedAt: null,
    autoApprovedAt: null,
    hardStoppedAt: null,
    submissions: [] as any[],
    publishing: {
      state: publishingRequired
        ? "AWAITING_PUBLISHING"
        : "PUBLISHING_NOT_REQUIRED",
      authorizationState: publishingRequired
        ? "NOT_AUTHORIZED"
        : "NOT_REQUIRED",
      authorizedAt: null,
      authorizedByUserId: null,
    },
  };
}

function harness(options: { failEvent?: boolean } = {}) {
  const row: any = {
    id: collaborationId,
    sourceApplicationId: "application-1",
    lifecycle: CollaborationLifecycle.ACTIVE,
    canonicalStage: CollaborationStage.PRODUCTION,
    currentStageStatus: "IN_PROGRESS",
    currentStage: "STAGE_4_CONTENT_REVIEW",
    aggregateVersion: 1,
    deliverables: [
      deliverable(deliverableAId, true),
      deliverable(deliverableBId, false),
    ],
    commercialAgreement: {
      agreedCreatorFee: d(10_000),
      advanceAmount: d(2_500),
      currency: "INR",
      platformCommissionRateSnapshot: d(7),
      platformCommissionAmount: d(700),
      platformCommissionGstRateSnapshot: d(18),
      platformCommissionGstAmount: d(126),
    },
  };
  const events: any[] = [];
  let nextSubmission = 1;
  const tx: any = {
    collaboration: {
      findUniqueOrThrow: async () => row,
      updateMany: async ({ where, data }: any) => {
        if (row.aggregateVersion !== where.aggregateVersion)
          return { count: 0 };
        row.aggregateVersion += data.aggregateVersion.increment;
        Object.assign(row, data);
        row.aggregateVersion = where.aggregateVersion + 1;
        return { count: 1 };
      },
    },
    collaborationEvent: {
      findFirst: async ({ where }: any) =>
        events.find((event) => event.commandId === where.commandId) ?? null,
      create: async ({ data }: any) => {
        if (options.failEvent) throw new Error("forced event failure");
        events.push(data);
        return data;
      },
    },
    collaborationSubmissionVersion: {
      create: async ({ data }: any) => {
        const submission = {
          id: `30000000-0000-4000-8000-${String(nextSubmission++).padStart(12, "0")}`,
          ...data,
        };
        row.deliverables
          .find((item: any) => item.id === data.deliverableExecutionId)
          .submissions.push(submission);
        return submission;
      },
      update: async ({ where, data }: any) => {
        const submission = row.deliverables
          .flatMap((item: any) => item.submissions)
          .find((item: any) => item.id === where.id);
        Object.assign(submission, data);
        return submission;
      },
    },
    collaborationDeliverableExecution: {
      update: async ({ where, data }: any) => {
        const item = row.deliverables.find(
          (value: any) => value.id === where.id,
        );
        Object.assign(item, data);
        return item;
      },
    },
    collaborationPublishingExecution: {
      update: async ({ where, data }: any) => {
        const item = row.deliverables.find(
          (value: any) => value.id === where.deliverableExecutionId,
        );
        Object.assign(item.publishing, data);
        return item.publishing;
      },
    },
    collaborationFinancialResolution: {
      upsert: async ({ create }: any) => {
        row.financialResolution = create;
        return create;
      },
    },
  };
  const prisma: any = {
    $transaction: async (callback: any) => {
      const snapshot = {
        aggregateVersion: row.aggregateVersion,
        lifecycle: row.lifecycle,
        canonicalStage: row.canonicalStage,
        currentStageStatus: row.currentStageStatus,
        endedFromStage: row.endedFromStage,
        endedReasonCode: row.endedReasonCode,
        endedByActorClass: row.endedByActorClass,
        endedByUserId: row.endedByUserId,
        financialResolution: row.financialResolution,
        deliverables: row.deliverables.map((item: any) => ({
          ...item,
          publishing: { ...item.publishing },
          submissions: item.submissions.map((submission: any) => ({
            ...submission,
          })),
        })),
        events: [...events],
      };
      try {
        return await callback(tx);
      } catch (error) {
        Object.assign(row, snapshot);
        events.splice(0, events.length, ...snapshot.events);
        throw error;
      }
    },
  };
  const service = new CollaborationProductionService(
    prisma,
    { assertThreadForUser: async () => row } as any,
    { broadcast: async () => undefined } as any,
  );
  (service as any).result = async () => row;
  return { service, row, events };
}

const submit = (commandId: string, version: number, id = deliverableAId) => ({
  commandId,
  expectedAggregateVersion: version,
  deliverableExecutionId: id,
  assetRef: `asset:${commandId}`,
  creatorNote: `note ${commandId}`,
});

test("Production command schemas reject backend-owned state and require exact identities", () => {
  assert.equal(
    submitDeliverableSchema.safeParse(submit("submit", 1)).success,
    true,
  );
  assert.equal(
    submitDeliverableSchema.safeParse({
      ...submit("submit", 1),
      state: "APPROVED",
    }).success,
    false,
  );
  assert.equal(
    approveDeliverableSchema.safeParse({
      commandId: "approve",
      expectedAggregateVersion: 1,
      deliverableExecutionId: deliverableAId,
    }).success,
    false,
  );
});

test("submission/revision versions are append-only, per Deliverable, and receive fresh exact 72h deadlines", async () => {
  const h = harness();
  const before = Date.now();
  assert.throws(() =>
    h.service.submit(brand, collaborationId, submit("wrong", 1)),
  );
  h.row.canonicalStage = CollaborationStage.FULFILLMENT;
  await assert.rejects(() =>
    h.service.submit(creator, collaborationId, submit("stage", 1)),
  );
  h.row.canonicalStage = CollaborationStage.PRODUCTION;

  await assert.rejects(
    () =>
      h.service.submit(creator, collaborationId, submit("stale-version", 99)),
    (error: any) => error.response?.code === "STALE_AGGREGATE_VERSION",
  );
  assert.equal(h.row.deliverables[0].submissions.length, 0);

  await h.service.submit(creator, collaborationId, submit("a-v1", 1));
  await h.service.submit(creator, collaborationId, submit("a-v1", 1));
  const a = h.row.deliverables[0];
  assert.equal(a.state, "UNDER_REVIEW");
  assert.equal(a.submissions[0].versionNumber, 1);
  assert.equal(a.submissions.length, 1);
  assert.equal(
    h.events.filter((event) => event.commandId === "a-v1").length,
    1,
  );
  assert.equal(
    a.submissions[0].reviewDeadlineAt.getTime() -
      a.submissions[0].submittedAt.getTime(),
    72 * 60 * 60 * 1000,
  );
  assert.ok(a.submissions[0].submittedAt.getTime() >= before);

  await h.service.submit(
    creator,
    collaborationId,
    submit("b-v1", 2, deliverableBId),
  );
  assert.equal(h.row.deliverables[1].submissions[0].versionNumber, 1);
  await h.service.requestRevision(brand, collaborationId, {
    commandId: "a-r1",
    expectedAggregateVersion: 3,
    deliverableExecutionId: deliverableAId,
    submissionVersionId: a.submissions[0].id,
    brandFeedback: "Please revise version one",
  });
  await h.service.submit(creator, collaborationId, submit("a-v2", 4));
  assert.equal(a.revisionRequestCount, 1);
  assert.equal(a.submissions[1].versionNumber, 2);
  assert.equal(a.submissions[0].brandFeedback, "Please revise version one");
  await h.service.requestRevision(brand, collaborationId, {
    commandId: "a-r2",
    expectedAggregateVersion: 5,
    deliverableExecutionId: deliverableAId,
    submissionVersionId: a.submissions[1].id,
    brandFeedback: "Please revise version two",
  });
  await h.service.submit(creator, collaborationId, submit("a-v3", 6));
  assert.equal(a.revisionRequestCount, 2);
  assert.deepEqual(
    a.submissions.map((item: any) => item.versionNumber),
    [1, 2, 3],
  );
  await assert.rejects(
    () =>
      h.service.requestRevision(brand, collaborationId, {
        commandId: "a-r3",
        expectedAggregateVersion: 7,
        deliverableExecutionId: deliverableAId,
        submissionVersionId: a.submissions[2].id,
        brandFeedback: "A forbidden third revision",
      }),
    (error: any) => error.response?.code === "INVALID_STATE",
  );
});

test("exact-version review is stale-safe and all approvals alone advance Production", async () => {
  const h = harness();
  await h.service.submit(creator, collaborationId, submit("a-v1", 1));
  await h.service.requestRevision(brand, collaborationId, {
    commandId: "a-r1",
    expectedAggregateVersion: 2,
    deliverableExecutionId: deliverableAId,
    submissionVersionId: "30000000-0000-4000-8000-000000000001",
    brandFeedback: "Revise A",
  });
  await h.service.submit(creator, collaborationId, submit("a-v2", 3));
  await assert.rejects(
    () =>
      h.service.approve(brand, collaborationId, {
        commandId: "stale",
        expectedAggregateVersion: 4,
        deliverableExecutionId: deliverableAId,
        submissionVersionId: "30000000-0000-4000-8000-000000000001",
      }),
    (error: any) => error.response?.code === "STALE_AGGREGATE_VERSION",
  );
  await assert.rejects(() =>
    h.service.approve(brand, collaborationId, {
      commandId: "wrong-deliverable",
      expectedAggregateVersion: 4,
      deliverableExecutionId: deliverableBId,
      submissionVersionId: "30000000-0000-4000-8000-000000000002",
    }),
  );
  await h.service.submit(
    creator,
    collaborationId,
    submit("b-v1", 4, deliverableBId),
  );
  await h.service.approve(brand, collaborationId, {
    commandId: "approve-a",
    expectedAggregateVersion: 5,
    deliverableExecutionId: deliverableAId,
    submissionVersionId: "30000000-0000-4000-8000-000000000002",
  });
  assert.equal(h.row.canonicalStage, CollaborationStage.PRODUCTION);
  assert.equal(
    h.row.deliverables[0].publishing.authorizationState,
    "AUTHORIZED",
  );
  await h.service.approve(brand, collaborationId, {
    commandId: "approve-b",
    expectedAggregateVersion: 6,
    deliverableExecutionId: deliverableBId,
    submissionVersionId: "30000000-0000-4000-8000-000000000003",
  });
  assert.equal(h.row.canonicalStage, CollaborationStage.PUBLISHING_SETTLEMENT);
  assert.equal(
    h.row.deliverables[1].publishing.authorizationState,
    "NOT_REQUIRED",
  );
});

test("final rejection is SYSTEM-attributed, Advance-protected, atomic and idempotent", async () => {
  const early = harness();
  early.row.deliverables[0].state = CollaborationDeliverableState.UNDER_REVIEW;
  early.row.deliverables[0].submissions.push({
    id: "30000000-0000-4000-8000-000000000098",
    deliverableExecutionId: deliverableAId,
    versionNumber: 1,
    reviewState: "UNDER_REVIEW",
  });
  await assert.rejects(
    () =>
      early.service.rejectFinal(brand, collaborationId, {
        commandId: "reject-too-early",
        expectedAggregateVersion: 1,
        deliverableExecutionId: deliverableAId,
        submissionVersionId: "30000000-0000-4000-8000-000000000098",
        brandFeedback: "Cannot reject before revisions are exhausted",
      }),
    (error: any) => error.response?.code === "INVALID_STATE",
  );

  const h = harness();
  const a = h.row.deliverables[0];
  a.state = CollaborationDeliverableState.UNDER_REVIEW;
  a.revisionRequestCount = 2;
  a.submissions.push({
    id: "30000000-0000-4000-8000-000000000099",
    deliverableExecutionId: deliverableAId,
    versionNumber: 3,
    reviewState: "UNDER_REVIEW",
  });
  const command = {
    commandId: "reject-final",
    expectedAggregateVersion: 1,
    deliverableExecutionId: deliverableAId,
    submissionVersionId: "30000000-0000-4000-8000-000000000099",
    brandFeedback: "Final version cannot be approved",
  };
  await h.service.rejectFinal(brand, collaborationId, command);
  assert.equal(a.state, "HARD_STOP");
  assert.equal(h.row.lifecycle, "TERMINATED");
  assert.equal(h.row.endedByActorClass, "SYSTEM");
  assert.equal(h.row.endedByUserId, null);
  assert.notEqual(h.row.lifecycle, "PAUSED");
  assert.equal(h.row.financialResolution.outcome, "PRODUCTION_HARD_STOP");
  assert.equal(h.row.financialResolution.decidedByActorClass, "SYSTEM");
  assert.equal(
    h.row.financialResolution.creatorGrossEntitlementAmount.toNumber(),
    2_500,
  );
  assert.equal(h.events[0].actorClass, "BRAND");
  await h.service.rejectFinal(brand, collaborationId, command);
  assert.equal(h.events.length, 1);

  const rollback = harness({ failEvent: true });
  const target = rollback.row.deliverables[0];
  target.state = CollaborationDeliverableState.UNDER_REVIEW;
  target.revisionRequestCount = 2;
  target.submissions.push({
    id: "30000000-0000-4000-8000-000000000099",
    deliverableExecutionId: deliverableAId,
    versionNumber: 3,
    reviewState: "UNDER_REVIEW",
  });
  await assert.rejects(
    () => rollback.service.rejectFinal(brand, collaborationId, command),
    /forced event failure/,
  );
  assert.equal(rollback.row.lifecycle, "ACTIVE");
  assert.equal(rollback.row.deliverables[0].state, "UNDER_REVIEW");
  assert.equal(rollback.row.financialResolution, undefined);
  assert.equal(rollback.row.aggregateVersion, 1);
});

test("Production financial policy uses configurable locked Advance and excludes gateway/TDS", () => {
  const result = resolveProductionHardStopFinancialOutcome({
    agreedCreatorFee: d(10_000),
    advanceAmount: d(4_000),
    currency: "INR",
    platformCommissionRateSnapshot: d(7),
    platformCommissionAmount: d(700),
    platformCommissionGstRateSnapshot: d(18),
    platformCommissionGstAmount: d(126),
  });
  assert.equal(result.creatorGrossEntitlementAmount.toNumber(), 4_000);
  assert.equal(result.platformCommissionRetainedAmount.toNumber(), 280);
  assert.equal(result.platformCommissionGstRetainedAmount.toNumber(), 50.4);
  assert.equal(
    result.brandCommercialRefundEntitlementAmount.toNumber(),
    6_495.6,
  );
  assert.ok(!("gatewayProcessingCharge" in result));
  assert.ok(!("tds" in result));
});

test("read actions are per Deliverable and mixed aggregate ownership is conservative", () => {
  const h = harness();
  h.row.deliverables[0].state = CollaborationDeliverableState.UNDER_REVIEW;
  h.row.deliverables[0].revisionRequestCount = 2;
  h.row.deliverables[1].state =
    CollaborationDeliverableState.AWAITING_SUBMISSION;
  assert.equal(deriveActionRequiredBy(h.row), "NONE");
  assert.ok(
    deriveAvailableActions(h.row, "BRAND").includes("RejectFinalDeliverable"),
  );
  assert.ok(
    deriveAvailableActions(h.row, "CREATOR").includes("SubmitDeliverable"),
  );
});
