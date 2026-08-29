import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { getEventDefinition } from "../config/notification-event-registry";
import type { NotificationDispatchInput } from "../types/notifications.types";

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async dispatch(
    input: NotificationDispatchInput,
  ): Promise<{ job_id: string }> {
    const definition = getEventDefinition(input.eventType);
    if (!definition) {
      throw new BadRequestException(
        `Unknown notification event: ${input.eventType}`,
      );
    }

    const brandExists = await this.prisma.brandProfile.findUnique({
      where: { id: input.workspaceId },
      select: { id: true },
    });
    if (!brandExists) {
      throw new NotFoundException("Brand workspace not found");
    }

    const sourceParts = [
      input.source.sourceType,
      input.source.sourceId,
      input.source.transitionId,
    ];
    if (sourceParts.some((part) => !part.trim())) {
      throw new BadRequestException(
        "Notification source identity is incomplete",
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
    if (
      definition.recipientPolicy === "AFFECTED_USER_EMAIL_ONLY" &&
      !input.affectedUserId
    ) {
      throw new BadRequestException(
        "Affected user identity is required for this event",
      );
    }

    const job = await this.prisma.notificationJob.upsert({
      where: {
        workspaceId_eventType_semanticEventKey: {
          workspaceId: input.workspaceId,
          eventType: input.eventType,
          semanticEventKey,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        eventType: input.eventType,
        semanticEventKey,
        urgencyLevel: definition.urgencyLevel,
        triggerUserId: input.triggerUserId ?? null,
        payload: payload as Prisma.InputJsonValue,
        actorName: input.actorName ?? null,
      },
      update: {},
      select: { id: true },
    });

    this.logger.debug(
      `notification.job.enqueued jobId=${job.id} event=${input.eventType} workspace=${input.workspaceId}`,
    );

    return { job_id: job.id };
  }
}
