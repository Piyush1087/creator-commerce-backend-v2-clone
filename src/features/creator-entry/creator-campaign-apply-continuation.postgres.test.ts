import "reflect-metadata";

import {
  CreatorTeamRole,
  OAuthTokenStatus,
  OrganizationKind,
  PrismaClient,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SocialNetworkProvider,
  UceCampaignStatus,
  UceVisibilityScope,
  UserAuthState,
  UserRole,
  type User,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import type { RequestWithAuthUser } from "../auth/auth.controller";
import type { AuthUser } from "../auth/types/auth-user";
import { PublicMarketplaceController } from "../creator-marketplace/public-marketplace.controller";
import { CreatorAffinityService } from "../creator-marketplace/services/creator-affinity.service";
import { CampaignApplyContinuationIssuanceService } from "../creator-marketplace/services/campaign-apply-continuation-issuance.service";
import { CreatorEligibilityService } from "../creator-marketplace/services/creator-eligibility.service";
import { CreatorInvitationService } from "../creator-marketplace/services/creator-invitation.service";
import { CreatorMarketplaceService } from "../creator-marketplace/services/creator-marketplace.service";
import {
  CREATOR_CAMPAIGN_CONTINUATION_IDEMPOTENCY_GRACE_MS,
  CREATOR_CAMPAIGN_CONTINUATION_TTL_MS,
  CreatorCampaignApplyContinuationService,
} from "./creator-campaign-apply-continuation.service";
import {
  CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME,
  CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
} from "./creator-campaign-apply-continuation-cookie.util";
import { CreatorCanonicalContextService } from "./creator-canonical-context.service";
import { CreatorEntryController } from "./creator-entry.controller";
import {
  CreatorEntryContinuationStore,
  hashCreatorEntryContinuationToken,
} from "./creator-entry-continuation.store";
import { CreatorEntryStateService } from "./creator-entry-state.service";

const databaseUrl = process.env.C01_I5_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const database = databaseUrl ? describe : describe.skip;

database("C01-I5 Campaign Apply continuation", () => {
  const prisma = new PrismaClient({
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
  const db = prisma as unknown as PrismaService;
  const store = new CreatorEntryContinuationStore(db);
  const contexts = new CreatorCanonicalContextService(db);
  const entryState = new CreatorEntryStateService(db);
  const continuations = new CreatorCampaignApplyContinuationService(
    store,
    contexts,
    entryState,
  );
  const eligibility = new CreatorEligibilityService();
  const affinity = new CreatorAffinityService(eligibility);
  const invitations = new CreatorInvitationService(db);
  const marketplace = new CreatorMarketplaceService(
    db,
    eligibility,
    affinity,
    invitations,
  );
  const issuance = new CampaignApplyContinuationIssuanceService(
    marketplace,
    continuations,
  );
  const publicController = new PublicMarketplaceController(
    marketplace,
    invitations,
    issuance,
  );
  const entryController = new CreatorEntryController(
    null as never,
    entryState,
    null as never,
    null as never,
    continuations,
  );

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/^\/c01_i5_[a-z0-9_]+$/.test(url.pathname)
    ) {
      throw new Error("C01_I5_TEST_REQUIRES_DISPOSABLE_DATABASE");
    }
    await prisma.$connect();
  });

  beforeEach(async () => {
    // C-03 makes continuation evidence non-deletable in normal runtime DML.
    // This suite is restricted to a disposable c01_i5_* database, so TRUNCATE
    // resets test isolation without weakening or bypassing the production guard.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "creator_entry_continuations"',
    );
    await prisma.uceCollaborationAuditLog.deleteMany();
    await prisma.uceApplication.deleteMany();
    await prisma.uceCampaignCollaboration.deleteMany();
    await prisma.uceCampaignCreator.deleteMany();
    await prisma.uceCampaignPerformanceAggregate.deleteMany();
    await prisma.uceCampaign.deleteMany();
    await prisma.creatorSocialIntegration.deleteMany();
    await prisma.creatorWorkspaceMember.deleteMany();
    await prisma.creatorWorkspace.deleteMany();
    await prisma.creatorProfile.deleteMany();
    await prisma.brandProfile.deleteMany({
      where: { domain: { endsWith: ".i5.example.test" } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: "@i5.example.test" } },
    });
    await prisma.organization.deleteMany({
      where: { name: { startsWith: "I5 " } },
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.$disconnect();
  });

  function authUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  function responseDouble() {
    return {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as Response;
  }

  function cookieRequest(
    opaqueToken: string,
    authenticatedUser?: User,
  ): Request | RequestWithAuthUser {
    return {
      headers: {
        cookie: `${CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME}=${opaqueToken}`,
      },
      ...(authenticatedUser ? { user: authUser(authenticatedUser) } : {}),
    } as unknown as Request | RequestWithAuthUser;
  }

  async function brandAccount(label: string) {
    const suffix = randomUUID();
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: `I5 Brand ${label} ${suffix}`,
          kind: OrganizationKind.BRAND,
        },
      });
      const email = `${label}-${suffix}@i5.example.test`;
      const user = await tx.user.create({
        data: {
          email,
          normalizedEmail: email,
          name: `I5 Brand ${label}`,
          role: UserRole.BRAND,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
          organizationId: organization.id,
        },
      });
      const brand = await tx.brandProfile.create({
        data: {
          organizationId: organization.id,
          domain: `${label}-${suffix}.i5.example.test`,
          name: `I5 Brand ${label}`,
          industry: "D2C",
          brandValues: [],
          policyFlags: [],
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      return { organization, user, brand };
    });
  }

  async function campaign(
    label: string,
    options: {
      status?: UceCampaignStatus;
      visibility?: UceVisibilityScope[];
    } = {},
  ) {
    const owner = await brandAccount(label);
    const row = await prisma.uceCampaign.create({
      data: {
        brandProfileId: owner.brand.id,
        name: `I5 Campaign ${label}`,
        status: options.status ?? UceCampaignStatus.LIVE,
        targeting: {
          create: {
            industryVertical: "D2C",
            visibilityScopes: options.visibility ?? [
              UceVisibilityScope.EVERYONE,
            ],
          },
        },
        performanceAggregate: { create: {} },
      },
    });
    return { ...owner, campaign: row };
  }

  async function canonicalCreator(label: string) {
    const suffix = randomUUID();
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: `I5 Creator ${label} ${suffix}`,
          kind: OrganizationKind.CREATOR,
        },
      });
      const email = `${label}-${suffix}@i5.example.test`;
      const user = await tx.user.create({
        data: {
          email,
          normalizedEmail: email,
          name: `I5 Creator ${label}`,
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
          organizationId: organization.id,
        },
      });
      const profile = await tx.creatorProfile.create({
        data: { userId: user.id, displayName: user.name },
      });
      const workspace = await tx.creatorWorkspace.create({
        data: {
          ownerProfileId: profile.id,
          organizationId: organization.id,
          organizationDisplayName: user.name ?? "I5 Creator",
        },
      });
      await tx.creatorWorkspaceMember.create({
        data: {
          workspaceId: workspace.id,
          assignedProfileId: profile.id,
          associatedEmail: email,
          securityRole: CreatorTeamRole.OWNER,
          isActive: true,
          joinedAt: new Date(),
        },
      });
      return { organization, user, profile, workspace };
    });
  }

  async function malformedCreator(label: string) {
    const email = `${label}-${randomUUID()}@i5.example.test`;
    return prisma.user.create({
      data: {
        email,
        normalizedEmail: email,
        name: `I5 Malformed ${label}`,
        role: UserRole.CREATOR,
        authState: UserAuthState.PROVISIONAL,
      },
    });
  }

  async function connectInstagram(
    creatorProfileId: string,
    input: {
      health: ProviderAuthorizationHealth;
      basic: ProviderCapabilityState;
      insights?: ProviderCapabilityState;
      disconnected?: boolean;
    },
  ) {
    return prisma.creatorSocialIntegration.create({
      data: {
        creatorProfileId,
        platformNetwork: SocialNetworkProvider.INSTAGRAM,
        nativePlatformUserId: `i5-provider-${randomUUID()}`,
        channelHandleString: `i5_${randomUUID()}`,
        oauthAccessTokenEncrypted: "i5-encrypted-fixture-not-used",
        tokenStateCondition: input.disconnected
          ? OAuthTokenStatus.REVOKED
          : OAuthTokenStatus.ACTIVE,
        authorizationGeneration: 2,
        credentialVersion: 3,
        authorizationHealth: input.health,
        basicAuthorizationCapability: input.basic,
        insightsCapability: input.insights ?? ProviderCapabilityState.UNKNOWN,
        disconnectedAt: input.disconnected ? new Date() : null,
      },
    });
  }

  async function campaignMutationSnapshot(campaignId: string) {
    const [
      campaignRow,
      collaborations,
      applications,
      campaignCreators,
      creatorAppliedEvents,
      aggregate,
    ] = await Promise.all([
      prisma.uceCampaign.findUniqueOrThrow({ where: { id: campaignId } }),
      prisma.uceCampaignCollaboration.count({ where: { campaignId } }),
      prisma.uceApplication.count({ where: { campaignId } }),
      prisma.uceCampaignCreator.count({ where: { campaignId } }),
      prisma.uceCollaborationAuditLog.count({
        where: {
          collaboration: { campaignId },
          systemEventTag: "CREATOR_APPLIED",
        },
      }),
      prisma.uceCampaignPerformanceAggregate.findUnique({
        where: { campaignId },
        select: {
          totalProspectsCount: true,
          totalApplicantsCount: true,
          totalActiveCollabsCount: true,
          updatedAt: true,
        },
      }),
    ]);
    return {
      campaignUpdatedAt: campaignRow.updatedAt.getTime(),
      collaborations,
      applications,
      campaignCreators,
      creatorAppliedEvents,
      aggregate: aggregate
        ? {
            ...aggregate,
            updatedAt: aggregate.updatedAt.getTime(),
          }
        : null,
    };
  }

  describe("public Campaign-owned issuance", () => {
    it("issues a digest-only, unbound 24-hour continuation from public detail authority", async () => {
      const origin = await campaign("public-issue");
      const before = await campaignMutationSnapshot(origin.campaign.id);
      const now = new Date();
      const detail = await marketplace.getPublicMarketplaceCampaignDetail(
        origin.campaign.id,
      );
      const list = await marketplace.listPublicMarketplaceCampaigns({});
      expect(detail).toMatchObject({
        access_tier: "GUEST",
        ui_access_state: "teaser",
        brief_sections: null,
        campaign: { campaign_id: origin.campaign.id },
      });
      expect(list.campaigns).toEqual([
        expect.objectContaining({ campaign_id: origin.campaign.id }),
      ]);

      const issued = await issuance.issue(origin.campaign.id, now);
      expect(issued).toMatchObject({
        intent: "CAMPAIGN_APPLY",
        expiresAt: new Date(
          now.getTime() + CREATOR_CAMPAIGN_CONTINUATION_TTL_MS,
        ),
      });
      expect(issued.continuationToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(issued).not.toHaveProperty("continuationId");
      expect(issued).not.toHaveProperty("returnUrl");

      const row = await prisma.creatorEntryContinuation.findUniqueOrThrow({
        where: {
          tokenDigest: hashCreatorEntryContinuationToken(
            issued.continuationToken,
          ),
        },
      });
      expect(row).toMatchObject({
        intent: "CAMPAIGN_APPLY",
        campaignId: origin.campaign.id,
        boundUserId: null,
        consumedAt: null,
        expiresAt: issued.expiresAt,
      });
      expect(JSON.stringify(row)).not.toContain(issued.continuationToken);
      expect(JSON.stringify(row)).not.toMatch(
        /returnUrl|frontendPath|origin|briefId|productId|matchScore/,
      );
      expect(await campaignMutationSnapshot(origin.campaign.id)).toEqual(
        before,
      );
    });

    it("creates no continuation for an unknown Campaign", async () => {
      await expect(issuance.issue(randomUUID())).rejects.toMatchObject({
        status: 404,
      });
      expect(await prisma.creatorEntryContinuation.count()).toBe(0);
    });

    it.each([
      {
        label: "draft",
        status: UceCampaignStatus.DRAFT,
        visibility: [UceVisibilityScope.EVERYONE],
      },
      {
        label: "invited-only",
        status: UceCampaignStatus.LIVE,
        visibility: [UceVisibilityScope.INVITED_ONLY],
      },
    ])(
      "rejects $label Campaigns without broadening public visibility",
      async (input) => {
        const origin = await campaign(input.label, input);
        const before = await campaignMutationSnapshot(origin.campaign.id);
        await expect(issuance.issue(origin.campaign.id)).rejects.toMatchObject({
          status: 404,
        });
        expect(await prisma.creatorEntryContinuation.count()).toBe(0);
        expect(await campaignMutationSnapshot(origin.campaign.id)).toEqual(
          before,
        );
      },
    );
  });

  describe("authenticated binding", () => {
    it("binds only after canonical Creator authentication and leaves the handoff pending", async () => {
      const origin = await campaign("bind-canonical");
      const creator = await canonicalCreator("bind-canonical");
      const issued = await issuance.issue(origin.campaign.id);
      const before = await campaignMutationSnapshot(origin.campaign.id);

      await expect(
        continuations.resolve(authUser(creator.user), issued.continuationToken),
      ).resolves.toMatchObject({
        status: "PENDING_CREATOR_ENTRY",
        intent: "CAMPAIGN_APPLY",
        nextAction: "CONNECT_INSTAGRAM",
      });
      expect(
        await prisma.creatorEntryContinuation.findUniqueOrThrow({
          where: {
            tokenDigest: hashCreatorEntryContinuationToken(
              issued.continuationToken,
            ),
          },
        }),
      ).toMatchObject({
        boundUserId: creator.user.id,
        consumedAt: null,
      });
      expect(await campaignMutationSnapshot(origin.campaign.id)).toEqual(
        before,
      );
    });

    it("rejects an active Brand account and leaves the token unbound", async () => {
      const origin = await campaign("brand-conflict");
      const brand = await brandAccount("resolver-brand");
      const issued = await issuance.issue(origin.campaign.id);

      await expect(
        continuations.resolve(authUser(brand.user), issued.continuationToken),
      ).rejects.toMatchObject({
        response: { code: "ACCOUNT_CONTEXT_CONFLICT" },
      });
      expect(
        await prisma.creatorEntryContinuation.findUniqueOrThrow({
          where: {
            tokenDigest: hashCreatorEntryContinuationToken(
              issued.continuationToken,
            ),
          },
        }),
      ).toMatchObject({ boundUserId: null, consumedAt: null });
    });

    it("rejects malformed/provisional Creator context without binding", async () => {
      const origin = await campaign("malformed-context");
      const malformed = await malformedCreator("malformed-context");
      const issued = await issuance.issue(origin.campaign.id);

      await expect(
        continuations.resolve(authUser(malformed), issued.continuationToken),
      ).rejects.toMatchObject({
        response: { code: "CONTEXT_RECOVERY_REQUIRED" },
      });
      expect(
        await prisma.creatorEntryContinuation.findUniqueOrThrow({
          where: {
            tokenDigest: hashCreatorEntryContinuationToken(
              issued.continuationToken,
            ),
          },
        }),
      ).toMatchObject({ boundUserId: null, consumedAt: null });
    });

    it("keeps an established binding private and non-transferable", async () => {
      const origin = await campaign("binding-owner");
      const first = await canonicalCreator("binding-first");
      const second = await canonicalCreator("binding-second");
      const issued = await issuance.issue(origin.campaign.id);
      await continuations.resolve(
        authUser(first.user),
        issued.continuationToken,
      );

      await expect(
        continuations.resolve(authUser(second.user), issued.continuationToken),
      ).rejects.toMatchObject({
        response: {
          code: "CREATOR_ENTRY_CONTINUATION_IDENTITY_CONFLICT",
        },
      });
      expect(
        await prisma.creatorEntryContinuation.findUniqueOrThrow({
          where: {
            tokenDigest: hashCreatorEntryContinuationToken(
              issued.continuationToken,
            ),
          },
        }),
      ).toMatchObject({ boundUserId: first.user.id, consumedAt: null });
    });

    it("allows exactly one of two different concurrent first binders", async () => {
      const origin = await campaign("binding-race");
      const first = await canonicalCreator("race-first");
      const second = await canonicalCreator("race-second");
      const issued = await issuance.issue(origin.campaign.id);
      const before = await campaignMutationSnapshot(origin.campaign.id);

      const results = await Promise.allSettled([
        continuations.resolve(authUser(first.user), issued.continuationToken),
        continuations.resolve(authUser(second.user), issued.continuationToken),
      ]);
      const fulfilled = results.filter(
        (result) => result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toMatchObject({
        response: {
          code: "CREATOR_ENTRY_CONTINUATION_IDENTITY_CONFLICT",
        },
      });
      const row = await prisma.creatorEntryContinuation.findUniqueOrThrow({
        where: {
          tokenDigest: hashCreatorEntryContinuationToken(
            issued.continuationToken,
          ),
        },
      });
      expect([first.user.id, second.user.id]).toContain(row.boundUserId);
      expect(row.consumedAt).toBeNull();
      expect(await campaignMutationSnapshot(origin.campaign.id)).toEqual(
        before,
      );
    });

    it("rejects expired and malformed tokens before any binding", async () => {
      const origin = await campaign("expired-token");
      const creator = await canonicalCreator("expired-token");
      const expiredToken = "E".repeat(43);
      await prisma.creatorEntryContinuation.create({
        data: {
          tokenDigest: hashCreatorEntryContinuationToken(expiredToken),
          campaignId: origin.campaign.id,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });
      await expect(
        continuations.resolve(authUser(creator.user), expiredToken),
      ).rejects.toMatchObject({
        response: { code: "CREATOR_ENTRY_CONTINUATION_EXPIRED" },
      });
      expect(
        await prisma.creatorEntryContinuation.findUniqueOrThrow({
          where: {
            tokenDigest: hashCreatorEntryContinuationToken(expiredToken),
          },
        }),
      ).toMatchObject({ boundUserId: null, consumedAt: null });

      const update = vi.fn();
      const lookup = vi.fn();
      const isolatedStore = new CreatorEntryContinuationStore({
        creatorEntryContinuation: { updateMany: update, findUnique: lookup },
      } as unknown as PrismaService);
      await expect(
        isolatedStore.bindForAuthenticatedUser({
          opaqueToken: "not-a-valid-token",
          userId: creator.user.id,
          now: new Date(),
        }),
      ).resolves.toEqual({ outcome: "NOT_FOUND" });
      expect(update).not.toHaveBeenCalled();
      expect(lookup).not.toHaveBeenCalled();
      await expect(
        continuations.resolve(authUser(creator.user), "not-a-valid-token"),
      ).rejects.toMatchObject({
        response: { code: "CREATOR_ENTRY_CONTINUATION_NOT_FOUND" },
      });
    });
  });

  describe("pending Creator Entry state", () => {
    it.each([
      {
        label: "not-connected",
        integration: null,
        nextAction: "CONNECT_INSTAGRAM",
      },
      {
        label: "reauthorization",
        integration: {
          health: ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
          basic: ProviderCapabilityState.UNAVAILABLE,
        },
        nextAction: "RECONNECT_INSTAGRAM",
      },
      {
        label: "unknown",
        integration: {
          health: ProviderAuthorizationHealth.UNKNOWN,
          basic: ProviderCapabilityState.AVAILABLE,
        },
        nextAction: "REVALIDATE_INSTAGRAM",
      },
      {
        label: "disconnected",
        integration: {
          health: ProviderAuthorizationHealth.DISCONNECTED,
          basic: ProviderCapabilityState.UNAVAILABLE,
          disconnected: true,
        },
        nextAction: "RECONNECT_INSTAGRAM",
      },
    ])("keeps $label continuation bound and unconsumed", async (input) => {
      const origin = await campaign(`pending-${input.label}`);
      const creator = await canonicalCreator(`pending-${input.label}`);
      if (input.integration) {
        await connectInstagram(creator.profile.id, input.integration);
      }
      const issued = await issuance.issue(origin.campaign.id);
      const before = await campaignMutationSnapshot(origin.campaign.id);

      await expect(
        continuations.resolve(authUser(creator.user), issued.continuationToken),
      ).resolves.toMatchObject({
        status: "PENDING_CREATOR_ENTRY",
        intent: "CAMPAIGN_APPLY",
        nextAction: input.nextAction,
      });
      expect(
        await prisma.creatorEntryContinuation.findUniqueOrThrow({
          where: {
            tokenDigest: hashCreatorEntryContinuationToken(
              issued.continuationToken,
            ),
          },
        }),
      ).toMatchObject({
        boundUserId: creator.user.id,
        consumedAt: null,
      });
      expect(await campaignMutationSnapshot(origin.campaign.id)).toEqual(
        before,
      );
    });
  });

  describe("completion and return-to-origin handoff", () => {
    it.each([
      ProviderCapabilityState.UNAVAILABLE,
      ProviderCapabilityState.UNKNOWN,
    ])("consumes with usable Basic and Insights %s", async (insights) => {
      const origin = await campaign(`complete-${insights}`);
      const creator = await canonicalCreator(`complete-${insights}`);
      await connectInstagram(creator.profile.id, {
        health: ProviderAuthorizationHealth.USABLE,
        basic: ProviderCapabilityState.AVAILABLE,
        insights,
      });
      expect(await entryState.read(authUser(creator.user))).toMatchObject({
        canEnterCreatorPlatform: true,
        nextAction: "CREATOR_WORKSPACE_ENTRY",
      });
      const issued = await issuance.issue(origin.campaign.id);
      const before = await campaignMutationSnapshot(origin.campaign.id);

      await expect(
        continuations.resolve(authUser(creator.user), issued.continuationToken),
      ).resolves.toMatchObject({
        status: "READY_TO_RETURN",
        intent: "CAMPAIGN_APPLY",
        nextAction: "RETURN_TO_ORIGINATING_CAMPAIGN",
        campaign: { campaignId: origin.campaign.id },
      });
      expect(
        await prisma.creatorEntryContinuation.findUniqueOrThrow({
          where: {
            tokenDigest: hashCreatorEntryContinuationToken(
              issued.continuationToken,
            ),
          },
        }),
      ).toMatchObject({
        boundUserId: creator.user.id,
        consumedAt: expect.any(Date),
      });
      expect(await campaignMutationSnapshot(origin.campaign.id)).toEqual(
        before,
      );
    });

    it("returns the immutable Campaign relation even after Campaign authority closes it", async () => {
      const origin = await campaign("status-change");
      const creator = await canonicalCreator("status-change");
      const issued = await issuance.issue(origin.campaign.id);
      await continuations.resolve(
        authUser(creator.user),
        issued.continuationToken,
      );
      await prisma.uceCampaign.update({
        where: { id: origin.campaign.id },
        data: { status: UceCampaignStatus.ARCHIVED },
      });
      await connectInstagram(creator.profile.id, {
        health: ProviderAuthorizationHealth.USABLE,
        basic: ProviderCapabilityState.AVAILABLE,
        insights: ProviderCapabilityState.UNKNOWN,
      });
      const before = await campaignMutationSnapshot(origin.campaign.id);

      await expect(
        continuations.resolve(authUser(creator.user), issued.continuationToken),
      ).resolves.toMatchObject({
        status: "READY_TO_RETURN",
        nextAction: "RETURN_TO_ORIGINATING_CAMPAIGN",
        campaign: { campaignId: origin.campaign.id },
      });
      expect(await campaignMutationSnapshot(origin.campaign.id)).toEqual(
        before,
      );
    });

    it("has one consumption transition with same-User idempotency and different-User denial", async () => {
      const origin = await campaign("consume-race");
      const creator = await canonicalCreator("consume-race");
      const other = await canonicalCreator("consume-other");
      const issued = await issuance.issue(origin.campaign.id);
      await continuations.resolve(
        authUser(creator.user),
        issued.continuationToken,
      );
      await connectInstagram(creator.profile.id, {
        health: ProviderAuthorizationHealth.USABLE,
        basic: ProviderCapabilityState.AVAILABLE,
        insights: ProviderCapabilityState.UNAVAILABLE,
      });
      const before = await campaignMutationSnapshot(origin.campaign.id);

      const finalResults = await Promise.all([
        continuations.resolve(authUser(creator.user), issued.continuationToken),
        continuations.resolve(authUser(creator.user), issued.continuationToken),
      ]);
      expect(finalResults).toMatchObject([
        {
          status: "READY_TO_RETURN",
          intent: "CAMPAIGN_APPLY",
          nextAction: "RETURN_TO_ORIGINATING_CAMPAIGN",
          campaign: { campaignId: origin.campaign.id },
        },
        {
          status: "READY_TO_RETURN",
          intent: "CAMPAIGN_APPLY",
          nextAction: "RETURN_TO_ORIGINATING_CAMPAIGN",
          campaign: { campaignId: origin.campaign.id },
        },
      ]);
      const consumed = await prisma.creatorEntryContinuation.findUniqueOrThrow({
        where: {
          tokenDigest: hashCreatorEntryContinuationToken(
            issued.continuationToken,
          ),
        },
      });
      expect(consumed.consumedAt).toEqual(expect.any(Date));

      await expect(
        continuations.resolve(authUser(creator.user), issued.continuationToken),
      ).resolves.toMatchObject({
        status: "READY_TO_RETURN",
        campaign: { campaignId: origin.campaign.id },
      });
      expect(
        (
          await prisma.creatorEntryContinuation.findUniqueOrThrow({
            where: { id: consumed.id },
          })
        ).consumedAt,
      ).toEqual(consumed.consumedAt);

      await expect(
        continuations.resolve(authUser(other.user), issued.continuationToken),
      ).rejects.toMatchObject({
        response: {
          code: "CREATOR_ENTRY_CONTINUATION_IDENTITY_CONFLICT",
        },
      });
      const graceEnd = new Date(
        consumed.consumedAt!.getTime() +
          CREATOR_CAMPAIGN_CONTINUATION_IDEMPOTENCY_GRACE_MS,
      );
      await expect(
        continuations.isPresent(
          issued.continuationToken,
          new Date(graceEnd.getTime() - 1),
        ),
      ).resolves.toBe(true);
      await expect(
        continuations.isPresent(issued.continuationToken, graceEnd),
      ).resolves.toBe(false);
      await expect(
        continuations.resolve(
          authUser(creator.user),
          issued.continuationToken,
          graceEnd,
        ),
      ).rejects.toMatchObject({
        response: { code: "CREATOR_ENTRY_CONTINUATION_NOT_FOUND" },
      });
      expect(await campaignMutationSnapshot(origin.campaign.id)).toEqual(
        before,
      );
    });
  });

  describe("HttpOnly abandonment durability", () => {
    it("recovers the same continuation in a fresh client context after browser close", async () => {
      const origin = await campaign("browser-close");
      const creator = await canonicalCreator("browser-close");
      const before = await campaignMutationSnapshot(origin.campaign.id);
      const firstClientResponse = responseDouble();

      const issuanceBody = await publicController.issueApplyContinuation(
        origin.campaign.id,
        firstClientResponse,
      );
      expect(issuanceBody).toMatchObject({
        intent: "CAMPAIGN_APPLY",
        continuationPresent: true,
      });
      expect(issuanceBody).not.toHaveProperty("continuationToken");
      const setCookieCall = vi.mocked(firstClientResponse.cookie).mock.calls[0];
      expect(setCookieCall[0]).toBe(CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME);
      const opaqueToken = setCookieCall[1];
      expect(opaqueToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(setCookieCall[2]).toMatchObject({
        httpOnly: true,
        sameSite: "lax",
        path: CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
      });

      const persisted = await prisma.creatorEntryContinuation.findUniqueOrThrow(
        {
          where: {
            tokenDigest: hashCreatorEntryContinuationToken(opaqueToken),
          },
        },
      );
      expect(persisted.tokenDigest).not.toBe(opaqueToken);
      expect(JSON.stringify(persisted)).not.toContain(opaqueToken);

      const reopenedClientRequest = cookieRequest(opaqueToken);
      await expect(
        entryController.campaignApplyContinuationStatus(
          reopenedClientRequest as Request,
          responseDouble(),
        ),
      ).resolves.toEqual({ present: true });
      await expect(
        entryController.resolveCampaignApplyContinuation(
          cookieRequest(opaqueToken, creator.user) as RequestWithAuthUser,
          responseDouble(),
        ),
      ).resolves.toMatchObject({
        status: "PENDING_CREATOR_ENTRY",
        nextAction: "CONNECT_INSTAGRAM",
      });
      await connectInstagram(creator.profile.id, {
        health: ProviderAuthorizationHealth.USABLE,
        basic: ProviderCapabilityState.AVAILABLE,
        insights: ProviderCapabilityState.UNKNOWN,
      });
      const readyResponse = responseDouble();
      await expect(
        entryController.resolveCampaignApplyContinuation(
          cookieRequest(opaqueToken, creator.user) as RequestWithAuthUser,
          readyResponse,
        ),
      ).resolves.toEqual({
        status: "READY_TO_RETURN",
        intent: "CAMPAIGN_APPLY",
        nextAction: "RETURN_TO_ORIGINATING_CAMPAIGN",
        campaign: { campaignId: origin.campaign.id },
      });
      expect(vi.mocked(readyResponse.cookie).mock.calls[0][2]).toMatchObject({
        httpOnly: true,
        path: CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
        maxAge: expect.any(Number),
      });
      expect(await campaignMutationSnapshot(origin.campaign.id)).toEqual(
        before,
      );
    });

    it("clears discard and invalid status transport without touching persistence", async () => {
      const origin = await campaign("discard-transport");
      const before = await campaignMutationSnapshot(origin.campaign.id);
      const issued = await issuance.issue(origin.campaign.id);
      const persistedBefore =
        await prisma.creatorEntryContinuation.findUniqueOrThrow({
          where: {
            tokenDigest: hashCreatorEntryContinuationToken(
              issued.continuationToken,
            ),
          },
        });
      const discardResponse = responseDouble();
      expect(
        entryController.discardCampaignApplyContinuation(discardResponse),
      ).toEqual({ present: false });
      expect(discardResponse.clearCookie).toHaveBeenCalledWith(
        CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME,
        expect.objectContaining({
          path: CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
        }),
      );
      expect(
        await prisma.creatorEntryContinuation.findUniqueOrThrow({
          where: { id: persistedBefore.id },
        }),
      ).toEqual(persistedBefore);

      for (const invalidToken of ["malformed", "U".repeat(43)]) {
        const statusResponse = responseDouble();
        await expect(
          entryController.campaignApplyContinuationStatus(
            cookieRequest(invalidToken) as Request,
            statusResponse,
          ),
        ).resolves.toEqual({ present: false });
        expect(statusResponse.clearCookie).toHaveBeenCalledTimes(1);
      }
      expect(await prisma.creatorEntryContinuation.count()).toBe(1);
      expect(await campaignMutationSnapshot(origin.campaign.id)).toEqual(
        before,
      );
    });

    it("clears expired status and resolve transport without recovering the row", async () => {
      const origin = await campaign("expired-cookie");
      const creator = await canonicalCreator("expired-cookie");
      const expiredToken = "X".repeat(43);
      const expired = await prisma.creatorEntryContinuation.create({
        data: {
          tokenDigest: hashCreatorEntryContinuationToken(expiredToken),
          campaignId: origin.campaign.id,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });
      const statusResponse = responseDouble();
      await expect(
        entryController.campaignApplyContinuationStatus(
          cookieRequest(expiredToken) as Request,
          statusResponse,
        ),
      ).resolves.toEqual({ present: false });
      expect(statusResponse.clearCookie).toHaveBeenCalledTimes(1);

      const resolveResponse = responseDouble();
      await expect(
        entryController.resolveCampaignApplyContinuation(
          cookieRequest(expiredToken, creator.user) as RequestWithAuthUser,
          resolveResponse,
        ),
      ).rejects.toMatchObject({
        response: { code: "CREATOR_ENTRY_CONTINUATION_EXPIRED" },
      });
      expect(resolveResponse.clearCookie).toHaveBeenCalledTimes(1);
      expect(
        await prisma.creatorEntryContinuation.findUniqueOrThrow({
          where: { id: expired.id },
        }),
      ).toMatchObject({ boundUserId: null, consumedAt: null });
    });
  });
});
