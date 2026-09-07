import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { lockCreatorTeam } from "../creator-settings/team/creator-team.policy";
import {
  applicationSelectionSchema,
  commandIdentity,
  replayCommand,
} from "./application-command";
import {
  appendApplicationEvent,
  canonicalApplication,
} from "./application-evidence";
import { ApplicationSubmitContextService } from "./application-submit-context.service";
import { NotificationDispatchService } from "../notifications/services/notification-dispatch.service";

/** JSON serialization is confined to server-authored snapshot projections. */
function json(value: unknown): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

@Injectable()
export class ApplicationSubmitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
    private readonly contexts: ApplicationSubmitContextService,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async submit(
    user: AuthUser,
    campaignId: string,
    body: unknown,
    key: unknown,
  ) {
    const parsed = applicationSelectionSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException({ code: "APPLICATION_SELECTION_INVALID" });
    const identity = commandIdentity(key, { campaignId, ...parsed.data });
    const preliminary = await this.actors.resolve(user);
    return this.prisma.$transaction(
      async (tx) => {
        await lockCreatorTeam(tx, preliminary.workspaceId);
        const actor = await this.actors.resolveInTransaction(
          tx,
          user,
          preliminary.workspaceId,
        );
        if (!actor.allowedActions.includes("CAMPAIGN_APPLICATION_APPLY"))
          throw new ForbiddenException({ code: "APPLICATION_ROLE_DENIED" });
        const replay = await replayCommand(
          tx,
          "SUBMIT",
          actor.actorUserId,
          actor.subjectCreatorProfileId,
          identity,
        );
        if (replay) return replay;
        const context = await this.contexts.resolve(
          tx,
          actor,
          campaignId,
          parsed.data.campaignAssetId,
          parsed.data.briefId,
        );
        const {
          read,
          access,
          asset,
          brief,
          firstTouch,
          campaignInvitationId,
          creator,
          now,
        } = context;
        // P1.2 has no client round-trip attribution reference. Correlation is exact
        // Campaign + subject + workspace only; it confers no access authority.
        const latest = await tx.campaignIngressTouch.findFirst({
          where: {
            campaignId,
            kind: "QUALIFIED_INGRESS",
            boundCreatorProfileId: actor.subjectCreatorProfileId,
            boundCreatorWorkspaceId: actor.workspaceId,
          },
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        });
        const conversion = await tx.campaignIngressTouch.create({
          data: {
            kind: "APPLICATION_CONVERSION",
            campaignId,
            entrySurface: latest?.entrySurface ?? "DIRECT_CAMPAIGN_LINK",
            entryAuthorityKind: latest?.entryAuthorityKind ?? "DIRECT",
            campaignShareId: latest?.campaignShareId ?? null,
            campaignInvitationId: latest?.campaignInvitationId ?? null,
            boundCreatorProfileId: actor.subjectCreatorProfileId,
            boundCreatorWorkspaceId: actor.workspaceId,
            boundAt: now,
            occurredAt: now,
            utmSource: latest?.utmSource,
            utmMedium: latest?.utmMedium,
            utmCampaign: latest?.utmCampaign,
            utmContent: latest?.utmContent,
            utmTerm: latest?.utmTerm,
          },
        });
        // Accepted invitations contain no canonical Outreach lineage. Therefore
        // invitation origin remains DIRECT and is preserved separately.
        const source =
          latest?.entryAuthorityKind === "SHARE" && latest.campaignShareId
            ? "SHARE"
            : "DIRECT";
        const application = canonicalApplication(
          await tx.uceApplication.create({
            data: {
              authorityVersion: "C03_CANONICAL",
              campaignId,
              brandProfileId: read.campaign.brandProfileId,
              canonicalCampaignAssetId: asset.id,
              canonicalBriefId: brief.id,
              subjectCreatorProfileId: actor.subjectCreatorProfileId,
              subjectCreatorWorkspaceId: actor.workspaceId,
              actorUserId: actor.actorUserId,
              actorMembershipId: actor.actorMembershipId,
              actorRole: actor.actorRole,
              campaignInvitationId,
              firstQualifiedTouchId: firstTouch?.id ?? null,
              conversionTouchId: conversion.id,
              source,
              status: "PENDING",
              statusVersion: 1,
              appliedAt: now,
            },
          }),
        );
        await tx.uceApplicationSnapshot.create({
          data: {
            applicationId: application.id,
            schemaVersion: "C03_APPLICATION_SNAPSHOT_V1",
            createdAt: now,
            campaignContext: json({
              ...access.campaign,
              brandProfileId: read.campaign.brandProfileId,
              applicationDeadline: access.applicationDeadline,
              schemaVersion: 1,
              createdAt: now.toISOString(),
            }),
            campaignAssetContext: json({
              id: asset.id,
              campaignId,
              kind: asset.kind,
              offering: asset.offering,
              offer: asset.offer,
            }),
            briefContext: json({
              id: brief.id,
              campaignAssetId: asset.id,
              ...brief.definition,
            }),
            commercialContext: json(access.campaign.commercial),
            creatorIdentity: json({
              subjectCreatorProfileId: actor.subjectCreatorProfileId,
              workspaceId: actor.workspaceId,
              ...creator,
            }),
            actorContext: json({
              actorUserId: actor.actorUserId,
              actorMembershipId: actor.actorMembershipId,
              actorRole: actor.actorRole,
            }),
            attributionContext: json({
              source,
              campaignInvitationId,
              firstQualifiedTouch: firstTouch
                ? {
                    id: firstTouch.id,
                    occurredAt: firstTouch.occurredAt,
                    entrySurface: firstTouch.entrySurface,
                    entryAuthorityKind: firstTouch.entryAuthorityKind,
                    campaignShareId: firstTouch.campaignShareId,
                    campaignInvitationId: firstTouch.campaignInvitationId,
                  }
                : null,
              conversionTouch: {
                id: conversion.id,
                occurredAt: now,
                entrySurface: conversion.entrySurface,
                entryAuthorityKind: conversion.entryAuthorityKind,
                campaignShareId: conversion.campaignShareId,
                campaignInvitationId: conversion.campaignInvitationId,
              },
            }),
          },
        });
        return appendApplicationEvent(
          tx,
          application,
          "SUBMITTED",
          { kind: "CREATOR_TEAM_USER", actor },
          now,
          { type: "SUBMIT", identity },
          {
            enqueue: (transitionId) =>
              this.notifications.enqueueWithinTransaction(tx, {
                workspaceId: application.brandProfileId,
                eventType: "campaigns.application_received",
                source: {
                  sourceType: "c03_application",
                  sourceId: application.id,
                  transitionId,
                },
                payload: {
                  application_id: application.id,
                  campaign_id: application.campaignId,
                },
                triggerUserId: actor.actorUserId,
              }),
          },
        );
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  }
}
