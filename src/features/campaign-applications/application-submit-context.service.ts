import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import { evaluateInstagramOpportunity } from "../../shared/creator/instagram-opportunity-capability";
import { CanonicalCampaignApplicationReadService } from "../brand-uce/services/canonical-campaign-application-read.service";
import { CampaignInvitationService } from "../campaign-opportunities/campaign-invitation.service";
import { CampaignOpportunityEligibilityPort } from "../campaign-opportunities/campaign-opportunity-eligibility";
import {
  CampaignOpportunityPolicyService,
  type InvitationResult,
} from "../campaign-opportunities/campaign-opportunity-policy.service";
import { blocksApplicationReapply } from "./application-command";

/** Caller holds the workspace lock and has re-resolved APPLY authority. */
@Injectable()
export class ApplicationSubmitContextService {
  constructor(
    private readonly reads: CanonicalCampaignApplicationReadService,
    private readonly policy: CampaignOpportunityPolicyService,
    private readonly eligibility: CampaignOpportunityEligibilityPort,
    private readonly invitations: CampaignInvitationService,
  ) {}

  async resolve(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
    campaignId: string,
    campaignAssetId: string,
    briefId: string,
  ) {
    await tx.$queryRaw`SELECT id FROM uce_campaigns WHERE id = ${campaignId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM creator_social_integrations WHERE creator_profile_id = ${actor.subjectCreatorProfileId} AND platform_network = 'INSTAGRAM' FOR UPDATE`;
    // The persisted facts row follows the integration, matching Instagram connect.
    await tx.$queryRaw`SELECT id FROM creator_profiles WHERE id = ${actor.subjectCreatorProfileId} FOR SHARE`;
    await tx.$queryRaw`SELECT campaign_id FROM uce_campaign_targeting WHERE campaign_id = ${campaignId} FOR SHARE`;
    const invitationCheckTime = new Date();
    const integration = await tx.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: actor.subjectCreatorProfileId,
          platformNetwork: "INSTAGRAM",
        },
      },
    });
    const initialInstagram = evaluateInstagramOpportunity(
      integration,
      invitationCheckTime,
    );
    let invitation: InvitationResult = "ABSENT";
    let campaignInvitationId: string | null = null;
    const bound = await tx.campaignOpportunityInvitation.findMany({
      where: {
        campaignId,
        boundCreatorProfileId: actor.subjectCreatorProfileId,
        boundCreatorWorkspaceId: actor.workspaceId,
      },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (initialInstagram.usableForOpportunity)
      for (const row of bound) {
        invitation = await this.invitations.validateAndBind(
          tx,
          actor,
          campaignId,
          row.id,
          new Date(),
        );
        if (invitation === "VALID") {
          campaignInvitationId = row.id;
          break;
        }
      }
    await tx.$queryRaw`SELECT campaign_asset_id FROM uce_campaign_assets WHERE campaign_asset_id = ${campaignAssetId} AND campaign_id = ${campaignId} FOR UPDATE`;
    await tx.$queryRaw`SELECT brief_id FROM campaign_briefs WHERE brief_id = ${briefId} AND campaign_asset_id = ${campaignAssetId} FOR UPDATE`;
    const now = new Date();
    const instagram = evaluateInstagramOpportunity(integration, now);
    if (campaignInvitationId) {
      const lockedInvitation =
        await tx.campaignOpportunityInvitation.findUniqueOrThrow({
          where: { id: campaignInvitationId },
        });
      if (lockedInvitation.expiresAt <= now) {
        invitation = "EXPIRED";
        campaignInvitationId = null;
      }
    }
    const read = await this.reads.resolveOpportunity(tx, campaignId);
    const facts = await this.eligibility.evaluate(
      tx,
      campaignId,
      actor.subjectCreatorProfileId,
    );
    const firstTouch = await tx.campaignIngressTouch.findFirst({
      where: {
        campaignId,
        kind: "QUALIFIED_INGRESS",
        boundCreatorProfileId: actor.subjectCreatorProfileId,
        boundCreatorWorkspaceId: actor.workspaceId,
      },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    const access = this.policy.evaluate({
      campaign: read,
      actor,
      requestClass: "AUTHENTICATED_CREATOR",
      instagram,
      invitation,
      eligibility: facts,
      qualifiedContext: Boolean(firstTouch),
      applicationBlockedReason: null,
      now,
    });
    if (access.state !== "AUTHORIZED") {
      if (
        access.state === "LOCKED" &&
        access.reason === "OPPORTUNITY_NOT_AVAILABLE"
      )
        throw new NotFoundException({ code: "OPPORTUNITY_NOT_AVAILABLE" });
      throw new ConflictException({ code: access.reason });
    }
    if (!access.canApply)
      throw new ConflictException({ code: access.applyBlockedReason });
    const asset = read?.assets.find((item) => item.id === campaignAssetId);
    const brief = asset?.briefs.find((item) => item.id === briefId);
    if (!read || !asset || !brief)
      throw new ConflictException({ code: "APPLICATION_SELECTION_INVALID" });
    if (brief.applicationSelection.state !== "AVAILABLE")
      throw new ConflictException({ code: brief.applicationSelection.reason });
    const legacyCount = await tx.uceApplication.count({
      where: {
        authorityVersion: "LEGACY_COMPATIBILITY",
        campaign: { brandProfileId: read.campaign.brandProfileId },
        campaignCreator: { creatorProfileId: actor.subjectCreatorProfileId },
      },
    });
    if (legacyCount)
      throw new ConflictException({
        code: "LEGACY_APPLICATION_RECONCILIATION_REQUIRED",
      });
    const rows = await tx.uceApplication.findMany({
      where: {
        authorityVersion: "C03_CANONICAL",
        subjectCreatorProfileId: actor.subjectCreatorProfileId,
        brandProfileId: read.campaign.brandProfileId,
        status: { not: "WITHDRAWN" },
      },
      select: {
        campaignId: true,
        canonicalCampaignAssetId: true,
        canonicalBriefId: true,
        status: true,
      },
    });
    const current = rows.filter((row) => row.campaignId === campaignId);
    if (
      current.some(
        (row) =>
          row.canonicalCampaignAssetId === campaignAssetId &&
          row.canonicalBriefId === briefId &&
          blocksApplicationReapply(row.status),
      )
    )
      throw new ConflictException({
        code: "APPLICATION_OPPORTUNITY_ALREADY_USED",
      });
    if (current.length >= 2)
      throw new ConflictException({
        code: "APPLICATION_CAMPAIGN_LIMIT_REACHED",
      });
    if (rows.length >= 5)
      throw new ConflictException({ code: "APPLICATION_BRAND_LIMIT_REACHED" });
    const creator = await tx.creatorProfile.findUniqueOrThrow({
      where: { id: actor.subjectCreatorProfileId },
      select: { displayName: true, avatarUrl: true },
    });
    return {
      read,
      access,
      asset,
      brief,
      campaignInvitationId,
      firstTouch,
      creator,
      now,
    };
  }
}
