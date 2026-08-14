import assert from "node:assert/strict";
import test from "node:test";

import {
  CollaborationFeedbackAuthorRole,
  CollaborationFeedbackVisibility,
  CollaborationLifecycle,
  UserRole,
} from "@prisma/client";

import {
  revealFeedbackSchema,
  submitCollaborationFeedbackSchema,
} from "../schemas/collaboration-feedback-command.schema";
import { CollaborationFeedbackService } from "./collaboration-feedback.service";

const collaborationId = "10000000-0000-4000-8000-000000000001";
const command = {
  collaborationId,
  commandId: "feedback-command",
  expectedAggregateVersion: 8,
  rating: 5,
  reviewText: "Excellent collaboration",
};
const brand: any = { id: "brand-user", role: UserRole.BRAND };
const creator: any = { id: "creator-user", role: UserRole.CREATOR };

function clone<T>(value: T): T {
  if (value instanceof Date) return new Date(value) as T;
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)]),
    ) as T;
  return value;
}

function harness(
  lifecycle: CollaborationLifecycle = CollaborationLifecycle.COMPLETED,
) {
  const events: any[] = [];
  const row: any = {
    id: collaborationId,
    sourceApplicationId: "application-1",
    lifecycle,
    completedAt:
      lifecycle === CollaborationLifecycle.COMPLETED ? new Date() : null,
    aggregateVersion: 8,
    feedbackWindow:
      lifecycle === CollaborationLifecycle.COMPLETED
        ? {
            id: "window-1",
            visibility: CollaborationFeedbackVisibility.HIDDEN,
            openedAt: new Date(),
            closesAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            revealedAt: null,
          }
        : null,
    feedback: [],
  };
  const tx: any = {
    $queryRaw: async () => [{ id: collaborationId }],
    collaboration: {
      findUniqueOrThrow: async () => row,
      updateMany: async ({ where, data }: any) => {
        if (where.aggregateVersion !== row.aggregateVersion)
          return { count: 0 };
        row.aggregateVersion += data.aggregateVersion.increment;
        return { count: 1 };
      },
    },
    collaborationEvent: {
      findFirst: async ({ where }: any) =>
        events.find((event) => event.commandId === where.commandId) ?? null,
      create: async ({ data }: any) => void events.push(data),
    },
    collaborationFeedback: {
      create: async ({ data }: any) => {
        if (
          row.feedback.some((item: any) => item.authorRole === data.authorRole)
        )
          throw new Error("unique feedback role");
        const item = { id: `feedback-${row.feedback.length + 1}`, ...data };
        row.feedback.push(item);
        return item;
      },
    },
    collaborationFeedbackWindow: {
      updateMany: async ({ where, data }: any) => {
        if (row.feedbackWindow.visibility !== where.visibility)
          return { count: 0 };
        Object.assign(row.feedbackWindow, data);
        return { count: 1 };
      },
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
  const service = new CollaborationFeedbackService(
    prisma,
    { assertThreadForUser: async () => row } as any,
    { broadcast: async () => undefined } as any,
  );
  return { service, row, events };
}

test("Feedback validation requires integer rating 1..5 and bounded optional text", () => {
  assert.equal(submitCollaborationFeedbackSchema.parse(command).rating, 5);
  for (const rating of [0, 6, 1.5])
    assert.throws(() =>
      submitCollaborationFeedbackSchema.parse({ ...command, rating }),
    );
  assert.equal(
    revealFeedbackSchema.parse({
      collaborationId,
      commandId: command.commandId,
      expectedAggregateVersion: 8,
    }).expectedAggregateVersion,
    8,
  );
  assert.throws(() =>
    submitCollaborationFeedbackSchema.parse({
      ...command,
      authorRole: "BRAND",
    }),
  );
});

test("Brand and Creator submit once; second submission reveals atomically", async () => {
  const h = harness();
  await h.service.submit(brand, collaborationId, command);
  assert.equal(h.row.feedback.length, 1);
  assert.equal(
    h.row.feedback[0].authorRole,
    CollaborationFeedbackAuthorRole.BRAND,
  );
  assert.equal(
    h.row.feedbackWindow.visibility,
    CollaborationFeedbackVisibility.HIDDEN,
  );
  await h.service.submit(creator, collaborationId, {
    ...command,
    commandId: "creator-command",
    expectedAggregateVersion: 9,
    rating: 4,
  });
  assert.equal(h.row.feedback.length, 2);
  assert.equal(
    h.row.feedbackWindow.visibility,
    CollaborationFeedbackVisibility.REVEALED,
  );
  assert.ok(h.row.feedbackWindow.revealedAt instanceof Date);
  assert.equal(h.row.lifecycle, CollaborationLifecycle.COMPLETED);
  assert.deepEqual(
    h.events.map((event) => event.eventType),
    [
      "COLLABORATION_FEEDBACK_SUBMITTED",
      "COLLABORATION_FEEDBACK_SUBMITTED",
      "COLLABORATION_FEEDBACK_REVEALED",
    ],
  );
});

test("same command replays and distinct same-role submission is rejected", async () => {
  const h = harness();
  await h.service.submit(brand, collaborationId, command);
  assert.equal(
    (await h.service.submit(brand, collaborationId, command)).replayed,
    true,
  );
  await assert.rejects(() =>
    h.service.submit(brand, collaborationId, {
      ...command,
      commandId: "different-command",
      expectedAggregateVersion: 9,
    }),
  );
  assert.equal(h.row.feedback.length, 1);
});

test("ACTIVE, CANCELLED and TERMINATED Collaborations reject ordinary Feedback", async () => {
  for (const lifecycle of [
    CollaborationLifecycle.ACTIVE,
    CollaborationLifecycle.CANCELLED,
    CollaborationLifecycle.TERMINATED,
  ]) {
    const h = harness(lifecycle);
    await assert.rejects(() =>
      h.service.submit(creator, collaborationId, command),
    );
    assert.equal(h.row.feedback.length, 0);
  }
});

test("SYSTEM reveal is non-mutating before deadline and succeeds at expiry", async () => {
  const h = harness();
  await h.service.submit(brand, collaborationId, command);
  await assert.rejects(
    () =>
      h.service.reveal({
        collaborationId,
        commandId: "reveal-early",
        expectedAggregateVersion: 9,
      }),
    (error: any) =>
      error.response?.code === "FEEDBACK_REVEAL_DEADLINE_NOT_REACHED",
  );
  assert.equal(h.row.aggregateVersion, 9);
  h.row.feedbackWindow.closesAt = new Date();
  await h.service.reveal({
    collaborationId,
    commandId: "reveal-expired",
    expectedAggregateVersion: 9,
  });
  assert.equal(
    h.row.feedbackWindow.visibility,
    CollaborationFeedbackVisibility.REVEALED,
  );
  assert.equal(h.row.feedback.length, 1);
  assert.equal(h.row.lifecycle, CollaborationLifecycle.COMPLETED);
});

test("zero-feedback expiry reveals without fabricating a missing record", async () => {
  const h = harness();
  h.row.feedbackWindow.closesAt = new Date(Date.now() - 1);
  await h.service.reveal({
    collaborationId,
    commandId: "empty-reveal",
    expectedAggregateVersion: 8,
  });
  assert.equal(h.row.feedback.length, 0);
  assert.equal(h.events.length, 1);
});

test("already-revealed SYSTEM retry is idempotent and stale version rejects", async () => {
  const h = harness();
  h.row.feedbackWindow.closesAt = new Date(Date.now() - 1);
  await assert.rejects(() =>
    h.service.reveal({
      collaborationId,
      commandId: "stale-reveal",
      expectedAggregateVersion: 7,
    }),
  );
  assert.equal(h.events.length, 0);
  await h.service.reveal({
    collaborationId,
    commandId: "valid-reveal",
    expectedAggregateVersion: 8,
  });
  const revealedAt = h.row.feedbackWindow.revealedAt;
  const result = await h.service.reveal({
    collaborationId,
    commandId: "redundant-worker",
    expectedAggregateVersion: 8,
  });
  assert.equal(result.replayed, true);
  assert.equal(h.row.feedbackWindow.revealedAt, revealedAt);
  assert.equal(h.events.length, 1);
});

test("concurrent opposite-role submissions converge to two rows and one reveal", async () => {
  const h = harness();
  await h.service.submit(brand, collaborationId, command);
  await h.service.submit(creator, collaborationId, {
    ...command,
    commandId: "creator-concurrent",
    expectedAggregateVersion: 8,
  });
  assert.equal(h.row.feedback.length, 2);
  assert.equal(
    h.events.filter(
      (event) => event.eventType === "COLLABORATION_FEEDBACK_REVEALED",
    ).length,
    1,
  );
});
