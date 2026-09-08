import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import {
  invitationIdentityMatches,
  INVITATION_IDENTITY_ENV,
} from "./invitation-identity";
import { evaluateInstagramOpportunity } from "../../shared/creator/instagram-opportunity-capability";
import type { InvitationResult } from "./campaign-opportunity-policy.service";

@Injectable()
export class CampaignInvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Ephemeral POST exchange. No raw credential leaves this method or enters persistence. */
  async exchange(
    campaignId: string,
    raw: string,
    now: Date,
  ): Promise<string | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
    const tokenDigest = createHash("sha256").update(raw).digest("hex");
    const invitation =
      await this.prisma.campaignOpportunityInvitation.findUnique({
        where: { tokenDigest },
        select: {
          id: true,
          campaignId: true,
          expiresAt: true,
          revokedAt: true,
        },
      });
    return invitation?.campaignId === campaignId &&
      invitation.expiresAt > now &&
      !invitation.revokedAt
      ? invitation.id
      : null;
  }

  /** invitationId must come from proven continuation possession or exact bound-subject lookup. */
  async validateAndBind(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
    campaignId: string,
    invitationId: string,
    now: Date,
  ): Promise<InvitationResult> {
    await tx.$queryRaw`SELECT id FROM campaign_opportunity_invitations WHERE id = ${invitationId} FOR UPDATE`;
    const invitation = await tx.campaignOpportunityInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.campaignId !== campaignId) return "ABSENT";
    if (invitation.revokedAt) return "REVOKED";
    if (invitation.expiresAt <= now) return "EXPIRED";
    if (
      invitation.boundCreatorProfileId &&
      (invitation.boundCreatorProfileId !== actor.subjectCreatorProfileId ||
        invitation.boundCreatorWorkspaceId !== actor.workspaceId)
    )
      return "SUBJECT_MISMATCH";
    const owner = await tx.user.findUnique({
      where: { id: actor.subjectOwnerUserId },
      select: { email: true, emailVerifiedAt: true },
    });
    const integration = await tx.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: actor.subjectCreatorProfileId,
          platformNetwork: "INSTAGRAM",
        },
      },
    });
    if (
      !invitationIdentityMatches(
        invitation,
        {
          profileId: actor.subjectCreatorProfileId,
          nativeInstagramId: integration?.nativePlatformUserId ?? null,
          verifiedOwnerEmail: owner?.emailVerifiedAt ? owner.email : null,
        },
        this.config.get<string>(INVITATION_IDENTITY_ENV),
      )
    )
      return "SUBJECT_MISMATCH";
    if (
      !invitation.boundCreatorProfileId &&
      evaluateInstagramOpportunity(integration, now).usableForOpportunity
    ) {
      await tx.campaignOpportunityInvitation.update({
        where: { id: invitation.id },
        data: {
          boundCreatorProfileId: actor.subjectCreatorProfileId,
          boundCreatorWorkspaceId: actor.workspaceId,
          bindingVersion: 1,
        },
      });
    }
    return "VALID";
  }
}
