import type {
  ApplicationCommandType,
  ApplicationDomainEventName,
  Prisma,
  UceApplication,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import type { CommandIdentity } from "./application-command";

export type CanonicalApplication = UceApplication & {
  subjectCreatorProfileId: string;
  subjectCreatorWorkspaceId: string;
  brandProfileId: string;
  canonicalCampaignAssetId: string;
  canonicalBriefId: string;
};

export function canonicalApplication(
  row: UceApplication,
): CanonicalApplication {
  if (
    row.authorityVersion !== "C03_CANONICAL" ||
    !row.subjectCreatorProfileId ||
    !row.subjectCreatorWorkspaceId ||
    !row.brandProfileId ||
    !row.canonicalCampaignAssetId ||
    !row.canonicalBriefId
  )
    throw new Error("C03_CANONICAL_APPLICATION_EVIDENCE_INVALID");
  return row as CanonicalApplication;
}

export type EventActor =
  | { kind: "CREATOR_TEAM_USER"; actor: CreatorWorkspaceActorContext }
  | { kind: "BRAND_USER"; actorUserId: string }
  | { kind: "SYSTEM" };

export async function appendApplicationEvent(
  tx: Prisma.TransactionClient,
  application: CanonicalApplication,
  eventName: ApplicationDomainEventName,
  actor: EventActor,
  now: Date,
  command?: { type: ApplicationCommandType; identity: CommandIdentity },
  handoff?: {
    transitionId?: string;
    approvedCollaborationId?: string;
    /** Transactional outbox only; never external I/O. Runs before receipt. */
    enqueue?: (transitionId: string) => Promise<unknown>;
  },
) {
  const transitionId = handoff?.transitionId ?? randomUUID();
  const actorUserId =
    actor.kind === "CREATOR_TEAM_USER"
      ? actor.actor.actorUserId
      : actor.kind === "BRAND_USER"
        ? actor.actorUserId
        : null;
  await tx.applicationDomainEvent.create({
    data: {
      transitionId,
      approvedCollaborationId: handoff?.approvedCollaborationId,
      applicationId: application.id,
      applicationVersion: application.statusVersion,
      eventName,
      eventVersion: 1,
      occurredAt: now,
      fromStatus: eventName === "SUBMITTED" ? null : "PENDING",
      toStatus: application.status,
      actorClass: actor.kind,
      actorUserId,
      actorMembershipId:
        actor.kind === "CREATOR_TEAM_USER"
          ? actor.actor.actorMembershipId
          : null,
      actorRole:
        actor.kind === "CREATOR_TEAM_USER" ? actor.actor.actorRole : null,
      subjectCreatorProfileId: application.subjectCreatorProfileId,
      subjectCreatorWorkspaceId: application.subjectCreatorWorkspaceId,
      brandProfileId: application.brandProfileId,
      campaignId: application.campaignId,
      canonicalCampaignAssetId: application.canonicalCampaignAssetId,
      canonicalBriefId: application.canonicalBriefId,
    },
  });
  await handoff?.enqueue?.(transitionId);
  if (command && actorUserId)
    await tx.applicationCommandReceipt.create({
      data: {
        commandType: command.type,
        actorUserId,
        authoritySubjectId:
          actor.kind === "BRAND_USER"
            ? application.brandProfileId
            : application.subjectCreatorProfileId,
        ...command.identity,
        applicationId: application.id,
        transitionId,
      },
    });
  return {
    applicationId: application.id,
    transitionId,
    status: application.status,
    statusVersion: application.statusVersion,
    occurredAt: now.toISOString(),
  };
}
