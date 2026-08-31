import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { NotificationEmailDeliveryStatus, Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { getEventDefinition } from "../config/notification-event-registry";
import type { NotificationDispatchInput } from "../types/notifications.types";
import { NotificationRecipientPolicyService } from "./notification-recipient-policy.service";

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipientPolicies: NotificationRecipientPolicyService,
  ) {}

  dispatch(input: NotificationDispatchInput): Promise<{ job_id: string }> {
    return this.prisma.$transaction((tx) =>
      this.enqueueWithinTransaction(tx, input),
    );
  }

  async enqueueWithinTransaction(
    tx: Prisma.TransactionClient,
    input: NotificationDispatchInput,
  ): Promise<{ job_id: string }> {
    const definition = getEventDefinition(input.eventType);
    if (!definition)
      throw new BadRequestException(
        `Unknown notification event: ${input.eventType}`,
      );
    const brand = await tx.brandProfile.findUnique({
      where: { id: input.workspaceId },
      select: { id: true },
    });
    if (!brand) throw new NotFoundException("Brand workspace not found");
    const sourceParts = [
      input.source.sourceType,
      input.source.sourceId,
      input.source.transitionId,
    ];
    if (sourceParts.some((part) => !part.trim()))
      throw new BadRequestException(
        "Notification source identity is incomplete",
      );
    if (
      definition.recipientPolicy === "AFFECTED_USER_EMAIL_ONLY" &&
      !input.affectedUserId
    ) {
      throw new BadRequestException(
        "Affected user identity is required for this event",
      );
    }
    const semanticEventKey = createHash("sha256")
      .update(JSON.stringify(sourceParts))
      .digest("hex");
    const payload = {
      ...input.payload,
      ...(input.affectedUserId
        ? { _affected_user_id: input.affectedUserId }
        : {}),
    };
    const jobKey = {
      workspaceId: input.workspaceId,
      eventType: input.eventType,
      semanticEventKey,
    };
    await tx.notificationJob.createMany({
      data: [
        {
          id: randomUUID(),
          ...jobKey,
          urgencyLevel: definition.urgencyLevel,
          triggerUserId: input.triggerUserId ?? null,
          payload: payload as Prisma.InputJsonValue,
          actorName: input.actorName ?? null,
        },
      ],
      skipDuplicates: true,
    });
    const job = await tx.notificationJob.findUniqueOrThrow({
      where: {
        workspaceId_eventType_semanticEventKey: jobKey,
      },
      select: { id: true },
    });

    await tx.$queryRaw`SELECT id FROM notification_jobs WHERE id = ${job.id} FOR UPDATE`;
    const lockedJob = await tx.notificationJob.findUniqueOrThrow({
      where: { id: job.id },
      select: { snapshotFinalizedAt: true },
    });
    if (!lockedJob.snapshotFinalizedAt) {
      const recipients = await this.recipientPolicies.resolve(
        {
          workspaceId: input.workspaceId,
          policy: definition.recipientPolicy,
          triggerUserId: input.triggerUserId ?? null,
          affectedUserId: input.affectedUserId ?? null,
        },
        tx,
      );
      const preferences = await tx.userBrandNotificationPreference.findMany({
        where: {
          brandProfileId: input.workspaceId,
          userId: { in: recipients.map((recipient) => recipient.userId) },
          category: definition.category,
        },
      });
      const preferenceByUser = new Map(
        preferences.map((row) => [row.userId, row.optionalEmailEnabled]),
      );
      await tx.notificationJobRecipient.createMany({
        data: recipients.map((recipient) => {
          const emailDue =
            definition.emailPolicy === "MANDATORY" ||
            (definition.emailPolicy === "OPTIONAL" &&
              (preferenceByUser.get(recipient.userId) ?? true));
          return {
            jobId: job.id,
            userId: recipient.userId,
            targetEmail: recipient.email,
            recipientName: recipient.name,
            inboxObligation:
              recipient.inbox && definition.inAppPolicy !== "NONE",
            emailStatus: emailDue
              ? NotificationEmailDeliveryStatus.PENDING
              : NotificationEmailDeliveryStatus.NOT_REQUIRED,
          };
        }),
      });
      await tx.notificationJob.update({
        where: { id: job.id },
        data: { snapshotFinalizedAt: new Date() },
      });
    }
    this.logger.debug(
      `notification.job.enqueued jobId=${job.id} event=${input.eventType} workspace=${input.workspaceId}`,
    );
    return { job_id: job.id };
  }
}
