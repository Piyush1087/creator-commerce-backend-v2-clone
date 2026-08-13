import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  UceApplicationScope,
  UceCampaignStatus,
  UceCollabStatus,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { normalizeInstagramHandle } from "../../brand-uce/utils/instagram-handle.util";
import { generateInvitationToken } from "../utils/invitation-token.util";

type AuthUser = { id: string; email: string; role: UserRole };

@Injectable()
export class CreatorInvitationService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveInvitationToken(token: string) {
    const collab = await this.prisma.uceCampaignCollaboration.findFirst({
      where: { invitationToken: token },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            targeting: { select: { applicationScope: true } },
          },
        },
      },
    });

    if (!collab || collab.campaign.status !== UceCampaignStatus.LIVE) {
      throw new NotFoundException("Invitation not found or campaign is unavailable");
    }

    return {
      invitation_token: token,
      collaboration_id: collab.id,
      campaign_id: collab.campaignId,
      campaign_name: collab.campaign.name,
      application_scope: collab.campaign.targeting?.applicationScope ?? null,
      instagram_handle: collab.instagramHandle,
      collab_status: collab.collabStatus,
      is_claimable:
        collab.collabStatus === UceCollabStatus.PROSPECT_INVITED ||
        collab.collabStatus === UceCollabStatus.PROSPECT_CURATED,
    };
  }

  async claimInvitation(user: AuthUser, token: string) {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }

    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile?.instagramHandle) {
      throw new BadRequestException(
        "Complete your creator profile with an Instagram handle before claiming an invitation.",
      );
    }

    const handle = normalizeInstagramHandle(profile.instagramHandle);
    const collab = await this.prisma.uceCampaignCollaboration.findFirst({
      where: { invitationToken: token },
    });

    if (!collab) {
      throw new NotFoundException("Invitation not found");
    }

    if (collab.instagramHandle !== handle) {
      throw new ForbiddenException(
        "This invitation was issued to a different creator profile.",
      );
    }

    if (
      collab.collabStatus !== UceCollabStatus.PROSPECT_INVITED &&
      collab.collabStatus !== UceCollabStatus.PROSPECT_CURATED
    ) {
      throw new BadRequestException("Invitation has already been claimed or is no longer valid.");
    }

    await this.prisma.uceCampaignCollaboration.update({
      where: { id: collab.id },
      data: { collabStatus: UceCollabStatus.PROSPECT_INVITED },
    });

    return {
      collaboration_id: collab.id,
      campaign_id: collab.campaignId,
      claimed: true,
    };
  }

  bypassesEligibility(applicationScope: UceApplicationScope | null | undefined): boolean {
    return applicationScope === UceApplicationScope.DIRECT_BYPASS;
  }

  createTokenForCollaboration(): string {
    return generateInvitationToken();
  }
}
