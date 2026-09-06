import "reflect-metadata";

import { randomUUID } from "node:crypto";
import { ForbiddenException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  applicationHarness,
  brandFixture,
  campaignFixture,
  creatorFixture,
  teamFixture,
} from "../../../test/fixtures/c03-application-fixtures";
import type { PrismaService } from "../../prisma/prisma.service";
import { CollaborationAccessService } from "./services/collaboration-access.service";
import { CollaborationDestinationService } from "./services/collaboration-destination.service";
import { CollaborationNegotiationService } from "./services/collaboration-negotiation.service";
import { CollaborationWorkerService } from "./services/collaboration-worker.service";
import { CollaborationBriefPackService } from "./services/collaboration-brief-pack.service";

describe.skipIf(process.env.C04_B2_DATABASE_TEST !== "true")(
  "C04 shared Collaboration PostgreSQL runtime",
  () => {
    const db = new PrismaClient({
      transactionOptions: { timeout: 30000, maxWait: 10000 },
    });
    const h = applicationHarness(db);
    const access = new CollaborationAccessService(
      db as PrismaService,
      h.actors,
    );
    const realtime = { broadcast: vi.fn().mockResolvedValue(undefined) } as any;
    const negotiation = new CollaborationNegotiationService(
      db as PrismaService,
      access,
      realtime,
      { manualEnabledForNewObligations: () => false } as any,
      {} as any,
      {} as any,
    );
    const destination = new CollaborationDestinationService(
      db as PrismaService,
      access,
      realtime,
    );
    const worker = new CollaborationWorkerService(
      db as PrismaService,
      {} as any,
      {} as any,
      realtime,
    );
    const briefPack = new CollaborationBriefPackService(access);

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        url.hostname !== "localhost" ||
        url.pathname !== "/c04_b2_runtime_20260906"
      ) {
        throw new Error("C04_B2_ISOLATED_DATABASE_REQUIRED");
      }
      await db.$connect();
    });
    afterAll(() => db.$disconnect());

    async function approved(negotiable = true) {
      const owner = await creatorFixture(db);
      const brand = await brandFixture(db);
      const campaign = await campaignFixture(db, brand.brand.id);
      if (negotiable) {
        await db.uceCampaignCommercials.update({
          where: { campaignId: campaign.campaign.id },
          data: { compensationType: "NEGOTIABLE" },
        });
      }
      const application = await h.submit.submit(
        owner.user,
        campaign.campaign.id,
        campaign.selection(),
        randomUUID(),
      );
      await h.terminal.decide(
        brand.user,
        campaign.campaign.id,
        application.applicationId,
        "APPROVE",
        randomUUID(),
      );
      const collaboration = await db.collaboration.findUniqueOrThrow({
        where: { sourceApplicationId: application.applicationId },
        include: { commercialAgreement: true, snapshot: true },
      });
      return { owner, brand, campaign, application, collaboration };
    }

    it("Owner submits the one first proposal; replay is stable", async () => {
      const f = await approved();
      const agreement = f.collaboration.commercialAgreement!;
      const command = {
        commandId: randomUUID(),
        expectedAggregateVersion: f.collaboration.aggregateVersion,
        proposedFee: agreement.minimumCreatorFeeSnapshot!.toNumber(),
        currency: agreement.currency,
      };
      await negotiation.submitCreatorProposal(
        f.owner.user,
        f.collaboration.id,
        command,
      );
      await negotiation.submitCreatorProposal(
        f.owner.user,
        f.collaboration.id,
        command,
      );
      expect(
        await db.collaborationEvent.count({
          where: {
            collaborationId: f.collaboration.id,
            eventType: "CREATOR_PROPOSAL_SUBMITTED",
          },
        }),
      ).toBe(1);
      expect(
        await db.collaborationCommercialAgreement.findUnique({
          where: { collaborationId: f.collaboration.id },
        }),
      ).toMatchObject({ negotiationState: "AWAITING_BRAND_DECISION" });
    });

    it("rejects below-minimum and wrong-currency proposals without mutation", async () => {
      for (const mutation of [
        (minimum: number, currency: string) => ({
          proposedFee: minimum - 1,
          currency,
        }),
        (minimum: number) => ({ proposedFee: minimum, currency: "USD" }),
      ]) {
        const f = await approved();
        const agreement = f.collaboration.commercialAgreement!;
        await expect(
          negotiation.submitCreatorProposal(f.owner.user, f.collaboration.id, {
            commandId: randomUUID(),
            expectedAggregateVersion: f.collaboration.aggregateVersion,
            ...mutation(
              agreement.minimumCreatorFeeSnapshot!.toNumber(),
              agreement.currency,
            ),
          }),
        ).rejects.toBeDefined();
        expect(
          await db.collaborationEvent.count({
            where: { collaborationId: f.collaboration.id },
          }),
        ).toBe(1);
      }
    });

    it("Manager may command while Assistant remains read/chat only", async () => {
      const managerFixture = await approved();
      const manager = await teamFixture(db, managerFixture.owner, "MANAGER");
      const agreement = managerFixture.collaboration.commercialAgreement!;
      await negotiation.submitCreatorProposal(
        manager.user,
        managerFixture.collaboration.id,
        {
          commandId: randomUUID(),
          expectedAggregateVersion:
            managerFixture.collaboration.aggregateVersion,
          proposedFee: agreement.minimumCreatorFeeSnapshot!.toNumber(),
          currency: agreement.currency,
        },
      );
      const event = await db.collaborationEvent.findFirstOrThrow({
        where: {
          collaborationId: managerFixture.collaboration.id,
          eventType: "CREATOR_PROPOSAL_SUBMITTED",
        },
      });
      expect(event).toMatchObject({
        actorUserId: manager.user.id,
        actorMembershipId: manager.member.id,
        actorRole: "MANAGER",
      });

      const assistantFixture = await approved();
      const assistant = await teamFixture(
        db,
        assistantFixture.owner,
        "ASSISTANT",
      );
      await expect(
        access.assertThreadForUser(
          assistant.user,
          assistantFixture.collaboration.id,
          "COMMAND",
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        access.assertThreadForUser(
          assistant.user,
          assistantFixture.collaboration.id,
          "CHAT",
        ),
      ).resolves.toBeTruthy();
    });

    it("confirms one fresh default destination and then enforces immutability", async () => {
      const f = await approved(false);
      await db.collaborationExecutionSnapshot.update({
        where: { collaborationId: f.collaboration.id },
        data: { physicalDeliveryRequired: true },
      });
      const contact = await db.creatorShippingAddress.create({
        data: {
          creatorProfileId: f.owner.profile.id,
          recipientName: "Creator",
          addressLine1: "1 Runtime Street",
          city: "Mumbai",
          postalCode: "400001",
          countryCode: "IN",
          isDefault: true,
        },
      });
      await destination.confirmDefault(f.owner.user, f.collaboration.id, {
        commandId: randomUUID(),
        expectedAggregateVersion: f.collaboration.aggregateVersion,
        sourceContactId: contact.id,
        sourceContactUpdatedAt: contact.updatedAt.toISOString(),
      });
      const stored =
        await db.collaborationDeliveryDestination.findUniqueOrThrow({
          where: { collaborationId: f.collaboration.id },
        });
      expect(stored).toMatchObject({
        sourceType: "C05_DEFAULT",
        confirmedByRole: "OWNER",
      });
      expect(stored.destinationContentHash).toMatch(/^[a-f0-9]{64}$/);
      await expect(
        destination.override(f.owner.user, f.collaboration.id, {
          commandId: randomUUID(),
          expectedAggregateVersion: f.collaboration.aggregateVersion + 1,
          recipientName: "Other",
          addressLine1: "2 Other Street",
          city: "Mumbai",
          postalCode: "400002",
          countryCode: "IN",
        }),
      ).rejects.toBeDefined();
    });

    it("projects SYSTEM message, notifications and socket invalidation independently and idempotently", async () => {
      const f = await approved();
      const agreement = f.collaboration.commercialAgreement!;
      await negotiation.submitCreatorProposal(
        f.owner.user,
        f.collaboration.id,
        {
          commandId: randomUUID(),
          expectedAggregateVersion: f.collaboration.aggregateVersion,
          proposedFee: agreement.minimumCreatorFeeSnapshot!.toNumber(),
          currency: agreement.currency,
        },
      );
      while (await worker.processOneOutbox()) {
        // Drain this disposable candidate queue.
      }
      expect(
        await db.collaborationProjectionOutbox.count({
          where: { collaborationId: f.collaboration.id, state: "COMPLETED" },
        }),
      ).toBe(3);
      expect(
        await db.collaborationMessage.count({
          where: { collaborationId: f.collaboration.id, kind: "SYSTEM" },
        }),
      ).toBe(1);
      expect(
        await db.notification.count({
          where: {
            semanticEventKey: { not: null },
            payload: { path: ["collaborationId"], equals: f.collaboration.id },
          },
        }),
      ).toBe(2);
      expect(await worker.processOneOutbox()).toBe(false);
      expect(
        await db.collaborationMessage.count({
          where: { collaborationId: f.collaboration.id, kind: "SYSTEM" },
        }),
      ).toBe(1);
    });

    it("serves a persisted snapshot-only CollaborationBriefPackV1", async () => {
      const f = await approved(false);
      const pack = await briefPack.get(f.owner.user, f.collaboration.id);
      expect(pack).toMatchObject({
        schemaVersion: 1,
        collaboration: {
          collaborationId: f.collaboration.id,
          sourceApplicationId: f.application.applicationId,
        },
      });
      expect(JSON.stringify(pack)).not.toContain("destinationContentHash");
      expect(JSON.stringify(pack)).not.toContain("actorMembershipId");
    });
  },
);
