import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import { evaluateInstagramOpportunity } from "../../shared/creator/instagram-opportunity-capability";
import type { AuthUser } from "../auth/types/auth-user";
import { CanonicalCampaignApplicationReadService } from "../brand-uce/services/canonical-campaign-application-read.service";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { lockCreatorTeam } from "../creator-settings/team/creator-team.policy";
import { CreatorCampaignApplyContinuationService } from "../creator-entry/creator-campaign-apply-continuation.service";
import type { CampaignContinuationSeed } from "../creator-entry/campaign-continuation-context.port";
import { CampaignOpportunityEligibilityPort } from "./campaign-opportunity-eligibility";
import {
  CampaignOpportunityPolicyService,
  type CampaignRead,
  type InvitationResult,
} from "./campaign-opportunity-policy.service";
import { CampaignInvitationService } from "./campaign-invitation.service";
import {
  CampaignIngressService,
  normalizeCampaignAttribution,
} from "./campaign-ingress.service";

@Injectable()
export class CampaignOpportunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
    private readonly reads: CanonicalCampaignApplicationReadService,
    private readonly policy: CampaignOpportunityPolicyService,
    private readonly eligibility: CampaignOpportunityEligibilityPort,
    private readonly invitations: CampaignInvitationService,
    private readonly ingress: CampaignIngressService,
    private readonly continuations: CreatorCampaignApplyContinuationService,
  ) {}

  async detail(campaignId: string, user: AuthUser | undefined) {
    return this.prisma.$transaction(async (tx) => {
      const actor =
        user?.role === "CREATOR"
          ? await this.actors.resolveInTransaction(tx, user)
          : null;
      return this.project(tx, campaignId, user, actor, new Date());
    });
  }

  private async project(
    tx: Prisma.TransactionClient,
    campaignId: string,
    user: AuthUser | undefined,
    actor: CreatorWorkspaceActorContext | null,
    now: Date,
  ) {
    const campaign = await this.reads.resolveOpportunity(tx, campaignId);
    const integration = actor
      ? await tx.creatorSocialIntegration.findUnique({
          where: {
            creatorProfileId_platformNetwork: {
              creatorProfileId: actor.subjectCreatorProfileId,
              platformNetwork: "INSTAGRAM",
            },
          },
        })
      : null;
    const instagram = evaluateInstagramOpportunity(integration, now);
    let invitation: InvitationResult = "ABSENT";
    if (actor && instagram.usableForOpportunity && campaign) {
      const bound = await tx.campaignOpportunityInvitation.findMany({
        where: {
          campaignId,
          boundCreatorProfileId: actor.subjectCreatorProfileId,
          boundCreatorWorkspaceId: actor.workspaceId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { id: "asc" },
      });
      for (const row of bound) {
        invitation = await this.invitations.validateAndBind(
          tx,
          actor,
          campaignId,
          row.id,
          now,
        );
        if (invitation === "VALID") break;
      }
    }
    const eligibility =
      actor &&
      campaign?.campaign.visibility.state === "AVAILABLE" &&
      campaign.campaign.visibility.value === "ELIGIBLE_ONLY" &&
      invitation !== "VALID"
        ? await this.eligibility.evaluate(
            tx,
            campaignId,
            actor.subjectCreatorProfileId,
          )
        : {
            result: "UNAVAILABLE" as const,
            targetingVersion: null,
            creatorFactsVersion: null,
          };
    const applicationBlockedReason =
      actor && campaign
        ? await this.applicationBlock(tx, actor, campaign)
        : null;
    const qualifiedContext = actor
      ? Boolean(
          await tx.campaignIngressTouch.findFirst({
            where: {
              campaignId,
              boundCreatorProfileId: actor.subjectCreatorProfileId,
              boundCreatorWorkspaceId: actor.workspaceId,
            },
            select: { id: true },
          }),
        )
      : false;
    return this.policy.evaluate({
      campaign,
      actor,
      instagram,
      invitation,
      eligibility,
      applicationBlockedReason,
      qualifiedContext,
      now,
      requestClass: !user
        ? "ANONYMOUS"
        : user.role === "CREATOR"
          ? "AUTHENTICATED_CREATOR"
          : "OTHER_ACCOUNT",
    });
  }

  private async applicationBlock(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
    read: CampaignRead,
  ) {
    const legacy = await tx.uceApplication.count({
      where: {
        authorityVersion: "LEGACY_COMPATIBILITY",
        campaign: { brandProfileId: read.campaign.brandProfileId },
        campaignCreator: { creatorProfileId: actor.subjectCreatorProfileId },
      },
    });
    if (legacy) return "LEGACY_APPLICATION_RECONCILIATION_REQUIRED";
    const rows = await tx.uceApplication.findMany({
      where: {
        authorityVersion: "C03_CANONICAL",
        subjectCreatorProfileId: actor.subjectCreatorProfileId,
        brandProfileId: read.campaign.brandProfileId,
        status: { not: "WITHDRAWN" },
      },
      select: {
        campaignId: true,
        status: true,
        canonicalCampaignAssetId: true,
        canonicalBriefId: true,
      },
    });
    if (rows.length >= 5) return "APPLICATION_BRAND_LIMIT_REACHED";
    const current = rows.filter((row) => row.campaignId === read.campaign.id);
    if (current.length >= 2) return "APPLICATION_CAMPAIGN_LIMIT_REACHED";
    const selectable = read.assets.flatMap((asset) =>
      asset.briefs
        .filter((brief) => brief.applicationSelection.state === "AVAILABLE")
        .map((brief) => ({ assetId: asset.id, briefId: brief.id })),
    );
    if (
      selectable.length &&
      selectable.every((pair) =>
        current.some(
          (row) =>
            row.status !== "EXPIRED" &&
            row.canonicalCampaignAssetId === pair.assetId &&
            row.canonicalBriefId === pair.briefId,
        ),
      )
    )
      return "APPLICATION_OPPORTUNITY_ALREADY_USED";
    return null;
  }

  async issue(campaignId: string, user: AuthUser | undefined, body: unknown) {
    const now = new Date();
    const input =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    let context: CampaignContinuationSeed = {
      schemaVersion: 1,
      entrySurface: "DIRECT_CAMPAIGN_LINK",
      entryAuthority: { kind: "DIRECT" },
    };
    const actor =
      user?.role === "CREATOR" ? await this.actors.resolve(user) : null;
    const read = await this.prisma.$transaction((tx) =>
      this.reads.resolveOpportunity(tx, campaignId),
    );
    const projection = await this.detail(campaignId, user);
    if (typeof input.invitationCredential === "string") {
      const id = await this.invitations.exchange(
        campaignId,
        input.invitationCredential,
        now,
      );
      if (!id)
        throw new NotFoundException({ code: "OPPORTUNITY_NOT_AVAILABLE" });
      if (!this.policy.canStartContinuation(read, projection, true))
        throw new NotFoundException({ code: "OPPORTUNITY_NOT_AVAILABLE" });
      context = {
        schemaVersion: 1,
        entrySurface: "BRAND_INVITATION",
        entryAuthority: { kind: "INVITATION", campaignInvitationId: id },
      };
      if (actor)
        await this.prisma.$transaction(async (tx) => {
          await lockCreatorTeam(tx, actor.workspaceId);
          const current = await this.actors.resolveInTransaction(
            tx,
            user!,
            actor.workspaceId,
          );
          const result = await this.invitations.validateAndBind(
            tx,
            current,
            campaignId,
            id,
            now,
          );
          if (result !== "VALID")
            throw new BadRequestException({ code: `INVITATION_${result}` });
        });
    } else {
      if (!this.policy.canStartContinuation(read, projection, false))
        throw new NotFoundException({ code: "OPPORTUNITY_NOT_AVAILABLE" });
      if (input.entrySurface === "CREATOR_OPPORTUNITIES" && actor)
        context.entrySurface = "CREATOR_OPPORTUNITIES";
      if (
        typeof input.shareToken === "string" &&
        input.shareToken.length <= 200
      ) {
        const share = await this.prisma.uceCampaignShare.findUnique({
          where: { trackingToken: input.shareToken },
          select: { id: true, campaignId: true },
        });
        if (share?.campaignId === campaignId)
          context = {
            schemaVersion: 1,
            entrySurface: "TRACKED_CAMPAIGN_SHARE",
            entryAuthority: { kind: "SHARE", campaignShareId: share.id },
          };
      }
    }
    const attribution = normalizeCampaignAttribution(input.attribution);
    if (typeof input.invitationCredential === "string") {
      for (const key of Object.keys(attribution)) {
        if (attribution[key].includes(input.invitationCredential))
          delete attribution[key];
      }
    }
    const firstQualifiedTouchId = await this.ingress.capture(
      campaignId,
      context,
      attribution,
      actor,
      now,
    );
    return this.continuations.issueResolvedCampaign(campaignId, now, {
      ...context,
      firstQualifiedTouchId,
    });
  }

  async collection(user: AuthUser, cursor?: string) {
    if (cursor && !/^[0-9a-f-]{36}$/.test(cursor))
      throw new BadRequestException({ code: "OPPORTUNITY_CURSOR_INVALID" });
    return this.prisma.$transaction(
      async (tx) => {
        const actor = await this.actors.resolveInTransaction(tx, user);
        const now = new Date();
        const candidates = await tx.uceCampaign.findMany({
          where: {
            ...(cursor ? { id: { gt: cursor } } : {}),
            OR: [
              {
                opportunityInvitations: {
                  some: {
                    boundCreatorProfileId: actor.subjectCreatorProfileId,
                    boundCreatorWorkspaceId: actor.workspaceId,
                    expiresAt: { gt: now },
                    revokedAt: null,
                  },
                },
              },
              {
                ingressTouches: {
                  some: {
                    boundCreatorProfileId: actor.subjectCreatorProfileId,
                    boundCreatorWorkspaceId: actor.workspaceId,
                    entryAuthorityKind: { in: ["DIRECT", "SHARE"] },
                  },
                },
              },
              { targeting: { visibilityScope: "ELIGIBLE_ONLY" } },
            ],
          },
          orderBy: { id: "asc" },
          select: { id: true },
        });
        const items = [];
        for (const candidate of candidates) {
          const projection = await this.project(
            tx,
            candidate.id,
            user,
            actor,
            now,
          );
          if (projection.state === "AUTHORIZED") items.push(projection);
          if (items.length === 21) break;
        }
        const hasMore = items.length > 20;
        const page = items.slice(0, 20);
        return {
          items: page,
          nextCursor: hasMore ? page[page.length - 1].campaign.id : null,
        };
      },
      { timeout: 30_000 },
    );
  }
}
