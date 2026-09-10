import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import type { CollaborationAvailableAction } from "../types/collaboration.types";

export const CREATOR_HOME_COLLABORATION_EVENT_TYPES = [
  "COLLABORATION_CREATED",
  "CREATOR_PROPOSAL_SUBMITTED",
  "CREATOR_PROPOSAL_COUNTERED",
  "CREATOR_PROPOSAL_ACCEPTED",
  "BRAND_COUNTER_ACCEPTED",
  "NEGOTIATION_DECLINED",
  "DELIVERY_DESTINATION_CONFIRMED",
  "FULFILLMENT_PROVIDED",
  "FULFILLMENT_CONFIRMED",
  "FULFILLMENT_ISSUE_REPORTED",
  "FULFILLMENT_REMEDIATED",
  "DELIVERABLE_SUBMITTED",
  "DELIVERABLE_REVISION_REQUESTED",
  "DELIVERABLE_APPROVED",
  "DELIVERABLE_AUTO_APPROVED",
  "FINAL_DELIVERABLE_REJECTED",
  "PUBLISHING_AUTHORIZED",
  "PUBLISHING_EVIDENCE_SUBMITTED",
  "PUBLISHING_EVIDENCE_CORRECTED",
  "PUBLISHING_CORRECTION_REQUESTED",
  "PUBLISHING_VERIFIED",
  "PUBLISHING_COMPLIANCE_BLOCKED",
  "PUBLISHING_DECLINED",
  "COLLABORATION_COMPLETED",
  "COLLABORATION_ENDED_BY_BRAND",
  "COLLABORATION_CANCELLED_BY_CREATOR",
  "CREATOR_NON_PERFORMANCE_ESTABLISHED",
  "CREATOR_PUBLISHING_NON_PERFORMANCE_ESTABLISHED",
  "ADMIN_RESOLUTION_APPLIED",
] as const;

const EVENT_COPY: Record<
  (typeof CREATOR_HOME_COLLABORATION_EVENT_TYPES)[number],
  readonly [string, string]
> = {
  COLLABORATION_CREATED: [
    "Collaboration started",
    "A new collaboration is ready.",
  ],
  CREATOR_PROPOSAL_SUBMITTED: [
    "Proposal submitted",
    "Your proposal was submitted.",
  ],
  CREATOR_PROPOSAL_COUNTERED: [
    "Proposal updated",
    "The proposal was countered.",
  ],
  CREATOR_PROPOSAL_ACCEPTED: [
    "Proposal accepted",
    "Your proposal was accepted.",
  ],
  BRAND_COUNTER_ACCEPTED: [
    "Counter accepted",
    "The brand counter was accepted.",
  ],
  NEGOTIATION_DECLINED: ["Negotiation ended", "The negotiation was declined."],
  DELIVERY_DESTINATION_CONFIRMED: [
    "Delivery destination confirmed",
    "The delivery destination is confirmed.",
  ],
  FULFILLMENT_PROVIDED: ["Fulfillment provided", "Brand support was provided."],
  FULFILLMENT_CONFIRMED: [
    "Fulfillment confirmed",
    "Brand support was confirmed.",
  ],
  FULFILLMENT_ISSUE_REPORTED: [
    "Fulfillment issue reported",
    "An issue was reported.",
  ],
  FULFILLMENT_REMEDIATED: [
    "Fulfillment remediated",
    "The fulfillment issue was remediated.",
  ],
  DELIVERABLE_SUBMITTED: [
    "Deliverable submitted",
    "A deliverable was submitted.",
  ],
  DELIVERABLE_REVISION_REQUESTED: [
    "Revision requested",
    "A deliverable needs revision.",
  ],
  DELIVERABLE_APPROVED: ["Deliverable approved", "A deliverable was approved."],
  DELIVERABLE_AUTO_APPROVED: [
    "Deliverable approved",
    "A deliverable was automatically approved.",
  ],
  FINAL_DELIVERABLE_REJECTED: [
    "Deliverable rejected",
    "The final deliverable was rejected.",
  ],
  PUBLISHING_AUTHORIZED: [
    "Publishing authorized",
    "Publishing was authorized.",
  ],
  PUBLISHING_EVIDENCE_SUBMITTED: [
    "Publishing evidence submitted",
    "Publishing evidence was submitted.",
  ],
  PUBLISHING_EVIDENCE_CORRECTED: [
    "Publishing evidence corrected",
    "Corrected publishing evidence was submitted.",
  ],
  PUBLISHING_CORRECTION_REQUESTED: [
    "Publishing correction requested",
    "Publishing evidence needs correction.",
  ],
  PUBLISHING_VERIFIED: ["Publishing verified", "Publishing was verified."],
  PUBLISHING_COMPLIANCE_BLOCKED: [
    "Publishing blocked",
    "Publishing compliance needs attention.",
  ],
  PUBLISHING_DECLINED: ["Publishing declined", "Publishing was declined."],
  COLLABORATION_COMPLETED: [
    "Collaboration completed",
    "The collaboration was completed.",
  ],
  COLLABORATION_ENDED_BY_BRAND: [
    "Collaboration ended",
    "The brand ended the collaboration.",
  ],
  COLLABORATION_CANCELLED_BY_CREATOR: [
    "Collaboration cancelled",
    "The collaboration was cancelled by the Creator.",
  ],
  CREATOR_NON_PERFORMANCE_ESTABLISHED: [
    "Collaboration status updated",
    "Creator non-performance was established.",
  ],
  CREATOR_PUBLISHING_NON_PERFORMANCE_ESTABLISHED: [
    "Publishing status updated",
    "Creator publishing non-performance was established.",
  ],
  ADMIN_RESOLUTION_APPLIED: [
    "Resolution applied",
    "An administrator resolution was applied.",
  ],
};

export function creatorActiveCollaborationHomeWhere(
  actor: CreatorWorkspaceActorContext,
): Prisma.CollaborationWhereInput {
  return {
    creatorWorkspaceId: actor.workspaceId,
    creatorProfileId: actor.subjectCreatorProfileId,
    OR: [
      { sourceApplicationId: { not: null }, lifecycle: "ACTIVE" },
      { sourceApplicationId: null, isPaused: false, isTerminated: false },
    ],
  };
}

type HomeRow = Prisma.CollaborationGetPayload<{
  select: typeof HOME_SELECT;
}>;

const HOME_SELECT = {
  id: true,
  sourceApplicationId: true,
  lifecycle: true,
  canonicalStage: true,
  currentStageStatus: true,
  updatedAt: true,
  unreadCountCreator: true,
  campaign: { select: { name: true } },
  brandProfile: { select: { name: true } },
  commercialAgreement: {
    select: { negotiationState: true, securementState: true },
  },
  fulfillment: { select: { state: true } },
  deliverables: {
    select: {
      state: true,
      revisionRequestCount: true,
      publishingRequired: true,
      publishing: { select: { state: true, authorizationState: true } },
    },
  },
} as const;

function availableActions(
  row: HomeRow,
  actor: CreatorWorkspaceActorContext,
): CollaborationAvailableAction[] {
  const actions: CollaborationAvailableAction[] = ["PostCollaborationMessage"];
  if (
    actor.actorRole === "ASSISTANT" ||
    row.sourceApplicationId === null ||
    row.lifecycle !== "ACTIVE"
  )
    return actions;
  if (row.canonicalStage === "NEGOTIATION") {
    if (
      row.commercialAgreement?.negotiationState === "AWAITING_CREATOR_PROPOSAL"
    )
      actions.push("SubmitCreatorProposal");
    if (
      row.commercialAgreement?.negotiationState === "AWAITING_CREATOR_DECISION"
    )
      actions.push("AcceptCounterOffer", "DeclineNegotiation");
  } else if (
    row.canonicalStage === "FULFILLMENT" &&
    row.fulfillment?.state === "AWAITING_CREATOR_CONFIRMATION"
  ) {
    actions.push("ConfirmFulfillment", "ReportFulfillmentIssue");
  } else if (row.canonicalStage === "PRODUCTION") {
    if (
      row.deliverables.some(
        (item) =>
          item.state === "AWAITING_SUBMISSION" ||
          item.state === "REVISION_REQUESTED",
      )
    )
      actions.push("SubmitDeliverable");
  } else if (row.canonicalStage === "PUBLISHING_SETTLEMENT") {
    if (
      row.deliverables.some(
        (item) =>
          item.publishing?.authorizationState === "AUTHORIZED" &&
          ["AWAITING_PUBLISHING", "CORRECTION_REQUIRED"].includes(
            item.publishing.state,
          ),
      )
    ) {
      actions.push(
        row.deliverables.some(
          (item) => item.publishing?.state === "CORRECTION_REQUIRED",
        )
          ? "SubmitCorrectedPublishingEvidence"
          : "SubmitPublishingEvidence",
      );
    }
  }
  if (
    row.canonicalStage !== "NEGOTIATION" &&
    row.currentStageStatus !== "BLOCKED"
  )
    actions.push("CancelCollaborationByCreator");
  return actions;
}

@Injectable()
export class CollaborationHomeReadService {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    actor: CreatorWorkspaceActorContext,
    previewLimit: number,
    activityLimit: number,
  ) {
    const where = creatorActiveCollaborationHomeWhere(actor);
    const [activeCount, rows, events] = await this.prisma.$transaction([
      this.prisma.collaboration.count({ where }),
      this.prisma.collaboration.findMany({
        where,
        select: HOME_SELECT,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: previewLimit + 1,
      }),
      this.prisma.collaborationEvent.findMany({
        where: {
          kind: "DOMAIN",
          eventType: { in: [...CREATOR_HOME_COLLABORATION_EVENT_TYPES] },
          collaboration: {
            creatorWorkspaceId: actor.workspaceId,
            creatorProfileId: actor.subjectCreatorProfileId,
          },
        },
        select: {
          id: true,
          collaborationId: true,
          eventType: true,
          occurredAt: true,
          projectionOutbox: {
            where: { projectionType: "NOTIFICATION" },
            select: { id: true },
          },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "asc" }],
        take: activityLimit,
      }),
    ]);
    return {
      exactActiveCount: activeCount,
      preview: rows.slice(0, previewLimit).map((row) => ({
        id: row.id,
        brandName: row.brandProfile.name,
        campaignName: row.campaign.name,
        lifecycle: row.sourceApplicationId ? row.lifecycle : "ACTIVE",
        stage: row.canonicalStage,
        unreadCount: row.unreadCountCreator,
        availableActions: availableActions(row, actor),
        updatedAt: row.updatedAt.toISOString(),
      })),
      truncated: rows.length > previewLimit,
      activity: events.map((event) => {
        const eventType =
          event.eventType as (typeof CREATOR_HOME_COLLABORATION_EVENT_TYPES)[number];
        const copy = EVENT_COPY[eventType];
        return {
          id: `collaboration:${event.collaborationId}:event:${event.id}`,
          sourceId: event.id,
          collaborationId: event.collaborationId,
          eventType,
          title: copy[0],
          subtitle: copy[1],
          occurredAt: event.occurredAt.toISOString(),
          notificationAliasKeys: event.projectionOutbox.map((item) => item.id),
        };
      }),
      observedAt: new Date().toISOString(),
    };
  }
}
