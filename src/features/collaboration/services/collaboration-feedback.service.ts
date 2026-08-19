import { Injectable } from "@nestjs/common";
import {
  CollaborationActorClass,
  CollaborationFeedbackAuthorRole,
  CollaborationFeedbackVisibility,
  CollaborationLifecycle,
  Prisma,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { commandConflict } from "../errors/collaboration-command.error";
import {
  revealFeedbackSchema,
  submitCollaborationFeedbackSchema,
} from "../schemas/collaboration-feedback-command.schema";
import {
  appendCommandEvent,
  assertExpectedVersion,
  parseCommand,
  replayOrThrow,
  requestFingerprint,
} from "../utils/collaboration-command-support";
import {
  COLLABORATION_THREAD_INCLUDE,
  CollaborationAccessService,
} from "./collaboration-access.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";

type FeedbackRow = Prisma.CollaborationGetPayload<{
  include: typeof COLLABORATION_THREAD_INCLUDE;
}>;

@Injectable()
export class CollaborationFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CollaborationAccessService,
    private readonly realtime: CollaborationRealtimeService,
  ) {}

  async submit(user: AuthUser, collaborationId: string, raw: unknown) {
    const input = parseCommand(submitCollaborationFeedbackSchema, {
      ...(raw as object),
      collaborationId,
    });
    await this.access.assertThreadForUser(user, collaborationId);
    const authorRole = this.authorRole(user);
    const actorClass =
      authorRole === CollaborationFeedbackAuthorRole.BRAND
        ? CollaborationActorClass.BRAND
        : CollaborationActorClass.CREATOR;
    const fingerprint = requestFingerprint(input);
    const result = await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          "COLLABORATION_FEEDBACK_SUBMITTED",
          fingerprint,
        )
      )
        return { replayed: true };

      await this.lockCollaboration(tx, collaborationId);
      const row = await this.load(tx, collaborationId);
      this.assertEligible(row);
      const own = row.feedback.find((item) => item.authorRole === authorRole);
      if (own)
        commandConflict(
          "INVALID_STATE",
          "Feedback was already submitted by this role",
          row.aggregateVersion,
        );
      this.assertSubmissionVersion(row, input.expectedAggregateVersion);
      const now = new Date();
      const window = row.feedbackWindow!;
      if (
        window.visibility === CollaborationFeedbackVisibility.REVEALED ||
        now.getTime() >= window.closesAt.getTime()
      )
        commandConflict(
          "INVALID_STATE",
          "Feedback submission window is closed",
          row.aggregateVersion,
        );

      const reveal = row.feedback.length === 1;
      await tx.collaborationFeedback.create({
        data: {
          collaborationId,
          authorRole,
          authorUserId: user.id,
          rating: input.rating,
          reviewText: input.reviewText,
          submittedAt: now,
        },
      });
      if (reveal) {
        await tx.collaborationFeedbackWindow.updateMany({
          where: {
            id: window.id,
            visibility: CollaborationFeedbackVisibility.HIDDEN,
          },
          data: {
            visibility: CollaborationFeedbackVisibility.REVEALED,
            revealedAt: now,
          },
        });
      }
      const increment = reveal ? 2 : 1;
      await this.bump(tx, row, increment);
      await appendCommandEvent(tx, {
        collaborationId,
        eventType: "COLLABORATION_FEEDBACK_SUBMITTED",
        actorClass,
        actorUserId: user.id,
        commandId: input.commandId,
        aggregateVersion: row.aggregateVersion + 1,
        requestFingerprint: fingerprint,
        payload: { authorRole, revealed: reveal },
      });
      if (reveal)
        await appendCommandEvent(tx, {
          collaborationId,
          eventType: "COLLABORATION_FEEDBACK_REVEALED",
          actorClass: CollaborationActorClass.SYSTEM,
          commandId: `${input.commandId}:reveal`,
          aggregateVersion: row.aggregateVersion + 2,
          requestFingerprint: fingerprint,
          payload: { reason: "BOTH_SUBMITTED" },
        });
      return { replayed: false, revealed: reveal };
    });
    if (!result.replayed)
      void this.realtime.broadcast(collaborationId, "thread.updated");
    return result;
  }

  async reveal(raw: unknown) {
    const input = parseCommand(revealFeedbackSchema, raw);
    const fingerprint = requestFingerprint(input);
    const result = await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          input.collaborationId,
          input.commandId,
          "COLLABORATION_FEEDBACK_REVEALED",
          fingerprint,
        )
      )
        return { replayed: true, revealed: true };
      await this.lockCollaboration(tx, input.collaborationId);
      const row = await this.load(tx, input.collaborationId);
      this.assertEligible(row);
      if (
        row.feedbackWindow!.visibility ===
        CollaborationFeedbackVisibility.REVEALED
      )
        return { replayed: true, revealed: true };
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      const now = new Date();
      if (
        row.feedback.length < 2 &&
        now.getTime() < row.feedbackWindow!.closesAt.getTime()
      )
        commandConflict(
          "FEEDBACK_REVEAL_DEADLINE_NOT_REACHED",
          "Feedback reveal deadline has not been reached",
          row.aggregateVersion,
        );
      const changed = await tx.collaborationFeedbackWindow.updateMany({
        where: {
          id: row.feedbackWindow!.id,
          visibility: CollaborationFeedbackVisibility.HIDDEN,
        },
        data: {
          visibility: CollaborationFeedbackVisibility.REVEALED,
          revealedAt: now,
        },
      });
      if (changed.count === 0) return { replayed: true, revealed: true };
      await this.bump(tx, row, 1);
      await appendCommandEvent(tx, {
        collaborationId: row.id,
        eventType: "COLLABORATION_FEEDBACK_REVEALED",
        actorClass: CollaborationActorClass.SYSTEM,
        commandId: input.commandId,
        aggregateVersion: row.aggregateVersion + 1,
        requestFingerprint: fingerprint,
        payload: {
          reason: "WINDOW_EXPIRED",
          submissionCount: row.feedback.length,
        },
      });
      return { replayed: false, revealed: true };
    });
    if (!result.replayed)
      void this.realtime.broadcast(input.collaborationId, "thread.updated");
    return result;
  }

  private authorRole(user: AuthUser): CollaborationFeedbackAuthorRole {
    if (user.role === UserRole.BRAND)
      return CollaborationFeedbackAuthorRole.BRAND;
    if (user.role === UserRole.CREATOR)
      return CollaborationFeedbackAuthorRole.CREATOR;
    commandConflict("UNAUTHORIZED_ACTOR", "Feedback requires Brand or Creator");
  }

  private assertEligible(row: FeedbackRow) {
    if (!row.sourceApplicationId)
      commandConflict(
        "INVALID_STATE",
        "Canonical Application-origin Collaboration required",
        row.aggregateVersion,
      );
    if (
      row.lifecycle !== CollaborationLifecycle.COMPLETED ||
      !row.completedAt ||
      !row.feedbackWindow
    )
      commandConflict(
        "INVALID_STATE",
        "Feedback is available only after completed Collaboration",
        row.aggregateVersion,
      );
  }

  private assertSubmissionVersion(row: FeedbackRow, expected: number) {
    if (row.aggregateVersion === expected) return;
    const counterpartOnlyConcurrency =
      row.aggregateVersion === expected + 1 && row.feedback.length === 1;
    if (!counterpartOnlyConcurrency)
      assertExpectedVersion(row.aggregateVersion, expected);
  }

  private async load(tx: Prisma.TransactionClient, collaborationId: string) {
    return tx.collaboration.findUniqueOrThrow({
      where: { id: collaborationId },
      include: COLLABORATION_THREAD_INCLUDE,
    });
  }

  private async lockCollaboration(
    tx: Prisma.TransactionClient,
    collaborationId: string,
  ) {
    await tx.$queryRaw`
      SELECT "id"
      FROM "collaborations"
      WHERE "id" = ${collaborationId}
      FOR UPDATE
    `;
  }

  private async bump(
    tx: Prisma.TransactionClient,
    row: FeedbackRow,
    increment: number,
  ) {
    const changed = await tx.collaboration.updateMany({
      where: { id: row.id, aggregateVersion: row.aggregateVersion },
      data: { aggregateVersion: { increment } },
    });
    if (changed.count !== 1)
      commandConflict(
        "STALE_AGGREGATE_VERSION",
        "Collaboration changed during Feedback command",
        row.aggregateVersion,
      );
  }
}
