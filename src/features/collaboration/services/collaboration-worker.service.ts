import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  CollaborationMessageKind,
  CollaborationOutboxState,
  CollaborationSubmissionReviewState,
  NotificationEmailPolicy,
  NotificationInAppPolicy,
  NotificationUrgencyLevel,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { CollaborationFeedbackService } from "./collaboration-feedback.service";
import { CollaborationProductionService } from "./collaboration-production.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";

@Injectable()
export class CollaborationWorkerService {
  private readonly logger = new Logger(CollaborationWorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly production: CollaborationProductionService,
    private readonly feedback: CollaborationFeedbackService,
    private readonly realtime: CollaborationRealtimeService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    await this.runTimers();
    for (let index = 0; index < 50; index += 1) {
      if (!(await this.processOneOutbox())) break;
    }
  }

  async runTimers(now = new Date()) {
    const submissions =
      await this.prisma.collaborationSubmissionVersion.findMany({
        where: {
          reviewState: CollaborationSubmissionReviewState.UNDER_REVIEW,
          reviewDeadlineAt: { lte: now },
          supersededAt: null,
        },
        include: {
          deliverableExecution: {
            include: { collaboration: { select: { aggregateVersion: true } } },
          },
        },
        take: 50,
      });
    for (const submission of submissions) {
      const collaborationId = submission.deliverableExecution.collaborationId;
      try {
        await this.production.autoApprove(
          collaborationId,
          {
            collaborationId,
            deliverableExecutionId: submission.deliverableExecutionId,
            submissionVersionId: submission.id,
            expectedAggregateVersion:
              submission.deliverableExecution.collaboration.aggregateVersion,
            commandId: `timer:auto-approve:${submission.id}`,
          },
          now,
        );
      } catch (error) {
        this.logger.warn(
          `collaboration-auto-approval deferred: ${this.code(error)}`,
        );
      }
    }

    const windows = await this.prisma.collaborationFeedbackWindow.findMany({
      where: { visibility: "HIDDEN", closesAt: { lte: now } },
      include: { collaboration: { select: { aggregateVersion: true } } },
      take: 50,
    });
    for (const window of windows) {
      try {
        await this.feedback.reveal({
          collaborationId: window.collaborationId,
          expectedAggregateVersion: window.collaboration.aggregateVersion,
          commandId: `timer:feedback-reveal:${window.id}`,
        });
      } catch (error) {
        this.logger.warn(
          `collaboration-feedback-reveal deferred: ${this.code(error)}`,
        );
      }
    }
  }

  async processOneOutbox(): Promise<boolean> {
    const job = await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.collaborationProjectionOutbox.findFirst({
        where: {
          state: {
            in: [
              CollaborationOutboxState.PENDING,
              CollaborationOutboxState.FAILED,
            ],
          },
          availableAt: { lte: new Date() },
        },
        orderBy: { createdAt: "asc" },
      });
      if (!candidate) return null;
      const claimed = await tx.collaborationProjectionOutbox.updateMany({
        where: { id: candidate.id, state: candidate.state },
        data: {
          state: CollaborationOutboxState.PROCESSING,
          attempts: { increment: 1 },
          claimedAt: new Date(),
        },
      });
      return claimed.count === 1 ? candidate : null;
    });
    if (!job) return false;
    try {
      await this.project(
        job.id,
        job.eventId,
        job.collaborationId,
        job.projectionType,
      );
      await this.prisma.collaborationProjectionOutbox.update({
        where: { id: job.id },
        data: {
          state: CollaborationOutboxState.COMPLETED,
          completedAt: new Date(),
          lastErrorCode: null,
        },
      });
    } catch (error) {
      await this.prisma.collaborationProjectionOutbox.update({
        where: { id: job.id },
        data: {
          state: CollaborationOutboxState.FAILED,
          availableAt: new Date(Date.now() + 60_000),
          lastErrorCode: this.code(error).slice(0, 100),
        },
      });
    }
    return true;
  }

  private async project(
    outboxId: string,
    eventId: string,
    collaborationId: string,
    projectionType: string,
  ) {
    const event = await this.prisma.collaborationEvent.findUniqueOrThrow({
      where: { id: eventId },
      include: {
        collaboration: {
          select: { brandProfileId: true, creatorWorkspaceId: true },
        },
      },
    });
    if (projectionType === "SYSTEM_MESSAGE") {
      await this.prisma.collaborationMessage.upsert({
        where: { sourceEventId: eventId },
        create: {
          collaborationId,
          sourceEventId: eventId,
          kind: CollaborationMessageKind.SYSTEM,
          systemEventTag: event.eventType,
          body: `Collaboration update: ${event.eventType}`,
        },
        update: {},
      });
      return;
    }
    if (projectionType === "SOCKET_INVALIDATION") {
      await this.realtime.broadcast(collaborationId, "thread.updated");
      return;
    }
    if (projectionType !== "NOTIFICATION")
      throw new Error("OUTBOX_PROJECTION_UNKNOWN");
    const scopes: Array<{
      workspaceId: string | null;
      creatorWorkspaceId: string | null;
    }> = [
      {
        workspaceId: event.collaboration.brandProfileId,
        creatorWorkspaceId: null,
      },
    ];
    if (event.collaboration.creatorWorkspaceId) {
      scopes.push({
        workspaceId: null,
        creatorWorkspaceId: event.collaboration.creatorWorkspaceId,
      });
    }
    for (const scope of scopes) {
      await this.prisma.notification.upsert({
        where: scope.creatorWorkspaceId
          ? {
              creatorWorkspaceId_eventType_semanticEventKey: {
                creatorWorkspaceId: scope.creatorWorkspaceId,
                eventType: `COLLABORATION_${event.eventType}`,
                semanticEventKey: outboxId,
              },
            }
          : {
              workspaceId_eventType_semanticEventKey: {
                workspaceId: scope.workspaceId!,
                eventType: `COLLABORATION_${event.eventType}`,
                semanticEventKey: outboxId,
              },
            },
        create: {
          ...scope,
          eventType: `COLLABORATION_${event.eventType}`,
          semanticEventKey: outboxId,
          urgencyLevel: NotificationUrgencyLevel.INFORMATIONAL,
          emailPolicy: NotificationEmailPolicy.NONE,
          inAppPolicy: NotificationInAppPolicy.REQUIRED,
          actionable: true,
          payload: { collaborationId, eventType: event.eventType },
        },
        update: {},
      });
    }
  }

  private code(error: unknown) {
    return error instanceof Error ? error.message : "UNKNOWN";
  }
}
