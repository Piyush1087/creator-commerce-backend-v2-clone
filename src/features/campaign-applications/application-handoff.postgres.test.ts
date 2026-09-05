import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  applicationHarness,
  brandFixture,
  campaignFixture,
  creatorFixture,
  teamFixture,
} from "../../../test/fixtures/c03-application-fixtures";
import { CreatorNotificationQueryService } from "../notifications/services/creator-notification-query.service";
import { NotificationProcessorService } from "../notifications/services/notification-processor.service";
import { NotificationWorkerService } from "../notifications/services/notification-worker.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { mapCollaborationDetail } from "../collaboration/utils/collaboration-thread.mapper";
import { COLLABORATION_THREAD_INCLUDE } from "../collaboration/services/collaboration-access.service";

describe.skipIf(process.env.C03_P14_DATABASE_TEST !== "true")(
  "C03 P1.4 atomic handoff and Creator notifications",
  () => {
    const db = new PrismaClient({
      transactionOptions: { timeout: 30000, maxWait: 10000 },
    });
    const h = applicationHarness(db);
    const query = new CreatorNotificationQueryService(
      db as PrismaService,
      h.actors,
    );
    const processor = new NotificationProcessorService(db as PrismaService);
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (url.hostname !== "localhost" || url.pathname !== "/c03_p14_handoff")
        throw new Error("P14_ISOLATED_DATABASE_REQUIRED");
      await db.$connect();
    });
    afterAll(() => db.$disconnect());
    async function fixture(negotiable = false) {
      const owner = await creatorFixture(db),
        brand = await brandFixture(db);
      const c = await campaignFixture(db, brand.brand.id);
      if (negotiable)
        await db.uceCampaignCommercials.update({
          where: { campaignId: c.campaign.id },
          data: { compensationType: "NEGOTIABLE" },
        });
      const first = await h.submit.submit(
        owner.user,
        c.campaign.id,
        c.selection(),
        randomUUID(),
      );
      return { owner, brand, c, first };
    }
    type Fixture = Awaited<ReturnType<typeof fixture>>;
    const decide = (
      f: Fixture,
      kind: "APPROVE" | "REJECT" = "APPROVE",
      key = randomUUID(),
      applicationId = f.first.applicationId,
    ) =>
      h.terminal.decide(
        f.brand.user,
        f.c.campaign.id,
        applicationId,
        kind,
        key,
      );
    async function jobs(f: Fixture, eventType: string) {
      return db.notificationJob.findMany({
        where: {
          eventType,
          payload: { path: ["application_id"], equals: f.first.applicationId },
        },
        include: { recipientSnapshots: true },
      });
    }
    async function collaboration(f: Fixture) {
      return db.collaboration.findUniqueOrThrow({
        where: { sourceApplicationId: f.first.applicationId },
        include: COLLABORATION_THREAD_INCLUDE,
      });
    }
    async function materialize(
      f: Fixture,
      eventType = "campaigns.application_approved",
    ) {
      const [job] = await jobs(f, eventType);
      await processor.processJob({
        ...job,
        claimToken: "fixture",
        payload: job.payload as Record<string, unknown>,
      });
      return db.notification.findFirstOrThrow({
        where: { creatorWorkspaceId: f.owner.workspace.id, eventType },
      });
    }

    it("approval commits exactly one Collaboration, linked event, job, snapshot and receipt; replay is stable", async () => {
      const f = await fixture(),
        key = randomUUID();
      const result = await decide(f, "APPROVE", key);
      expect(await decide(f, "APPROVE", key)).toEqual(result);
      const row = await collaboration(f);
      const [job] = await jobs(f, "campaigns.application_approved");
      expect(result).toMatchObject({ status: "APPROVED", statusVersion: 2 });
      expect(
        await db.applicationDomainEvent.findUnique({
          where: { transitionId: result.transitionId },
        }),
      ).toMatchObject({ approvedCollaborationId: row.id });
      expect(job).toMatchObject({
        workspaceId: null,
        creatorWorkspaceId: f.owner.workspace.id,
        payload: {
          application_id: f.first.applicationId,
          campaign_id: f.c.campaign.id,
          collaboration_id: row.id,
        },
      });
      expect(job.recipientSnapshots).toHaveLength(1);
      expect(job.snapshotFinalizedAt).not.toBeNull();
      expect(
        await db.applicationCommandReceipt.count({
          where: {
            applicationId: f.first.applicationId,
            commandType: "APPROVE",
          },
        }),
      ).toBe(1);
      expect(await jobs(f, "campaigns.application_approved")).toHaveLength(1);
      expect(
        await h.history.detail(f.owner.user, f.first.applicationId),
      ).toMatchObject({ collaborationId: row.id });
      expect(
        await h.collaboration.provisionFromApprovedApplication(db, {
          applicationId: f.first.applicationId,
          approvalTransitionId: result.transitionId,
        }),
      ).toEqual({ collaborationId: row.id, created: false });
    });
    it("different-key concurrent approvals have one winner", async () => {
      const f = await fixture();
      const results = await Promise.allSettled([decide(f), decide(f)]);
      expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(
        await db.collaboration.count({
          where: { sourceApplicationId: f.first.applicationId },
        }),
      ).toBe(1);
      expect(await jobs(f, "campaigns.application_approved")).toHaveLength(1);
    });
    it("two sibling approvals create distinct Collaborations without inventory or legacy pipeline mutation", async () => {
      const f = await fixture();
      const sibling = await h.submit.submit(
        f.owner.user,
        f.c.campaign.id,
        f.c.selection(1),
        randomUUID(),
      );
      await Promise.all([
        decide(f),
        decide(f, "APPROVE", randomUUID(), sibling.applicationId),
      ]);
      expect(
        await db.collaboration.count({
          where: {
            campaignId: f.c.campaign.id,
            creatorUserId: f.owner.user.id,
          },
        }),
      ).toBe(2);
      expect(
        await db.uceCampaignCollaboration.count({
          where: { campaignId: f.c.campaign.id },
        }),
      ).toBe(0);
      expect(
        await db.uceCampaignProduct.count({
          where: { campaignId: f.c.campaign.id },
        }),
      ).toBe(0);
      expect(
        (await h.history.detail(f.owner.user, sibling.applicationId)).status,
      ).toBe("APPROVED");
    });
    it.each(["provision", "event", "notification"] as const)(
      "%s fault rolls back the complete approval",
      async (boundary) => {
        const f = await fixture();
        const spy =
          boundary === "provision"
            ? vi
                .spyOn(h.collaboration, "provisionFromApprovedApplication")
                .mockRejectedValueOnce(new Error("fixture-provision"))
            : boundary === "notification"
              ? vi
                  .spyOn(h.notifications, "enqueueWithinTransaction")
                  .mockRejectedValueOnce(new Error("fixture-notification"))
              : vi
                  .spyOn(h.collaboration, "provisionFromApprovedApplication")
                  .mockImplementationOnce(async (tx, input) => {
                    const actual = await new (h.collaboration
                      .constructor as typeof import("../collaboration/services/approved-application-collaboration.service").ApprovedApplicationCollaborationService)().provisionFromApprovedApplication(
                      tx,
                      input,
                    );
                    return { ...actual, collaborationId: randomUUID() };
                  });
        try {
          await expect(decide(f)).rejects.toBeDefined();
        } finally {
          spy.mockRestore();
        }
        expect(
          (await h.history.detail(f.owner.user, f.first.applicationId)).status,
        ).toBe("PENDING");
        expect(
          await db.collaboration.count({
            where: { sourceApplicationId: f.first.applicationId },
          }),
        ).toBe(0);
        expect(
          await db.applicationDomainEvent.count({
            where: { applicationId: f.first.applicationId },
          }),
        ).toBe(1);
        expect(
          await db.applicationCommandReceipt.count({
            where: { applicationId: f.first.applicationId },
          }),
        ).toBe(1);
        expect(await jobs(f, "campaigns.application_approved")).toHaveLength(0);
      },
    );
    it("uses the existing Owner and rejects unusable canonical identity without creation", async () => {
      const f = await fixture();
      const counts = [
        await db.user.count(),
        await db.creatorProfile.count(),
        await db.creatorWorkspace.count(),
      ];
      await db.user.update({
        where: { id: f.owner.user.id },
        data: { authState: "DISABLED" },
      });
      await expect(decide(f)).rejects.toMatchObject({
        response: { code: "C03_APPLICATION_CREATOR_IDENTITY_CONFLICT" },
      });
      expect([
        await db.user.count(),
        await db.creatorProfile.count(),
        await db.creatorWorkspace.count(),
      ]).toEqual(counts);
      expect(
        await db.uceApplication.findUnique({
          where: { id: f.first.applicationId },
        }),
      ).toMatchObject({ status: "PENDING" });
    });
    it.each([false, true])(
      "snapshot commercial handoff negotiable=%s, no proposal or escrow split",
      async (negotiable) => {
        const f = await fixture(negotiable);
        await decide(f);
        const row = await collaboration(f);
        expect(row).toMatchObject({
          briefId: null,
          productId: null,
          ucePipelineCollaborationId: null,
          negotiationRound: 0,
          handoffCommercialState: negotiable
            ? "AWAITING_CREATOR_PROPOSAL"
            : "FIXED_AGREED",
        });
        expect(row.commercials?.initialQuote).toBeNull();
        expect(row.commercials?.brandCounterOffer).toBeNull();
        expect(row.commercials?.finalQuote?.toString() ?? null).toBe(
          negotiable ? null : "100",
        );
        expect(row.commercials?.advance30Amount.toString()).toBe("0");
        expect(row.commercials?.balance70Amount.toString()).toBe("0");
        expect(
          await db.collaborationMessage.count({
            where: { collaborationId: row.id },
          }),
        ).toBe(0);
        expect(mapCollaborationDetail(row).thread.brief.internalTitle).toBe(
          "Historical Brief 0",
        );
      },
    );
    it("submitted intent is Brand scoped with an atomic recipient snapshot", async () => {
      const f = await fixture();
      const [job] = await jobs(f, "campaigns.application_received");
      expect(job.workspaceId).toBe(f.brand.brand.id);
      expect(job.creatorWorkspaceId).toBeNull();
      expect(job.recipientSnapshots.map((x) => x.userId)).toEqual([
        f.brand.user.id,
      ]);
      expect(Object.keys(job.payload as object).sort()).toEqual([
        "application_id",
        "campaign_id",
      ]);
    });
    it.each(["APPROVE", "REJECT"] as const)(
      "%s snapshots active Owner/Manager/Assistant, deduplicates IDs, excludes inactive users/members",
      async (kind) => {
        const f = await fixture();
        const manager = await teamFixture(db, f.owner, "MANAGER"),
          assistant = await teamFixture(db, f.owner, "ASSISTANT");
        const inactive = await teamFixture(db, f.owner, "ASSISTANT"),
          provisional = await teamFixture(db, f.owner, "MANAGER");
        await db.creatorWorkspaceMember.update({
          where: { id: inactive.member.id },
          data: { isActive: false },
        });
        await db.user.update({
          where: { id: provisional.user.id },
          data: { authState: "DISABLED" },
        });
        // C-05 already prevents duplicate bound User membership in PostgreSQL.
        // Preserve that guard and prove it cannot duplicate inbox recipients.
        await expect(
          db.creatorWorkspaceMember.create({
            data: {
              workspaceId: f.owner.workspace.id,
              userId: assistant.user.id,
              associatedEmail: `${randomUUID()}@example.test`,
              securityRole: "ASSISTANT",
              isActive: true,
            },
          }),
        ).rejects.toMatchObject({ code: "P2002" });
        await decide(f, kind);
        const eventType =
          kind === "APPROVE"
            ? "campaigns.application_approved"
            : "campaigns.application_rejected";
        const [job] = await jobs(f, eventType);
        expect(job.recipientSnapshots.map((x) => x.userId).sort()).toEqual(
          [f.owner.user.id, manager.user.id, assistant.user.id].sort(),
        );
        expect(
          job.recipientSnapshots.every(
            (x) => x.inboxObligation && x.emailStatus === "NOT_REQUIRED",
          ),
        ).toBe(true);
        const notification = await materialize(f, eventType);
        expect(
          await db.notificationRecipient.count({
            where: { notificationId: notification.id },
          }),
        ).toBe(3);
        expect(
          await db.notificationEmailDelivery.count({
            where: { notificationId: notification.id, status: "PENDING" },
          }),
        ).toBe(0);
        await materialize(f, eventType);
        expect(
          await db.notification.count({
            where: { creatorWorkspaceId: f.owner.workspace.id, eventType },
          }),
        ).toBe(1);
      },
    );
    it.each(["OWNER", "MANAGER", "ASSISTANT"] as const)(
      "%s query and read commands use current scope without Instagram",
      async (role) => {
        const f = await fixture(),
          actor =
            role === "OWNER" ? f.owner : await teamFixture(db, f.owner, role);
        await decide(f);
        const notification = await materialize(f);
        await db.creatorSocialIntegration.update({
          where: { id: f.owner.integration.id },
          data: { disconnectedAt: new Date() },
        });
        expect(
          (await query.listForUser(actor.user, {})).notifications,
        ).toHaveLength(1);
        expect(await query.unreadCount(actor.user)).toEqual({
          unread_count: 1,
        });
        expect(await query.markRead(actor.user, notification.id)).toMatchObject(
          { is_read: true },
        );
        expect(await query.unreadCount(actor.user)).toEqual({
          unread_count: 0,
        });
        const other = await fixture();
        await decide(other);
        const otherNotification = await materialize(other);
        await expect(
          query.markRead(actor.user, otherNotification.id),
        ).rejects.toMatchObject({ status: 404 });
        expect(await query.markAllRead(actor.user)).toEqual({
          updated_count: 0,
        });
        expect(await query.unreadCount(other.owner.user)).toEqual({
          unread_count: 1,
        });
        if (role !== "OWNER") {
          await db.creatorWorkspaceMember.update({
            where: { id: actor.member.id },
            data: { isActive: false },
          });
          await expect(query.listForUser(actor.user, {})).rejects.toBeDefined();
        }
      },
    );
    it("mark-all-read updates only current recipients in the current workspace", async () => {
      const f = await fixture();
      await decide(f);
      await materialize(f);
      expect(await query.markAllRead(f.owner.user)).toEqual({
        updated_count: 1,
      });
      expect(await query.unreadCount(f.owner.user)).toEqual({
        unread_count: 0,
      });
    });
    it.each(["notifications", "notification_jobs"])(
      "%s enforces exactly-one scope directly in PostgreSQL",
      async (table) => {
        const f = await fixture();
        await decide(f);
        const n = await materialize(f);
        const id =
          table === "notifications"
            ? n.id
            : (await jobs(f, "campaigns.application_approved"))[0].id;
        await expect(
          db.$executeRawUnsafe(
            `UPDATE ${table} SET workspace_id = $1 WHERE id = $2`,
            f.brand.brand.id,
            id,
          ),
        ).rejects.toBeDefined();
        await expect(
          db.$executeRawUnsafe(
            `UPDATE ${table} SET creator_workspace_id = NULL WHERE id = $1`,
            id,
          ),
        ).rejects.toBeDefined();
      },
    );
    it("sourceApplication unique FK and immutable lineage are enforced", async () => {
      const f = await fixture();
      await decide(f);
      const row = await collaboration(f);
      await expect(
        db.collaboration.update({
          where: { id: row.id },
          data: { sourceApplicationId: null },
        }),
      ).rejects.toBeDefined();
      await expect(
        db.collaboration.update({
          where: { id: row.id },
          data: { sourceApplicationId: randomUUID() },
        }),
      ).rejects.toBeDefined();
      const data = {
        campaignId: row.campaignId,
        brandProfileId: row.brandProfileId,
        creatorUserId: row.creatorUserId,
        industry: row.industry,
        handoffCommercialState: row.handoffCommercialState,
      };
      await expect(
        db.collaboration.create({
          data: { ...data, sourceApplicationId: row.sourceApplicationId },
        }),
      ).rejects.toBeDefined();
      await expect(
        db.collaboration.create({
          data: { ...data, sourceApplicationId: randomUUID() },
        }),
      ).rejects.toBeDefined();
      await expect(
        db.collaboration.delete({ where: { id: row.id } }),
      ).rejects.toBeDefined();
      await expect(
        db.applicationDomainEvent.updateMany({
          where: { applicationId: f.first.applicationId },
          data: { approvedCollaborationId: randomUUID() },
        }),
      ).rejects.toBeDefined();
    });
    it("semantic uniqueness is per Creator workspace and retains Brand deduplication", async () => {
      const a = await fixture(),
        b = await fixture();
      const source = {
        sourceType: "c03_application",
        sourceId: a.first.applicationId,
        transitionId: randomUUID(),
      };
      const input = {
        eventType: "campaigns.application_rejected" as const,
        source,
        payload: {
          application_id: a.first.applicationId,
          campaign_id: a.c.campaign.id,
        },
      };
      const first = await h.notifications.dispatch({
        ...input,
        creatorWorkspaceId: a.owner.workspace.id,
      });
      expect(
        await h.notifications.dispatch({
          ...input,
          creatorWorkspaceId: a.owner.workspace.id,
        }),
      ).toEqual(first);
      expect(
        await h.notifications.dispatch({
          ...input,
          creatorWorkspaceId: b.owner.workspace.id,
        }),
      ).not.toEqual(first);
      const brandInput = {
        ...input,
        eventType: "campaigns.application_received" as const,
        workspaceId: a.brand.brand.id,
      };
      const brand = await h.notifications.dispatch(brandInput);
      expect(await h.notifications.dispatch(brandInput)).toEqual(brand);
      expect(brand).not.toEqual(first);
    });
    it.each(["notification", "notificationJob"] as const)(
      "%s permits equivalent semantic keys across scope and rejects same-scope duplicates",
      async (model) => {
        const f = await fixture();
        const base = {
          eventType: "campaigns.application_received",
          semanticEventKey: randomUUID(),
          urgencyLevel: "INFORMATIONAL" as const,
          payload: {},
        };
        const create = (scope: {
          workspaceId?: string;
          creatorWorkspaceId?: string;
        }) =>
          model === "notification"
            ? db.notification.create({ data: { ...base, ...scope } })
            : db.notificationJob.create({ data: { ...base, ...scope } });
        const brand = await create({ workspaceId: f.brand.brand.id });
        const creator = await create({
          creatorWorkspaceId: f.owner.workspace.id,
        });
        expect(brand.id).not.toBe(creator.id);
        await expect(
          create({ workspaceId: f.brand.brand.id }),
        ).rejects.toBeDefined();
        await expect(
          create({ creatorWorkspaceId: f.owner.workspace.id }),
        ).rejects.toBeDefined();
      },
    );
    it("PostgreSQL rejects an approval committed without its linked Collaboration", async () => {
      const f = await fixture();
      await expect(
        db.uceApplication.update({
          where: { id: f.first.applicationId },
          data: {
            status: "APPROVED",
            statusVersion: 2,
            terminalAt: new Date(),
          },
        }),
      ).rejects.toBeDefined();
      expect(
        await db.uceApplication.findUnique({
          where: { id: f.first.applicationId },
        }),
      ).toMatchObject({ status: "PENDING" });
    });
    it("approval reads immutable commercial and Brief evidence after current source changes", async () => {
      const f = await fixture();
      const counts = [
        await db.user.count(),
        await db.creatorProfile.count(),
        await db.creatorWorkspace.count(),
      ];
      await db.uceCampaignCommercials.update({
        where: { campaignId: f.c.campaign.id },
        data: { commercialOffer: 999 },
      });
      await db.canonicalCampaignBrief.update({
        where: { id: f.c.briefs[0].id },
        data: { briefName: "Changed current title" },
      });
      await decide(f);
      const row = await collaboration(f);
      expect(row.commercials?.finalQuote?.toString()).toBe("100");
      expect(mapCollaborationDetail(row).thread.brief.internalTitle).toBe(
        "Historical Brief 0",
      );
      expect([
        await db.user.count(),
        await db.creatorProfile.count(),
        await db.creatorWorkspace.count(),
      ]).toEqual(counts);
    });
    it("Reject replay reuses its recipient snapshot and realtime emits once after materialization", async () => {
      const f = await fixture(),
        key = randomUUID();
      expect(await decide(f, "REJECT", key)).toEqual(
        await decide(f, "REJECT", key),
      );
      const emit = vi.fn(),
        to = vi.fn(() => ({ emit }));
      processor.attachServer({ to } as never);
      try {
        await materialize(f, "campaigns.application_rejected");
        await materialize(f, "campaigns.application_rejected");
        expect(to).toHaveBeenCalledWith(`user:${f.owner.user.id}`);
        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit.mock.calls[0][1].payload).toEqual({
          application_id: f.first.applicationId,
          campaign_id: f.c.campaign.id,
        });
      } finally {
        processor.attachServer(null as never);
      }
    });
    it.each(["REJECT", "WITHDRAW"] as const)(
      "approval racing %s has one terminal winner and consistent lineage",
      async (other) => {
        const f = await fixture();
        const results = await Promise.allSettled([
          decide(f),
          other === "REJECT"
            ? decide(f, "REJECT")
            : h.terminal.withdraw(
                f.owner.user,
                f.first.applicationId,
                randomUUID(),
              ),
        ]);
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        const row = await db.uceApplication.findUniqueOrThrow({
          where: { id: f.first.applicationId },
        });
        expect(
          await db.collaboration.count({
            where: { sourceApplicationId: row.id },
          }),
        ).toBe(row.status === "APPROVED" ? 1 : 0);
        expect(
          await db.applicationDomainEvent.count({
            where: { applicationId: row.id, applicationVersion: 2 },
          }),
        ).toBe(1);
      },
    );
    it("worker claims and materializes Creator scope after command commit", async () => {
      const f = await fixture();
      await decide(f);
      const [job] = await jobs(f, "campaigns.application_approved");
      await db.notificationJob.update({
        where: { id: job.id },
        data: { scheduledAt: new Date(0) },
      });
      await new NotificationWorkerService(
        db as PrismaService,
        processor,
      ).pollQueue();
      expect(
        await db.notificationJob.findUnique({ where: { id: job.id } }),
      ).toMatchObject({
        status: "COMPLETED",
        creatorWorkspaceId: f.owner.workspace.id,
        workspaceId: null,
      });
      expect(
        (await query.listForUser(f.owner.user, {})).notifications,
      ).toHaveLength(1);
    });
    it("Submit replay does not duplicate the Brand intent or its recipients", async () => {
      const f = await fixture(),
        key = randomUUID();
      const command = () =>
        h.submit.submit(f.owner.user, f.c.campaign.id, f.c.selection(1), key);
      const first = await command();
      expect(await command()).toEqual(first);
      const rows = await db.notificationJob.findMany({
        where: {
          workspaceId: f.brand.brand.id,
          payload: { path: ["application_id"], equals: first.applicationId },
        },
        include: { recipientSnapshots: true },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].recipientSnapshots).toHaveLength(1);
    });
    it("dispatch rejects scope confusion and unsafe canonical payload", async () => {
      const f = await fixture();
      const input = {
        creatorWorkspaceId: f.owner.workspace.id,
        eventType: "campaigns.application_rejected" as const,
        source: {
          sourceType: "c03_application",
          sourceId: f.first.applicationId,
          transitionId: randomUUID(),
        },
        payload: {
          application_id: f.first.applicationId,
          campaign_id: f.c.campaign.id,
        },
      };
      await expect(
        h.notifications.dispatch({
          ...input,
          payload: { ...input.payload, rejection_note: "private" },
        }),
      ).rejects.toBeDefined();
      await expect(
        h.notifications.dispatch({
          ...input,
          workspaceId: f.brand.brand.id,
        } as never),
      ).rejects.toBeDefined();
      await expect(
        h.notifications.dispatch({
          ...input,
          creatorWorkspaceId: undefined,
        } as never),
      ).rejects.toBeDefined();
    });
  },
);
