import "reflect-metadata";

import {
  BrandRole,
  InstagramOAuthIntent,
  OrganizationKind,
  PrismaClient,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  ProviderOAuthProvider,
  SocialNetworkProvider,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import { BrandInstagramOAuthStateService } from "../brand-settings/services/brand-instagram-oauth-state.service";
import {
  CreatorEntryContinuationStore,
  hashCreatorEntryContinuationToken,
} from "../creator-entry/creator-entry-continuation.store";
import { CreatorInstagramOAuthTransactionService } from "../provider-oauth/creator-instagram-oauth-transaction.service";
import {
  hashProviderOAuthState,
  ProviderOAuthTransactionService,
} from "../provider-oauth/provider-oauth-transaction.service";

const databaseUrl = process.env.C01_I1_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const database = databaseUrl ? describe : describe.skip;

database("C01-I1 persistence and shared security foundation", () => {
  const prisma = new PrismaClient();
  const db = prisma as unknown as PrismaService;
  const transactions = new ProviderOAuthTransactionService(db);
  const brandTransactions = new BrandInstagramOAuthStateService(transactions);
  const creatorTransactions = new CreatorInstagramOAuthTransactionService(
    transactions,
  );
  const continuations = new CreatorEntryContinuationStore(db);

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      url.hostname !== "127.0.0.1" ||
      !/^\/c01_i1_[a-z0-9_]+$/.test(url.pathname)
    ) {
      throw new Error("C01_I1_TEST_REQUIRES_DISPOSABLE_DATABASE");
    }
    await prisma.$connect();
  });

  afterAll(async () => prisma.$disconnect());

  async function brandContext(label: string) {
    const suffix = `${label}-${randomUUID()}`;
    const organization = await prisma.organization.create({
      data: { name: suffix, kind: OrganizationKind.BRAND },
    });
    const user = await prisma.user.create({
      data: {
        email: `${suffix}@brand.example`,
        role: UserRole.BRAND,
        authState: UserAuthState.ACTIVE,
        emailVerifiedAt: new Date(),
        organizationId: organization.id,
      },
    });
    const brand = await prisma.brandProfile.create({
      data: {
        organizationId: organization.id,
        domain: `${suffix}.example`,
        name: suffix,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    return { organization, user, brand };
  }

  async function creatorContext(label: string) {
    const suffix = `${label}-${randomUUID()}`;
    const organization = await prisma.organization.create({
      data: { name: suffix, kind: OrganizationKind.CREATOR },
    });
    const user = await prisma.user.create({
      data: {
        email: `${suffix}@creator.example`,
        role: UserRole.CREATOR,
        authState: UserAuthState.ACTIVE,
        emailVerifiedAt: new Date(),
        organizationId: organization.id,
      },
    });
    const profile = await prisma.creatorProfile.create({
      data: { userId: user.id, displayName: suffix },
    });
    const workspace = await prisma.creatorWorkspace.create({
      data: {
        ownerProfileId: profile.id,
        organizationId: organization.id,
        organizationDisplayName: suffix,
        members: {
          create: {
            assignedProfileId: profile.id,
            associatedEmail: user.email,
            securityRole: "OWNER",
            isActive: true,
            joinedAt: new Date(),
          },
        },
      },
    });
    return { organization, user, profile, workspace };
  }

  describe("Organization and Creator owner invariants", () => {
    it("rejects cross-kind Brand and Creator bindings", async () => {
      const creatorOrganization = await prisma.organization.create({
        data: { name: randomUUID(), kind: OrganizationKind.CREATOR },
      });
      await expect(
        prisma.brandProfile.create({
          data: {
            organizationId: creatorOrganization.id,
            domain: `${randomUUID()}.example`,
            name: "wrong-kind",
            industry: "D2C",
            brandValues: [],
            policyFlags: [],
          },
        }),
      ).rejects.toThrow(/C01_BRAND_REQUIRES_BRAND_ORGANIZATION/);

      const creator = await creatorContext("wrong-workspace-kind");
      const brandOrganization = await prisma.organization.create({
        data: { name: randomUUID(), kind: OrganizationKind.BRAND },
      });
      await expect(
        prisma.creatorWorkspace.create({
          data: {
            ownerProfileId: creator.profile.id,
            organizationId: brandOrganization.id,
          },
        }),
      ).rejects.toThrow(/C01_CREATOR_WORKSPACE_REQUIRES_CREATOR_ORGANIZATION/);
    });

    it("blocks owner, User organization, CreatorProfile User and kind drift", async () => {
      const first = await creatorContext("invariant-first");
      const second = await creatorContext("invariant-second");
      await expect(
        prisma.creatorWorkspace.create({
          data: {
            ownerProfileId: second.profile.id,
            organizationId: first.organization.id,
          },
        }),
      ).rejects.toThrow(/C01_CREATOR_WORKSPACE_OWNER_ORGANIZATION_MISMATCH/);
      await expect(
        prisma.user.update({
          where: { id: first.user.id },
          data: { organizationId: second.organization.id },
        }),
      ).rejects.toThrow(/C01_CREATOR_OWNER_USER_ORGANIZATION_MUTATION_BLOCKED/);
      await expect(
        prisma.creatorProfile.update({
          where: { id: first.profile.id },
          data: { userId: second.user.id },
        }),
      ).rejects.toThrow(/C01_CREATOR_PROFILE_USER_MUTATION_BLOCKED/);
      await expect(
        prisma.organization.update({
          where: { id: first.organization.id },
          data: { kind: OrganizationKind.BRAND },
        }),
      ).rejects.toThrow(/C01_ORGANIZATION_KIND_MUTATION_BLOCKED/);
    });

    it("keeps provisional Creator registration outside canonical participation", async () => {
      const provisional = await prisma.user.create({
        data: {
          email: `${randomUUID()}@provisional.example`,
          role: UserRole.CREATOR,
          authState: UserAuthState.PROVISIONAL,
        },
      });
      expect(provisional.organizationId).toBeNull();
      expect(
        await prisma.creatorProfile.count({
          where: { userId: provisional.id },
        }),
      ).toBe(0);
      const organization = await prisma.organization.create({
        data: { name: randomUUID(), kind: OrganizationKind.CREATOR },
      });
      await expect(
        prisma.user.update({
          where: { id: provisional.id },
          data: { organizationId: organization.id },
        }),
      ).rejects.toThrow(/C01_PROVISIONAL_CREATOR_CANNOT_CLAIM_ORGANIZATION/);
    });
  });

  describe("shared provider OAuth transactions", () => {
    it("persists only a strong digest and preserves Brand policy evidence", async () => {
      const brand = await brandContext("oauth-brand-shape");
      const raw = await brandTransactions.issue({
        brandProfileId: brand.brand.id,
        initiatedByUserId: brand.user.id,
        redirectUri: "https://app.example/oauth/callback",
        intent: InstagramOAuthIntent.ACCOUNT_CHANGE,
        initiatedByRole: BrandRole.BRAND_OWNER,
        expectedGeneration: 7,
        expectedProviderAccountId: "provider-7",
      });
      expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const row = await prisma.providerOAuthTransaction.findUniqueOrThrow({
        where: { stateHash: hashProviderOAuthState(raw) },
      });
      expect(row).toMatchObject({
        provider: ProviderOAuthProvider.INSTAGRAM,
        subjectType: "BRAND",
        brandProfileId: brand.brand.id,
        creatorProfileId: null,
        initiatedByRole: BrandRole.BRAND_OWNER,
        expectedGeneration: 7,
        expectedProviderAccountId: "provider-7",
      });
      expect(JSON.stringify(row)).not.toContain(raw);
      expect(row.stateHash).toHaveLength(64);
    });

    it("consumes exactly once under a concurrent replay race", async () => {
      const brand = await brandContext("oauth-race");
      const context = {
        brandProfileId: brand.brand.id,
        initiatedByUserId: brand.user.id,
        redirectUri: "https://app.example/oauth/race",
      };
      const raw = await brandTransactions.issue(context);
      const outcomes = await Promise.allSettled([
        brandTransactions.consume(context, raw),
        brandTransactions.consume(context, raw),
      ]);
      expect(
        outcomes.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter((outcome) => outcome.status === "rejected"),
      ).toHaveLength(1);
      expect(
        await prisma.providerOAuthTransaction.findUniqueOrThrow({
          where: { stateHash: hashProviderOAuthState(raw) },
        }),
      ).toMatchObject({ consumedAt: expect.any(Date) });
    });

    it("fails closed for expiry, initiator, subject and redirect mismatches", async () => {
      const brand = await brandContext("oauth-bindings");
      const other = await brandContext("oauth-bindings-other");
      const context = {
        brandProfileId: brand.brand.id,
        initiatedByUserId: brand.user.id,
        redirectUri: "https://app.example/oauth/bindings",
      };
      for (const mismatch of [
        { ...context, initiatedByUserId: other.user.id },
        { ...context, brandProfileId: other.brand.id },
        { ...context, redirectUri: "https://app.example/oauth/wrong" },
      ]) {
        const raw = await brandTransactions.issue(context);
        await expect(
          brandTransactions.consume(mismatch, raw),
        ).rejects.toThrow();
      }
      const expired = await brandTransactions.issue(context);
      await prisma.providerOAuthTransaction.update({
        where: { stateHash: hashProviderOAuthState(expired) },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      await expect(
        brandTransactions.consume(context, expired),
      ).rejects.toThrow();
    });

    it("burns state before a simulated downstream failure", async () => {
      const brand = await brandContext("oauth-downstream");
      const context = {
        brandProfileId: brand.brand.id,
        initiatedByUserId: brand.user.id,
        redirectUri: "https://app.example/oauth/downstream",
      };
      const raw = await brandTransactions.issue(context);
      await brandTransactions.consume(context, raw);
      await expect(
        Promise.reject(new Error("simulated provider failure")),
      ).rejects.toThrow("simulated provider failure");
      await expect(brandTransactions.consume(context, raw)).rejects.toThrow();
    });

    it("prevents Brand and Creator adapters from crossing subject types", async () => {
      const brand = await brandContext("oauth-cross-brand");
      const creator = await creatorContext("oauth-cross-creator");
      const brandContextValue = {
        brandProfileId: brand.brand.id,
        initiatedByUserId: brand.user.id,
        redirectUri: "https://app.example/oauth/cross",
      };
      const creatorContextValue = {
        creatorProfileId: creator.profile.id,
        initiatedByUserId: creator.user.id,
        redirectUri: "https://app.example/oauth/cross",
        intent: InstagramOAuthIntent.INITIAL_CONNECT,
        expectedGeneration: 3,
        expectedProviderAccountId: "creator-provider-3",
      } as const;
      const brandRaw = await brandTransactions.issue(brandContextValue);
      const creatorRaw = await creatorTransactions.issue(creatorContextValue);
      await expect(
        creatorTransactions.consume(creatorContextValue, brandRaw),
      ).rejects.toThrow();
      await expect(
        brandTransactions.consume(brandContextValue, creatorRaw),
      ).rejects.toThrow();
      const creatorRow = await creatorTransactions.consume(
        creatorContextValue,
        creatorRaw,
      );
      expect(creatorRow).toMatchObject({
        subjectType: "CREATOR",
        expectedGeneration: 3,
        expectedProviderAccountId: "creator-provider-3",
        initiatedByRole: null,
      });
    });
  });

  describe("Creator provider capability persistence", () => {
    it.each([
      ["AVAILABLE", "AVAILABLE", "USABLE", null],
      ["AVAILABLE", "UNAVAILABLE", "USABLE", null],
      ["AVAILABLE", "UNKNOWN", "USABLE", null],
      ["UNAVAILABLE", "UNKNOWN", "REAUTHORIZATION_REQUIRED", null],
      ["UNAVAILABLE", "UNKNOWN", "PROVIDER_ACCESS_BLOCKED", null],
      ["UNAVAILABLE", "UNAVAILABLE", "DISCONNECTED", new Date()],
      ["UNKNOWN", "UNKNOWN", "UNKNOWN", null],
    ] as const)(
      "represents basic=%s insights=%s health=%s independently",
      async (basic, insights, health, disconnectedAt) => {
        const creator = await creatorContext(`provider-${health}-${insights}`);
        const integration = await prisma.creatorSocialIntegration.create({
          data: {
            creatorProfileId: creator.profile.id,
            platformNetwork: SocialNetworkProvider.INSTAGRAM,
            nativePlatformUserId: randomUUID(),
            channelHandleString: randomUUID(),
            oauthAccessTokenEncrypted: "encrypted-fixture",
            basicAuthorizationCapability: basic,
            insightsCapability: insights,
            authorizationHealth: health,
            authorizationHealthReasonCode:
              health === ProviderAuthorizationHealth.UNKNOWN
                ? "TRANSIENT_OR_UNVERIFIED"
                : null,
            disconnectedAt,
          },
        });
        expect(integration).toMatchObject({
          basicAuthorizationCapability: basic,
          insightsCapability: insights,
          authorizationHealth: health,
        });
        if (insights === ProviderCapabilityState.UNAVAILABLE) {
          expect(integration.basicAuthorizationCapability).toBe(basic);
          expect(integration.authorizationHealth).toBe(health);
        }
      },
    );
  });

  describe("Campaign continuation persistence", () => {
    it("stores only a digest, permits an unbound User and creates no Campaign actors", async () => {
      const brand = await brandContext("continuation");
      const campaign = await prisma.uceCampaign.create({
        data: { brandProfileId: brand.brand.id, name: "Continuation fixture" },
      });
      const beforeCreators = await prisma.uceCampaignCreator.count({
        where: { campaignId: campaign.id },
      });
      const beforeApplications = await prisma.uceApplication.count({
        where: { campaignId: campaign.id },
      });
      const issued =
        await continuations.createResolvedCampaignApplyContinuation({
          campaignId: campaign.id,
          boundUserId: null,
          expiresAt: new Date(Date.now() + 600_000),
        });
      expect(issued.opaqueToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const row = await prisma.creatorEntryContinuation.findUniqueOrThrow({
        where: { id: issued.continuationId },
      });
      expect(row).toMatchObject({
        tokenDigest: hashCreatorEntryContinuationToken(issued.opaqueToken),
        intent: "CAMPAIGN_APPLY",
        campaignId: campaign.id,
        boundUserId: null,
      });
      expect(JSON.stringify(row)).not.toContain(issued.opaqueToken);
      expect(
        await prisma.uceCampaignCreator.count({
          where: { campaignId: campaign.id },
        }),
      ).toBe(beforeCreators);
      expect(
        await prisma.uceApplication.count({
          where: { campaignId: campaign.id },
        }),
      ).toBe(beforeApplications);
    });

    it("distinguishes available, expired and consumed records", async () => {
      const brand = await brandContext("continuation-status");
      const campaign = await prisma.uceCampaign.create({
        data: { brandProfileId: brand.brand.id, name: "Status fixture" },
      });
      const available =
        await continuations.createResolvedCampaignApplyContinuation({
          campaignId: campaign.id,
          expiresAt: new Date(Date.now() + 600_000),
        });
      expect(
        await continuations.lookupByOpaqueToken(available.opaqueToken),
      ).toMatchObject({ status: "AVAILABLE" });

      const expiredToken = "A".repeat(43);
      await prisma.creatorEntryContinuation.create({
        data: {
          tokenDigest: hashCreatorEntryContinuationToken(expiredToken),
          campaignId: campaign.id,
          createdAt: new Date(Date.now() - 7_200_000),
          expiresAt: new Date(Date.now() - 3_600_000),
        },
      });
      expect(
        await continuations.lookupByOpaqueToken(expiredToken),
      ).toMatchObject({ status: "EXPIRED" });

      await prisma.creatorEntryContinuation.update({
        where: { id: available.continuationId },
        data: { consumedAt: new Date() },
      });
      expect(
        await continuations.lookupByOpaqueToken(available.opaqueToken),
      ).toMatchObject({ status: "CONSUMED" });
    });

    it("enforces Campaign FK, deletion restriction and immutable Campaign authority", async () => {
      await expect(
        continuations.createResolvedCampaignApplyContinuation({
          campaignId: randomUUID(),
          expiresAt: new Date(Date.now() + 600_000),
        }),
      ).rejects.toThrow();
      const firstBrand = await brandContext("continuation-first");
      const secondBrand = await brandContext("continuation-second");
      const first = await prisma.uceCampaign.create({
        data: { brandProfileId: firstBrand.brand.id, name: "First" },
      });
      const second = await prisma.uceCampaign.create({
        data: { brandProfileId: secondBrand.brand.id, name: "Second" },
      });
      const issued =
        await continuations.createResolvedCampaignApplyContinuation({
          campaignId: first.id,
          expiresAt: new Date(Date.now() + 600_000),
        });
      await expect(
        prisma.creatorEntryContinuation.update({
          where: { id: issued.continuationId },
          data: { campaignId: second.id },
        }),
      ).rejects.toThrow(/C01_CREATOR_ENTRY_CONTINUATION_AUTHORITY_IMMUTABLE/);
      await expect(
        prisma.uceCampaign.delete({ where: { id: first.id } }),
      ).rejects.toThrow();
    });
  });
});
