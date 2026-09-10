import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  applicationHarness,
  brandFixture,
  campaignFixture,
  creatorFixture,
  teamFixture,
} from "../../../test/fixtures/c03-application-fixtures";
import type { PrismaService } from "../../prisma/prisma.service";
import { CanonicalCampaignApplicationReadService } from "../brand-uce/services/canonical-campaign-application-read.service";
import { ApplicationHomeReadService } from "../campaign-applications/application-home-read.service";
import { CampaignContinuationContextService } from "../campaign-opportunities/campaign-continuation-context.service";
import { CampaignIngressService } from "../campaign-opportunities/campaign-ingress.service";
import { CampaignInvitationService } from "../campaign-opportunities/campaign-invitation.service";
import { CanonicalCampaignOpportunityEligibility } from "../campaign-opportunities/campaign-opportunity-eligibility";
import { CampaignOpportunityPolicyService } from "../campaign-opportunities/campaign-opportunity-policy.service";
import { CampaignOpportunityService } from "../campaign-opportunities/campaign-opportunity.service";
import { CollaborationHomeReadService } from "../collaboration/services/collaboration-home-read.service";
import { CreatorCanonicalContextService } from "../creator-entry/creator-canonical-context.service";
import { CreatorCampaignApplyContinuationService } from "../creator-entry/creator-campaign-apply-continuation.service";
import { CreatorEntryContinuationStore } from "../creator-entry/creator-entry-continuation.store";
import { CreatorEntryStateService } from "../creator-entry/creator-entry-state.service";
import { CreatorSettingsHomeReadService } from "../creator-settings/home/creator-settings-home-read.service";
import { CreatorHomeNotificationReadService } from "../notifications/services/creator-home-notification-read.service";

describe.skipIf(process.env.C02A_HOME_DATABASE_TEST !== "true")(
  "C02A Creator Home real PostgreSQL acceptance",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { timeout: 30_000, maxWait: 10_000 },
    });
    const db = prisma as unknown as PrismaService;
    const harness = applicationHarness(prisma);
    const invitations = new CampaignInvitationService(
      db,
      new ConfigService({
        C03_INVITATION_IDENTITY_HMAC_PEPPER:
          "c02a-home-test-only-pepper-0123456789",
      }),
    );
    const opportunity = new CampaignOpportunityService(
      db,
      harness.actors,
      new CanonicalCampaignApplicationReadService(db),
      new CampaignOpportunityPolicyService(),
      new CanonicalCampaignOpportunityEligibility(),
      invitations,
      new CampaignIngressService(db),
      new CreatorCampaignApplyContinuationService(
        new CreatorEntryContinuationStore(db),
        new CreatorCanonicalContextService(db),
        new CreatorEntryStateService(db),
        new CampaignContinuationContextService(db, harness.actors, invitations),
      ),
    );
    const applications = new ApplicationHomeReadService(db);
    const collaborations = new CollaborationHomeReadService(db);
    const notifications = new CreatorHomeNotificationReadService(db);
    const settings = new CreatorSettingsHomeReadService(db, harness.actors);

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        url.hostname !== "localhost" ||
        url.pathname !== "/c02a_home_acceptance"
      )
        throw new Error("C02A_ISOLATED_DATABASE_REQUIRED");
      await prisma.$connect();
    });
    afterAll(() => prisma.$disconnect());

    it("proves exact counts, truncation, owner roles, isolation, unread preservation and read purity", async () => {
      const owner = await creatorFixture(prisma);
      const manager = await teamFixture(prisma, owner, "MANAGER");
      const assistant = await teamFixture(prisma, owner, "ASSISTANT");
      const brand = await brandFixture(prisma);
      const campaign = await campaignFixture(prisma, brand.brand.id);
      await prisma.campaignIngressTouch.create({
        data: {
          campaignId: campaign.campaign.id,
          kind: "QUALIFIED_INGRESS",
          entrySurface: "CREATOR_OPPORTUNITIES",
          entryAuthorityKind: "DIRECT",
          boundCreatorProfileId: owner.profile.id,
          boundCreatorWorkspaceId: owner.workspace.id,
          boundAt: new Date(),
        },
      });
      const first = await harness.submit.submit(
        owner.user,
        campaign.campaign.id,
        campaign.selection(0),
        randomUUID(),
      );
      await harness.submit.submit(
        manager.user,
        campaign.campaign.id,
        campaign.selection(1),
        randomUUID(),
      );
      await harness.terminal.decide(
        brand.user,
        campaign.campaign.id,
        first.applicationId,
        "APPROVE",
        randomUUID(),
      );
      const notification = await prisma.notification.create({
        data: {
          creatorWorkspaceId: owner.workspace.id,
          eventType: "workspace.safe_update",
          urgencyLevel: "INFORMATIONAL",
          payload: {},
          recipients: { create: { userId: owner.user.id } },
        },
      });

      const actor = await harness.actors.resolve(owner.user);
      const countsBefore = {
        applications: await prisma.uceApplication.count(),
        events: await prisma.applicationDomainEvent.count(),
        recipients: await prisma.notificationRecipient.count(),
        unread: await prisma.notificationRecipient.count({
          where: { isRead: false },
        }),
      };
      const [
        opportunityRead,
        applicationRead,
        collaborationRead,
        notificationRead,
      ] = await Promise.all([
        opportunity.readForHome(owner.user, actor, 0),
        applications.read(actor, 1, 20),
        collaborations.read(actor, 1, 20),
        notifications.read(actor, 20),
      ]);
      expect(opportunityRead).toMatchObject({
        exactAuthorizedCount: 1,
        truncated: true,
      });
      expect(applicationRead).toMatchObject({
        exactPendingCount: 1,
        truncated: true,
      });
      expect(collaborationRead).toMatchObject({
        exactActiveCount: 1,
        truncated: false,
      });
      expect(notificationRead.exactUnreadCount).toBe(1);
      expect(notificationRead.activity[0].sourceId).toBe(notification.id);
      expect(await settings.read(owner.user, actor)).toMatchObject({
        creator: { role: "OWNER" },
      });
      expect(
        await settings.read(
          manager.user,
          await harness.actors.resolve(manager.user),
        ),
      ).toMatchObject({ creator: { role: "MANAGER" } });
      expect(
        await settings.read(
          assistant.user,
          await harness.actors.resolve(assistant.user),
        ),
      ).toMatchObject({ creator: { role: "ASSISTANT" } });

      const outsider = await creatorFixture(prisma);
      const outsiderActor = await harness.actors.resolve(outsider.user);
      expect(
        (await applications.read(outsiderActor, 4, 20)).exactPendingCount,
      ).toBe(0);
      expect(
        (await collaborations.read(outsiderActor, 4, 20)).exactActiveCount,
      ).toBe(0);

      expect({
        applications: await prisma.uceApplication.count(),
        events: await prisma.applicationDomainEvent.count(),
        recipients: await prisma.notificationRecipient.count(),
        unread: await prisma.notificationRecipient.count({
          where: { isRead: false },
        }),
      }).toEqual(countsBefore);
      await prisma.creatorWorkspaceMember.update({
        where: { id: assistant.member.id },
        data: { isActive: false },
      });
      await expect(
        harness.actors.resolve(assistant.user),
      ).rejects.toBeDefined();
    });
  },
);
