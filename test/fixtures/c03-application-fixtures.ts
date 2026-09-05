import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { PrismaClient, type CreatorTeamRole } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { CreatorWorkspaceActorService } from "../../src/features/creator-settings/team/creator-workspace-actor.service";
import { BrandCentreAuthService } from "../../src/features/brand-centre/brand-centre-auth.service";
import { CampaignInvitationService } from "../../src/features/campaign-opportunities/campaign-invitation.service";
import { CampaignOpportunityPolicyService } from "../../src/features/campaign-opportunities/campaign-opportunity-policy.service";
import { CanonicalCampaignOpportunityEligibility } from "../../src/features/campaign-opportunities/campaign-opportunity-eligibility";
import { CanonicalCampaignApplicationReadService } from "../../src/features/brand-uce/services/canonical-campaign-application-read.service";
import { ApplicationSubmitContextService } from "../../src/features/campaign-applications/application-submit-context.service";
import { ApplicationSubmitService } from "../../src/features/campaign-applications/application-submit.service";
import { ApplicationTerminalService } from "../../src/features/campaign-applications/application-terminal.service";
import { ApplicationHistoryService } from "../../src/features/campaign-applications/application-history.service";

export function applicationHarness(prisma: PrismaClient) {
  const db = prisma as unknown as PrismaService;
  const actors = new CreatorWorkspaceActorService(db);
  const invitations = new CampaignInvitationService(
    db,
    new ConfigService({
      C03_INVITATION_IDENTITY_HMAC_PEPPER:
        "c03-p13-fixture-only-invitation-hmac-pepper",
    }),
  );
  const contexts = new ApplicationSubmitContextService(
    new CanonicalCampaignApplicationReadService(db),
    new CampaignOpportunityPolicyService(),
    new CanonicalCampaignOpportunityEligibility(),
    invitations,
  );
  const brands = new BrandCentreAuthService(db, {} as never);
  return {
    actors,
    contexts,
    invitations,
    brands,
    submit: new ApplicationSubmitService(db, actors, contexts),
    terminal: new ApplicationTerminalService(db, actors, brands),
    history: new ApplicationHistoryService(db, actors),
  };
}

export async function creatorFixture(prisma: PrismaClient) {
  const org = await prisma.organization.create({
    data: { name: "P1.3 Creator fixture", kind: "CREATOR" },
  });
  const email = `${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      normalizedEmail: email,
      role: "CREATOR",
      authState: "ACTIVE",
      organizationId: org.id,
      emailVerifiedAt: new Date(),
    },
  });
  const profile = await prisma.creatorProfile.create({
    data: {
      userId: user.id,
      displayName: "Historical Creator",
      followerCount: 12000,
    },
  });
  const workspace = await prisma.creatorWorkspace.create({
    data: { ownerProfileId: profile.id, organizationId: org.id },
  });
  const member = await prisma.creatorWorkspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      assignedProfileId: profile.id,
      associatedEmail: email,
      securityRole: "OWNER",
      isActive: true,
      joinedAt: new Date(),
    },
  });
  const integration = await prisma.creatorSocialIntegration.create({
    data: {
      creatorProfileId: profile.id,
      platformNetwork: "INSTAGRAM",
      nativePlatformUserId: randomUUID(),
      channelHandleString: "fixture",
      oauthAccessTokenEncrypted: "p13-unused-provider-fixture",
      tokenStateCondition: "ACTIVE",
      tokenExpiresAt: new Date(Date.now() + 86400000),
      authorizationHealth: "USABLE",
      basicAuthorizationCapability: "AVAILABLE",
    },
  });
  return { user, profile, workspace, member, integration };
}

export async function teamFixture(
  prisma: PrismaClient,
  owner: Awaited<ReturnType<typeof creatorFixture>>,
  role: CreatorTeamRole,
) {
  const email = `${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      normalizedEmail: email,
      role: "CREATOR",
      authState: "ACTIVE",
      organizationId: owner.user.organizationId,
    },
  });
  const member = await prisma.creatorWorkspaceMember.create({
    data: {
      workspaceId: owner.workspace.id,
      userId: user.id,
      associatedEmail: email,
      securityRole: role,
      isActive: true,
      joinedAt: new Date(),
    },
  });
  return { user, member };
}

export async function brandFixture(prisma: PrismaClient) {
  const org = await prisma.organization.create({
    data: { name: "P1.3 Brand fixture", kind: "BRAND" },
  });
  const email = `${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      normalizedEmail: email,
      role: "BRAND",
      authState: "ACTIVE",
      organizationId: org.id,
    },
  });
  const brand = await prisma.brandProfile.create({
    data: {
      domain: `${randomUUID()}.example.test`,
      name: "Historical Brand",
      industry: "D2C",
      organizationId: org.id,
      brandValues: [],
      policyFlags: [],
    },
  });
  await prisma.brandTeamMember.create({
    data: {
      brandProfileId: brand.id,
      userId: user.id,
      role: "BRAND_OWNER",
      isActive: true,
    },
  });
  return { user, brand };
}

export async function campaignFixture(
  prisma: PrismaClient,
  brandProfileId: string,
  briefCount = 3,
) {
  const campaign = await prisma.uceCampaign.create({
    data: {
      brandProfileId,
      name: "Historical Campaign",
      status: "LIVE",
      canonicalDefinition: {
        version: "1.2",
        creationSource: "MANUAL",
        strategy: { platforms: ["INSTAGRAM"], campaign_visibility: "PUBLIC" },
        targeting: {},
        commercials: {
          compensation_model: "FIXED",
          commercial_offer: 100,
          total_campaign_budget: 1000,
          receives_brand_support: false,
        },
        derived: { currency: "INR" },
      },
      targeting: {
        create: {
          industryVertical: "D2C",
          visibilityScope: "EVERYONE",
          visibilityScopes: ["EVERYONE"],
        },
      },
      commercials: {
        create: {
          canonicalVersion: 1,
          compensationType: "FIXED_FEE",
          commercialOffer: 100,
          totalCampaignBudgetPool: 1000,
          currency: "INR",
          receivesBrandSupport: false,
        },
      },
    },
  });
  const asset = await prisma.uceCampaignAsset.create({
    data: {
      campaignId: campaign.id,
      kind: "BRAND",
      brandProfileId,
      status: "ACTIVE",
    },
  });
  const briefs = [];
  for (let i = 0; i < briefCount; i++)
    briefs.push(
      await prisma.canonicalCampaignBrief.create({
        data: {
          campaignAssetId: asset.id,
          status: "PUBLISHED",
          briefName: `Historical Brief ${i}`,
          creativeIntent: "A credible everyday routine",
          creatorBrief: "Show a clear demonstration in natural daylight",
          briefType: "CREATOR_LED",
          platform: "INSTAGRAM",
          deliverables: {
            create: [
              { format: "REEL_VIDEO", displayOrder: 0 },
              { format: "REEL_VIDEO", displayOrder: 1 },
            ],
          },
        },
      }),
    );
  return {
    campaign,
    asset,
    briefs,
    selection: (i = 0) => ({
      campaignAssetId: asset.id,
      briefId: briefs[i].id,
    }),
  };
}

export async function boundInvitationFixture(
  prisma: PrismaClient,
  owner: Awaited<ReturnType<typeof creatorFixture>>,
  campaignId: string,
) {
  return prisma.campaignOpportunityInvitation.create({
    data: {
      campaignId,
      issuedByActorUserId: owner.user.id,
      tokenDigest: createHash("sha256").update(randomUUID()).digest("hex"),
      intendedCreatorProfileId: owner.profile.id,
      boundCreatorProfileId: owner.profile.id,
      boundCreatorWorkspaceId: owner.workspace.id,
      bindingVersion: 1,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
}
