import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";

const APPLICATION_ACTIVITY_NAMES = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
] as const;

export function creatorApplicationHomeWhere(
  actor: CreatorWorkspaceActorContext,
): Prisma.UceApplicationWhereInput {
  return {
    authorityVersion: "C03_CANONICAL",
    subjectCreatorProfileId: actor.subjectCreatorProfileId,
    subjectCreatorWorkspaceId: actor.workspaceId,
  };
}

function record(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function text(value: Prisma.JsonValue | undefined, fallback: string): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 300)
    : fallback;
}

@Injectable()
export class ApplicationHomeReadService {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    actor: CreatorWorkspaceActorContext,
    previewLimit: number,
    activityLimit: number,
  ) {
    const where = creatorApplicationHomeWhere(actor);
    const [pendingCount, rows, events] = await this.prisma.$transaction([
      this.prisma.uceApplication.count({
        where: { ...where, status: "PENDING" },
      }),
      this.prisma.uceApplication.findMany({
        where,
        select: {
          id: true,
          status: true,
          appliedAt: true,
          updatedAt: true,
          snapshot: { select: { campaignContext: true, briefContext: true } },
          collaboration: { select: { id: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: previewLimit + 1,
      }),
      this.prisma.applicationDomainEvent.findMany({
        where: {
          subjectCreatorProfileId: actor.subjectCreatorProfileId,
          subjectCreatorWorkspaceId: actor.workspaceId,
          eventName: { in: [...APPLICATION_ACTIVITY_NAMES] },
        },
        select: {
          id: true,
          transitionId: true,
          applicationId: true,
          eventName: true,
          occurredAt: true,
        },
        orderBy: [{ occurredAt: "desc" }, { id: "asc" }],
        take: activityLimit,
      }),
    ]);
    const canWithdraw = actor.allowedActions.includes(
      "CAMPAIGN_APPLICATION_WITHDRAW_PENDING",
    );
    return {
      exactPendingCount: pendingCount,
      preview: rows.slice(0, previewLimit).map((row) => {
        const campaign = record(row.snapshot?.campaignContext);
        const brief = record(row.snapshot?.briefContext);
        return {
          id: row.id,
          campaignName: text(campaign.name, "Campaign application"),
          briefName: text(brief.briefName, "Campaign brief"),
          status: row.status,
          appliedAt: row.appliedAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          collaborationId: row.collaboration?.id ?? null,
          availableActions:
            row.status === "PENDING" && canWithdraw ? ["WITHDRAW"] : [],
        };
      }),
      truncated: rows.length > previewLimit,
      activity: events.map((event) => ({
        id: `application:${event.applicationId}:transition:${event.transitionId}`,
        sourceId: event.id,
        applicationId: event.applicationId,
        transitionId: event.transitionId,
        eventType: event.eventName,
        occurredAt: event.occurredAt.toISOString(),
      })),
      observedAt: new Date().toISOString(),
    };
  }
}
