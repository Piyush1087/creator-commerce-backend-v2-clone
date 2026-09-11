import {
  GoneException,
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
    void user;
    void token;
    throw new GoneException({
      code: "OUT_OF_MVP_COMPETING_TRANSITION_RETIRED",
      message:
        "Marketplace invitation claim cannot mutate UceCampaignCollaboration; use canonical C-03 apply",
    });
  }

  bypassesEligibility(applicationScope: UceApplicationScope | null | undefined): boolean {
    return applicationScope === UceApplicationScope.DIRECT_BYPASS;
  }

  createTokenForCollaboration(): string {
    return generateInvitationToken();
  }
}
