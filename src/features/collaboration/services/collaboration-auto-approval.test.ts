import assert from "node:assert/strict";
import test from "node:test";

import {
  CollaborationDeliverableState,
  CollaborationLifecycle,
  CollaborationPublicationAuthorizationState,
  CollaborationStage,
  CollaborationSubmissionReviewState,
} from "@prisma/client";

import { autoApproveDeliverableSchema } from "../schemas/collaboration-production-command.schema";
import {
  deriveActionRequiredBy,
  deriveAvailableActions,
} from "../utils/collaboration-thread.mapper";
import { CollaborationProductionService } from "./collaboration-production.service";

const collaborationId = "10000000-0000-4000-8000-000000000001";
const deliverableAId = "20000000-0000-4000-8000-000000000001";
const deliverableBId = "20000000-0000-4000-8000-000000000002";
const submissionAId = "30000000-0000-4000-8000-000000000001";
const submissionBId = "30000000-0000-4000-8000-000000000002";
const deadline = new Date("2026-08-13T09:00:00.000Z");

function acceptedDeliverable(
  id: string,
  state: CollaborationDeliverableState,
  publishingRequired = false,
) {
  return {
    id,
    collaborationId,
    state,
    revisionRequestCount: 0,
    publishingRequired,
    approvedAt:
      state === CollaborationDeliverableState.APPROVED
        ? new Date("2026-08-12T09:00:00.000Z")
        : null,
    autoApprovedAt: null,
    submissions: [] as any[],
    publishing: {
      state: publishingRequired
        ? "AWAITING_PUBLISHING"
        : "PUBLISHING_NOT_REQUIRED",
      authorizationState: publishingRequired ? "AUTHORIZED" : "NOT_REQUIRED",
      authorizedAt: publishingRequired
        ? new Date("2026-08-12T09:00:00.000Z")
        : null,
      authorizedByUserId: publishingRequired ? "brand-1" : null,
    },
  };
}

function reviewDeliverable(
  id = deliverableAId,
  submissionId = submissionAId,
  publishingRequired = true,
) {
  return {
    ...acceptedDeliverable(
      id,
      CollaborationDeliverableState.UNDER_REVIEW,
      publishingRequired,
    ),
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
    submissions: [
      {
        id: submissionId,
        deliverableExecutionId: id,
        versionNumber: 1,
        reviewDeadlineAt: deadline,
        reviewState: CollaborationSubmissionReviewState.UNDER_REVIEW,
        reviewedByUserId: null,
        reviewedAt: null,
        autoApprovedAt: null,
      },
    ],
  };
}

function harness(
  options: {
    secondState?: CollaborationDeliverableState;
    publishingRequired?: boolean;
    failEvent?: boolean;
  } = {},
) {
  const row: any = {
    id: collaborationId,
    sourceApplicationId: "application-1",
    lifecycle: CollaborationLifecycle.ACTIVE,
    canonicalStage: CollaborationStage.PRODUCTION,
    currentStageStatus: "IN_PROGRESS",
    currentStage: "STAGE_4_CONTENT_REVIEW",
    aggregateVersion: 4,
    deliverables: [
      reviewDeliverable(
        deliverableAId,
        submissionAId,
        options.publishingRequired ?? true,
      ),
      acceptedDeliverable(
        deliverableBId,
        options.secondState ??
          CollaborationDeliverableState.AWAITING_SUBMISSION,
      ),
    ],
  };
  const events: any[] = [];
  const tx: any = {
    collaboration: {
      findUniqueOrThrow: async () => row,
      updateMany: async ({ where, data }: any) => {
        if (row.aggregateVersion !== where.aggregateVersion)
          return { count: 0 };
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
  };
  const prisma: any = {
    $transaction: async (callback: any) => {
      const snapshot = structuredClone(row);
      const eventSnapshot = structuredClone(events);
      try {
        return await callback(tx);
      } catch (error) {
        for (const key of Object.keys(row)) delete row[key];
        Object.assign(row, snapshot);
        events.splice(0, events.length, ...eventSnapshot);
        throw error;
      }
    },
  };
  const broadcasts: string[] = [];
  const service = new CollaborationProductionService(
    prisma,
    {} as any,
    { broadcast: async () => broadcasts.push("thread.updated") } as any,
  );
  return { service, row, events, broadcasts };
}

const command = (overrides: Record<string, unknown> = {}) => ({
  commandId: "auto-a-v1",
  collaborationId,
  expectedAggregateVersion: 4,
  deliverableExecutionId: deliverableAId,
  submissionVersionId: submissionAId,
  ...overrides,
});

test("SYSTEM command schema requires exact execution identities and rejects owned state", () => {
  assert.equal(autoApproveDeliverableSchema.safeParse(command()).success, true);
  const { collaborationId: _ignored, ...invalid } = command();
  assert.equal(autoApproveDeliverableSchema.safeParse(invalid).success, false);
  assert.equal(
    autoApproveDeliverableSchema.safeParse({
      ...command(),
      reviewState: "AUTO_APPROVED",
    }).success,
    false,
  );
});

test("deadline is inclusive: before rejects without mutation, at and after succeed", async () => {
  const before = harness();
  await assert.rejects(
    () =>
      before.service.autoApprove(
        collaborationId,
        command(),
        new Date(deadline.getTime() - 1),
      ),
    (error: any) => error.response?.code === "REVIEW_DEADLINE_NOT_REACHED",
  );
  assert.equal(before.row.aggregateVersion, 4);
  assert.equal(before.events.length, 0);
  assert.equal(before.row.deliverables[0].state, "UNDER_REVIEW");

  for (const now of [deadline, new Date(deadline.getTime() + 1)]) {
    const h = harness();
    await h.service.autoApprove(collaborationId, command(), now);
    assert.equal(h.row.deliverables[0].state, "AUTO_APPROVED");
    assert.equal(
      h.row.deliverables[0].submissions[0].reviewState,
      "AUTO_APPROVED",
    );
  }
});

test("transition records SYSTEM auto-approval without fabricating Brand approval or authorization", async () => {
  const h = harness();
  const now = new Date(deadline.getTime() + 1);
  await h.service.autoApprove(collaborationId, command(), now);
  const item = h.row.deliverables[0];
  const submission = item.submissions[0];
  assert.equal(submission.reviewedByUserId, null);
  assert.equal(submission.reviewedAt.toISOString(), now.toISOString());
  assert.equal(submission.autoApprovedAt.toISOString(), now.toISOString());
  assert.equal(item.approvedAt, null);
  assert.equal(item.autoApprovedAt.toISOString(), now.toISOString());
  assert.equal(item.publishing.authorizationState, "NOT_AUTHORIZED");
  assert.equal(item.publishing.authorizedAt, null);
  assert.equal(item.publishing.authorizedByUserId, null);
  assert.equal(h.events[0].actorClass, "SYSTEM");
  assert.equal(h.events[0].actorUserId, undefined);
  assert.equal(h.events[0].eventType, "DELIVERABLE_AUTO_APPROVED");
  assert.equal(h.events[0].payload.versionNumber, 1);
  assert.equal(h.events[0].payload.productionComplete, false);

  const notRequired = harness({ publishingRequired: false });
  await notRequired.service.autoApprove(collaborationId, command(), now);
  assert.equal(
    notRequired.row.deliverables[0].publishing.authorizationState,
    CollaborationPublicationAuthorizationState.NOT_REQUIRED,
  );
});

test("Production aggregation accepts manual plus auto and all-auto combinations", async () => {
  const mixed = harness({
    secondState: CollaborationDeliverableState.APPROVED,
  });
  await mixed.service.autoApprove(collaborationId, command(), deadline);
  assert.equal(mixed.row.canonicalStage, "PUBLISHING_SETTLEMENT");
  assert.equal(mixed.events[0].payload.productionComplete, true);

  const allAuto = harness({
    secondState: CollaborationDeliverableState.AUTO_APPROVED,
  });
  await allAuto.service.autoApprove(collaborationId, command(), deadline);
  assert.equal(allAuto.row.canonicalStage, "PUBLISHING_SETTLEMENT");

  const incomplete = harness();
  await incomplete.service.autoApprove(collaborationId, command(), deadline);
  assert.equal(incomplete.row.canonicalStage, "PRODUCTION");
});

test("stale state, version, ownership and lifecycle outcomes never mutate", async () => {
  const cases: Array<(row: any) => void> = [
    (row) => {
      row.deliverables[0].state = CollaborationDeliverableState.APPROVED;
      row.deliverables[0].submissions[0].reviewState =
        CollaborationSubmissionReviewState.APPROVED;
    },
    (row) => {
      row.deliverables[0].state =
        CollaborationDeliverableState.REVISION_REQUESTED;
      row.deliverables[0].submissions[0].reviewState =
        CollaborationSubmissionReviewState.REVISION_REQUESTED;
    },
    (row) => {
      row.deliverables[0].submissions.push({
        ...row.deliverables[0].submissions[0],
        id: "30000000-0000-4000-8000-000000000099",
        versionNumber: 2,
      });
    },
    (row) => {
      row.lifecycle = CollaborationLifecycle.TERMINATED;
    },
    (row) => {
      row.deliverables[0].submissions[0].deliverableExecutionId =
        deliverableBId;
    },
  ];
  for (const arrange of cases) {
    const h = harness();
    arrange(h.row);
    const snapshot = structuredClone(h.row);
    await assert.rejects(() =>
      h.service.autoApprove(collaborationId, command(), deadline),
    );
    assert.deepEqual(h.row, snapshot);
    assert.equal(h.events.length, 0);
  }

  const staleAggregate = harness();
  await assert.rejects(
    () =>
      staleAggregate.service.autoApprove(
        collaborationId,
        command({ expectedAggregateVersion: 3 }),
        deadline,
      ),
    (error: any) => error.response?.code === "STALE_AGGREGATE_VERSION",
  );
  assert.equal(staleAggregate.row.deliverables[0].state, "UNDER_REVIEW");
});

test("same command replay is idempotent and preserves timestamps/version/event", async () => {
  const h = harness({ secondState: CollaborationDeliverableState.APPROVED });
  const first = await h.service.autoApprove(
    collaborationId,
    command(),
    deadline,
  );
  const timestamp = h.row.deliverables[0].autoApprovedAt;
  const second = await h.service.autoApprove(
    collaborationId,
    command(),
    deadline,
  );
  assert.deepEqual(first, { replayed: false, productionComplete: true });
  assert.deepEqual(second, { replayed: true });
  assert.equal(h.row.aggregateVersion, 5);
  assert.equal(h.events.length, 1);
  assert.equal(h.row.deliverables[0].autoApprovedAt, timestamp);
  assert.equal(h.broadcasts.length, 1);
});

test("event failure rolls back submission, Deliverable, stage, version and event", async () => {
  const h = harness({
    secondState: CollaborationDeliverableState.APPROVED,
    failEvent: true,
  });
  await assert.rejects(
    () => h.service.autoApprove(collaborationId, command(), deadline),
    /forced event failure/,
  );
  assert.equal(h.row.deliverables[0].state, "UNDER_REVIEW");
  assert.equal(
    h.row.deliverables[0].submissions[0].reviewState,
    "UNDER_REVIEW",
  );
  assert.equal(h.row.canonicalStage, "PRODUCTION");
  assert.equal(h.row.aggregateVersion, 4);
  assert.equal(h.events.length, 0);
});

test("read ownership becomes Brand after unresolved auto-approval and no client sees SYSTEM action", () => {
  const h = harness({ secondState: CollaborationDeliverableState.APPROVED });
  h.row.canonicalStage = CollaborationStage.PUBLISHING_SETTLEMENT;
  h.row.deliverables[0].state = CollaborationDeliverableState.AUTO_APPROVED;
  assert.equal(deriveActionRequiredBy(h.row), "BRAND");
  assert.ok(
    !deriveAvailableActions(h.row, "BRAND").includes(
      "AutoApproveDeliverable" as any,
    ),
  );
  assert.ok(
    !deriveAvailableActions(h.row, "CREATOR").includes(
      "AutoApproveDeliverable" as any,
    ),
  );
});
