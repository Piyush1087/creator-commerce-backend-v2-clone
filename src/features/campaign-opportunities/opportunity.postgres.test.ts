import "reflect-metadata";
import {
  PrismaClient,
  type CampaignOpportunityInvitation,
  type User,
} from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { CanonicalCampaignApplicationReadService } from "../brand-uce/services/canonical-campaign-application-read.service";
import { CreatorEntryContinuationStore } from "../creator-entry/creator-entry-continuation.store";
import { CreatorCampaignApplyContinuationService } from "../creator-entry/creator-campaign-apply-continuation.service";
import { CreatorCanonicalContextService } from "../creator-entry/creator-canonical-context.service";
import { CreatorEntryStateService } from "../creator-entry/creator-entry-state.service";
import { CampaignInvitationService } from "./campaign-invitation.service";
import { CampaignContinuationContextService } from "./campaign-continuation-context.service";
import { CampaignOpportunityService } from "./campaign-opportunity.service";
import { CampaignOpportunityPolicyService } from "./campaign-opportunity-policy.service";
import { CanonicalCampaignOpportunityEligibility } from "./campaign-opportunity-eligibility";
import { CampaignIngressService } from "./campaign-ingress.service";

describe.skipIf(process.env.C03_P12_DATABASE_TEST !== "true")(
  "C03 P1.2 PostgreSQL security",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { timeout: 30_000, maxWait: 10_000 },
    });
    const db = prisma as unknown as PrismaService;
    const actors = new CreatorWorkspaceActorService(db);
    const invitations = new CampaignInvitationService(
      db,
      new ConfigService({
        C03_INVITATION_IDENTITY_HMAC_PEPPER:
          "c03-fixture-only-deterministic-key-0123456789",
      }),
    );
    const contexts = new CampaignContinuationContextService(
      db,
      actors,
      invitations,
    );
    const store = new CreatorEntryContinuationStore(db);
    const continuations = new CreatorCampaignApplyContinuationService(
      store,
      new CreatorCanonicalContextService(db),
      new CreatorEntryStateService(db),
      contexts,
    );
    const service = new CampaignOpportunityService(
      db,
      actors,
      new CanonicalCampaignApplicationReadService(db),
      new CampaignOpportunityPolicyService(),
      new CanonicalCampaignOpportunityEligibility(),
      invitations,
      new CampaignIngressService(db),
      continuations,
    );

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      const database =
        process.env.C03_P14_DATABASE_TEST === "true"
          ? "/c03_p14_handoff"
          : process.env.C03_P13_DATABASE_TEST === "true"
            ? "/c03_p13"
            : "/c03_p12";
      if (url.hostname !== "localhost" || url.pathname !== database)
        throw new Error("C03_P12_DISPOSABLE_DATABASE_REQUIRED");
      await prisma.$connect();
    });
    afterAll(() => prisma.$disconnect());

    async function creator() {
      const email = `c03-${randomUUID()}@example.test`;
      const org = await prisma.organization.create({
        data: { kind: "CREATOR", name: "C03 test" },
      });
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
        data: { userId: user.id },
      });
      const workspace = await prisma.creatorWorkspace.create({
        data: { ownerProfileId: profile.id, organizationId: org.id },
      });
      await prisma.creatorWorkspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          assignedProfileId: profile.id,
          associatedEmail: email,
          securityRole: "OWNER",
          joinedAt: new Date(),
          isActive: true,
        },
      });
      await prisma.creatorSocialIntegration.create({
        data: {
          creatorProfileId: profile.id,
          platformNetwork: "INSTAGRAM",
          nativePlatformUserId: randomUUID(),
          channelHandleString: "fixture",
          oauthAccessTokenEncrypted: "test-only-unused",
          tokenStateCondition: "ACTIVE",
          authorizationHealth: "USABLE",
          basicAuthorizationCapability: "AVAILABLE",
        },
      });
      return { user, profile, workspace };
    }
    async function campaign(
      visibility: "EVERYONE" | "ELIGIBLE_ONLY" | "INVITED_ONLY" = "EVERYONE",
    ) {
      const brand = await prisma.brandProfile.create({
        data: {
          domain: `${randomUUID()}.example.test`,
          name: "C03 Brand",
          industry: "D2C",
          brandValues: [],
          policyFlags: [],
        },
      });
      return prisma.uceCampaign.create({
        data: {
          brandProfileId: brand.id,
          name: "C03 Opportunity",
          status: "LIVE",
          targeting: {
            create: {
              industryVertical: "D2C",
              visibilityScope: visibility,
              visibilityScopes: [visibility],
            },
          },
        },
      });
    }
    async function invite(
      campaignId: string,
      user: User,
      profileId: string,
      overrides: Partial<CampaignOpportunityInvitation> = {},
    ) {
      const raw = randomBytes(32).toString("base64url");
      const row = await prisma.campaignOpportunityInvitation.create({
        data: {
          campaignId,
          issuedByActorUserId: user.id,
          intendedCreatorProfileId: profileId,
          tokenDigest: createHash("sha256").update(raw).digest("hex"),
          issuedAt: new Date(Date.now() - 60_000),
          expiresAt: new Date(Date.now() + 86_400_000),
          ...overrides,
        },
      });
      return { row, raw };
    }
    it("binds once, allows same-subject retries, and denies forwarded/rebound authority", async () => {
      const owner = await creator(),
        other = await creator(),
        c = await campaign("INVITED_ONLY");
      const invitation = await invite(c.id, owner.user, owner.profile.id);
      expect(await invitations.exchange(c.id, invitation.raw, new Date())).toBe(
        invitation.row.id,
      );
      const actor = await actors.resolve(owner.user),
        wrong = await actors.resolve(other.user);
      expect(
        await prisma.$transaction((tx) =>
          invitations.validateAndBind(
            tx,
            wrong,
            c.id,
            invitation.row.id,
            new Date(),
          ),
        ),
      ).toBe("SUBJECT_MISMATCH");
      const results = await Promise.all(
        [0, 1].map(() =>
          prisma.$transaction((tx) =>
            invitations.validateAndBind(
              tx,
              actor,
              c.id,
              invitation.row.id,
              new Date(),
            ),
          ),
        ),
      );
      expect(results).toEqual(["VALID", "VALID"]);
      const stored =
        await prisma.campaignOpportunityInvitation.findUniqueOrThrow({
          where: { id: invitation.row.id },
        });
      expect(stored.bindingVersion).toBe(1);
      expect(stored.boundCreatorProfileId).toBe(owner.profile.id);
      expect(JSON.stringify(stored)).not.toContain(invitation.raw);
      expect(
        await prisma.$transaction((tx) =>
          invitations.validateAndBind(
            tx,
            wrong,
            c.id,
            invitation.row.id,
            new Date(),
          ),
        ),
      ).toBe("SUBJECT_MISMATCH");
      await expect(
        prisma.campaignOpportunityInvitation.update({
          where: { id: stored.id },
          data: {
            boundCreatorProfileId: other.profile.id,
            boundCreatorWorkspaceId: other.workspace.id,
          },
        }),
      ).rejects.toThrow();
    });
    it("denies expired, revoked, wrong-Campaign and guessed credentials", async () => {
      const owner = await creator(),
        c = await campaign("INVITED_ONLY"),
        other = await campaign();
      const actor = await actors.resolve(owner.user);
      const expired = await invite(c.id, owner.user, owner.profile.id, {
        expiresAt: new Date(Date.now() - 1_000),
      });
      const revoked = await invite(c.id, owner.user, owner.profile.id, {
        revokedAt: new Date(),
        revokedByActorUserId: owner.user.id,
      });
      for (const [entry, expected] of [
        [expired, "EXPIRED"],
        [revoked, "REVOKED"],
      ] as const) {
        expect(
          await prisma.$transaction((tx) =>
            invitations.validateAndBind(
              tx,
              actor,
              c.id,
              entry.row.id,
              new Date(),
            ),
          ),
        ).toBe(expected);
      }
      expect(
        await invitations.exchange(other.id, revoked.raw, new Date()),
      ).toBeNull();
      expect(
        await invitations.exchange(
          c.id,
          randomBytes(32).toString("base64url"),
          new Date(),
        ),
      ).toBeNull();
      expect(await service.detail(c.id, owner.user)).toMatchObject({
        state: "LOCKED",
      });
      await expect(
        service.issue(c.id, owner.user, {
          campaignInvitationId: revoked.row.id,
        }),
      ).rejects.toThrow();
    });
    it.each([
      "DIRECT_CAMPAIGN_LINK",
      "TRACKED_CAMPAIGN_SHARE",
      "BRAND_INVITATION",
      "CREATOR_OPPORTUNITIES",
    ] as const)(
      "preserves typed %s through one-time C01 return",
      async (surface) => {
        const owner = await creator(),
          c = await campaign(
            surface === "BRAND_INVITATION" ? "INVITED_ONLY" : "EVERYONE",
          );
        const body: Record<string, unknown> = {
          entrySurface: surface,
          attribution: {
            utm_source: "  ＴＥＳＴ\u0001  ",
            rawCredential: "discard",
          },
        };
        if (surface === "BRAND_INVITATION")
          body.invitationCredential = (
            await invite(c.id, owner.user, owner.profile.id)
          ).raw;
        if (surface === "TRACKED_CAMPAIGN_SHARE") {
          const share = await prisma.uceCampaignShare.create({
            data: {
              campaignId: c.id,
              requestId: randomUUID(),
              channel: "COPY_LINK",
              trackingToken: randomUUID(),
            },
          });
          body.shareToken = share.trackingToken;
        }
        const before = await prisma.uceApplication.count();
        const issued = await service.issue(
          c.id,
          surface === "CREATOR_OPPORTUNITIES" ? owner.user : undefined,
          body,
        );
        const result = await continuations.resolve(
          owner.user,
          issued.continuationToken,
        );
        expect(result).toMatchObject({
          status: "READY_TO_RETURN",
          campaign: { campaignId: c.id },
        });
        expect(JSON.stringify(result)).not.toMatch(
          /utm|invitation|nativePlatform|tokenDigest/,
        );
        const stored = await store.lookupByOpaqueToken(
          issued.continuationToken,
        );
        expect(stored).toMatchObject({
          entrySurface: surface,
          boundCreatorProfileId: owner.profile.id,
          boundCreatorWorkspaceId: owner.workspace.id,
        });
        expect(await prisma.uceApplication.count()).toBe(before);
        expect(
          await continuations.resolve(owner.user, issued.continuationToken),
        ).toMatchObject({ campaign: { campaignId: c.id } });
      },
    );
    it("does not enumerate PUBLIC detail until qualified ingress and isolates subjects", async () => {
      const owner = await creator(),
        other = await creator(),
        c = await campaign();
      expect(await service.detail(c.id, owner.user)).toMatchObject({
        state: "AUTHORIZED",
        canApply: false,
      });
      expect(
        (await service.collection(owner.user)).items.some(
          (item) => item.campaign.id === c.id,
        ),
      ).toBe(false);
      const issued = await service.issue(c.id, owner.user, {});
      await continuations.resolve(owner.user, issued.continuationToken);
      expect(
        (await service.collection(owner.user)).items.some(
          (item) => item.campaign.id === c.id,
        ),
      ).toBe(true);
      expect(
        (await service.collection(other.user)).items.some(
          (item) => item.campaign.id === c.id,
        ),
      ).toBe(false);
    });
    it("returns eligible and invited candidates with stable cursor pagination", async () => {
      const owner = await creator();
      const ids: string[] = [];
      for (let index = 0; index < 22; index++) {
        const c = await campaign();
        ids.push(c.id);
        await service.issue(c.id, owner.user, {});
      }
      const eligible = await campaign("ELIGIBLE_ONLY");
      const invited = await campaign("INVITED_ONLY");
      const invitation = await invite(invited.id, owner.user, owner.profile.id);
      await service.issue(invited.id, owner.user, {
        invitationCredential: invitation.raw,
      });
      const first = await service.collection(owner.user);
      expect(first.items).toHaveLength(20);
      expect(first.nextCursor).not.toBeNull();
      expect(await service.collection(owner.user)).toEqual(first);
      const second = await service.collection(owner.user, first.nextCursor!);
      const combined = [...first.items, ...second.items].map(
        (item) => item.campaign.id,
      );
      expect(new Set(combined).size).toBe(combined.length);
      expect(combined).toEqual([...combined].sort());
      expect(combined).toEqual(
        expect.arrayContaining([...ids, eligible.id, invited.id]),
      );
    }, 30_000);

    it("rejects inactive Team membership on protected reads", async () => {
      const owner = await creator(),
        c = await campaign();
      const email = `assistant-${randomUUID()}@example.test`;
      const assistant = await prisma.user.create({
        data: {
          email,
          normalizedEmail: email,
          role: "CREATOR",
          authState: "ACTIVE",
          organizationId: owner.user.organizationId,
        },
      });
      const membership = await prisma.creatorWorkspaceMember.create({
        data: {
          workspaceId: owner.workspace.id,
          userId: assistant.id,
          associatedEmail: email,
          securityRole: "ASSISTANT",
          isActive: true,
          joinedAt: new Date(),
        },
      });
      expect(await service.detail(c.id, assistant)).toMatchObject({
        state: "AUTHORIZED",
      });
      await prisma.creatorWorkspaceMember.update({
        where: { id: membership.id },
        data: { isActive: false },
      });
      await expect(service.detail(c.id, assistant)).rejects.toThrow();
    });
  },
);
