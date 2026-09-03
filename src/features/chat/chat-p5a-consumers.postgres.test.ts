import { NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "../brand-centre/brand-workspace-authorization.service";
import type { BrandConsumerService } from "../brand-centre/consumer/brand-consumer.service";
import { BrandCentreSessionEvictionService } from "../brand-centre/services/brand-centre-session-eviction.service";
import { BrandSettingsAccessService } from "../brand-settings/services/brand-settings-access.service";
import { BrandProviderReadinessService } from "../brand-settings/services/brand-provider-readiness.service";
import { BrandWorkspaceReadinessConsumerService } from "../brand-workspace-readiness/brand-workspace-readiness-consumer.service";
import { CollaborationConsumerService } from "../collaboration/services/collaboration-consumer.service";
import { SubscriptionAccessService } from "../pricing/services/subscription-access.service";
import { SubscriptionCapabilityService } from "../pricing/services/subscription-capability.service";
import {
  CollaborationListCapabilityOutputSchema,
  CollaborationReadCapabilityOutputSchema,
  ProviderReadinessCapabilityOutputSchema,
  WorkspaceReadinessCapabilityOutputSchema,
} from "./capabilities/chat-capability-output.schema";

const PRIMARY_USER_ID = "244023ed-0031-4e50-967c-ba58a4bc76f5";
const PRIMARY_BRAND_ID = "1af76731-f357-434f-96d3-2a37e5045e96";
const COLLABORATION_ID = "5f100000-0000-4000-8000-000000000005";
const SECOND_USER_ID = "5f100000-0000-4000-8000-00000000000a";
const SECOND_BRAND_ID = "5f100000-0000-4000-8000-00000000000b";

describe.skipIf(process.env.CHAT_HOME_P5_A_DATABASE_TEST !== "true")(
  "P5-A canonical consumer PostgreSQL acceptance",
  () => {
    const prisma = new PrismaClient();
    let collaborations: CollaborationConsumerService;
    let providerReadiness: BrandProviderReadinessService;
    let workspaceReadiness: BrandWorkspaceReadinessConsumerService;
    let primary: AuthUser;
    let second: AuthUser;
    let collaborationBefore: unknown;
    let readinessStateBefore: unknown;

    const asActor = (user: {
      id: string;
      email: string;
      name: string | null;
      role: AuthUser["role"];
      organizationId: string | null;
    }): AuthUser => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    });

    const collaborationSnapshot = () =>
      prisma.collaboration.findUniqueOrThrow({
        where: { id: COLLABORATION_ID },
        select: {
          id: true,
          brandProfileId: true,
          currentStage: true,
          unreadCountBrand: true,
          unreadCountCreator: true,
          isPaused: true,
          isTerminated: true,
          stageUpdatedAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
          ucePipelineCollaboration: {
            select: {
              id: true,
              collabStatus: true,
              currentPhase: true,
              currentMilestone: true,
              pipelineHealth: true,
              actionRequiredByRole: true,
              currentMilestoneDeadline: true,
              autoApprovalDeadline72h: true,
              productionDeadlineAt: true,
              updatedAt: true,
            },
          },
        },
      });

    const readinessStateSnapshot = () =>
      Promise.all([
        prisma.brandIntegration.findMany({
          where: {
            brandProfileId: { in: [PRIMARY_BRAND_ID, SECOND_BRAND_ID] },
          },
          orderBy: { id: "asc" },
          select: {
            id: true,
            brandProfileId: true,
            authorizationHealth: true,
            firstPartyProfileCapability: true,
            firstPartyInsightsCapability: true,
            businessDiscoveryCapability: true,
            creatorMarketplaceCapability: true,
            humanActionRequired: true,
            isActive: true,
            updatedAt: true,
          },
        }),
        prisma.brandSubscription.findUnique({
          where: { brandProfileId: PRIMARY_BRAND_ID },
          select: {
            id: true,
            status: true,
            tier: true,
            trialEndsAt: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            updatedAt: true,
          },
        }),
        prisma.brandBillingProfile.findUnique({
          where: { brandProfileId: PRIMARY_BRAND_ID },
          select: {
            id: true,
            registeredCompanyName: true,
            legalEntityType: true,
            billingCountryCode: true,
            corporateBillingAddress: true,
            profileState: true,
            updatedAt: true,
          },
        }),
      ]);

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.pathname !== "/chat_home_p3_module_boundary_01"
      ) {
        throw new Error(
          "P5-A acceptance requires the exact disposable local fixture database",
        );
      }
      const migrations = await prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      `;
      expect(migrations[0]?.count).toBe(66);
      expect(
        await prisma.intelligenceSubject.count({
          where: { brandId: SECOND_BRAND_ID },
        }),
      ).toBe(0);

      const [primaryUser, secondUser] = await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: PRIMARY_USER_ID },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            organizationId: true,
          },
        }),
        prisma.user.findUniqueOrThrow({
          where: { id: SECOND_USER_ID },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            organizationId: true,
          },
        }),
      ]);
      primary = asActor(primaryUser);
      second = asActor(secondUser);
      collaborationBefore = await collaborationSnapshot();
      readinessStateBefore = await readinessStateSnapshot();
      const db = prisma as unknown as PrismaService;
      const authorization = new BrandWorkspaceAuthorizationService(
        db,
        new BrandCentreAuthService(
          db,
          new BrandCentreSessionEvictionService(db),
        ),
      );
      collaborations = new CollaborationConsumerService(db, authorization);
      providerReadiness = new BrandProviderReadinessService(
        db,
        new BrandSettingsAccessService(db, authorization),
      );
      const primaryBrand = await prisma.brandProfile.findUniqueOrThrow({
        where: { id: PRIMARY_BRAND_ID },
        select: { id: true, name: true, domain: true },
      });
      expect(primaryBrand.name.trim()).not.toBe("");
      expect(primaryBrand.domain.trim()).not.toBe("");
      const brandConsumerRead = vi.fn().mockResolvedValue({
        brandId: primaryBrand.id,
        workspaceReadiness: "READY",
      });
      workspaceReadiness = new BrandWorkspaceReadinessConsumerService(
        db,
        authorization,
        { read: brandConsumerRead } as unknown as BrandConsumerService,
        new SubscriptionCapabilityService(db, new SubscriptionAccessService()),
      );
    }, 120_000);

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it("returns the prepared primary Collaboration through strict safe contracts", async () => {
      const list = CollaborationListCapabilityOutputSchema.parse(
        await collaborations.list(primary),
      );
      const read = CollaborationReadCapabilityOutputSchema.parse(
        await collaborations.read(primary, COLLABORATION_ID),
      );
      expect(list.collaborations).toContainEqual(
        expect.objectContaining({
          collaborationId: COLLABORATION_ID,
          campaign: {
            id: "310e6b52-2001-4642-ba8d-d82190aa1ed1",
            name: "Summer Launch Acceptance",
          },
        }),
      );
      expect(read).toMatchObject({
        collaborationId: COLLABORATION_ID,
        campaign: { id: "310e6b52-2001-4642-ba8d-d82190aa1ed1" },
      });
      expect(JSON.stringify({ list, read })).not.toMatch(
        /email|accessToken|refreshToken|providerAccount|bank|redemption|tracking/iu,
      );
    });

    it("does not reveal a primary Collaboration to the second Brand", async () => {
      await expect(
        collaborations.read(second, COLLABORATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("resolves primary workspace and provider readiness from canonical fixture state", async () => {
      const workspace = WorkspaceReadinessCapabilityOutputSchema.parse(
        await workspaceReadiness.read(primary),
      );
      const providers = ProviderReadinessCapabilityOutputSchema.parse(
        await providerReadiness.read(primary),
      );
      expect(workspace).toMatchObject({
        brandId: PRIMARY_BRAND_ID,
        workspace: { state: "READY" },
        subscription: { state: "FULL_ACCESS" },
        billing: { state: "READY" },
      });
      expect(providers.providers[0]).toMatchObject({
        provider: "INSTAGRAM",
        state: "READY",
      });
    }, 120_000);

    it("maps second-Brand revalidation to action required without Intelligence reads", async () => {
      const providers = ProviderReadinessCapabilityOutputSchema.parse(
        await providerReadiness.read(second),
      );
      expect(providers).toMatchObject({
        brandId: SECOND_BRAND_ID,
        providers: [
          {
            provider: "INSTAGRAM",
            state: "ACTION_REQUIRED",
            humanActionRequired: true,
          },
        ],
      });
      expect(
        await prisma.intelligenceSubject.count({
          where: { brandId: SECOND_BRAND_ID },
        }),
      ).toBe(0);
    });

    it("leaves Collaboration, provider, subscription, and billing state unchanged", async () => {
      expect(await collaborationSnapshot()).toEqual(collaborationBefore);
      expect(await readinessStateSnapshot()).toEqual(readinessStateBefore);
      expect(
        await prisma.intelligenceSubject.count({
          where: { brandId: SECOND_BRAND_ID },
        }),
      ).toBe(0);
      const [migrations, fixtureRows] = await Promise.all([
        prisma.$queryRaw<[{ count: number }]>`
          SELECT COUNT(*)::int AS count
          FROM "_prisma_migrations"
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        `,
        Promise.all([
          prisma.collaboration.count({ where: { id: COLLABORATION_ID } }),
          prisma.uceCampaignCollaboration.count({
            where: { id: "5f100000-0000-4000-8000-000000000004" },
          }),
          prisma.brandSubscription.count({
            where: { id: "5f100000-0000-4000-8000-000000000006" },
          }),
          prisma.brandBillingProfile.count({
            where: { id: "5f100000-0000-4000-8000-000000000007" },
          }),
          prisma.brandIntegration.count({
            where: {
              id: {
                in: [
                  "5f100000-0000-4000-8000-000000000008",
                  "5f100000-0000-4000-8000-00000000000d",
                ],
              },
            },
          }),
        ]),
      ]);
      expect(migrations[0]?.count).toBe(66);
      expect(fixtureRows).toEqual([1, 1, 1, 1, 2]);
    });
  },
);
