import { BrandRole, PrismaClient, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrandTeamService } from "../brand-settings/services/brand-team.service";
import { NotificationDispatchService } from "./services/notification-dispatch.service";
import { NotificationRecipientPolicyService } from "./services/notification-recipient-policy.service";

const suite =
  process.env.RUN_P2B_POSTGRES_TESTS === "true" ? describe : describe.skip;

suite("BS-05 P2B Team producer transaction", () => {
  const db = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const organizationId = `p2b-org-${suffix}`;
  const brandId = `p2b-brand-${suffix}`;
  const ownerId = `p2b-owner-${suffix}`;
  const targetId = `p2b-target-${suffix}`;
  const rollbackId = `p2b-rollback-${suffix}`;
  const actor = {
    id: ownerId,
    email: `${ownerId}@example.com`,
    name: null,
    role: UserRole.BRAND,
    organizationId,
  };
  let team: BrandTeamService;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !url.pathname.startsWith("/p2b_")
    ) {
      throw new Error("P2B requires a disposable loopback p2b_* database");
    }
    await db.organization.create({
      data: { id: organizationId, name: "P2B", kind: "BRAND" },
    });
    await db.brandProfile.create({
      data: {
        id: brandId,
        organizationId,
        domain: `${brandId}.example`,
        name: "P2B",
        industry: "UNKNOWN",
        brandValues: [],
        policyFlags: [],
      },
    });
    await db.user.createMany({
      data: [ownerId, targetId, rollbackId].map((id) => ({
        id,
        email: `${id}@example.com`,
        role: UserRole.BRAND,
        organizationId,
      })),
    });
    await db.brandTeamMember.createMany({
      data: [
        {
          brandProfileId: brandId,
          userId: ownerId,
          role: BrandRole.BRAND_OWNER,
        },
        {
          brandProfileId: brandId,
          userId: targetId,
          role: BrandRole.CAMPAIGN_MANAGER,
        },
        {
          brandProfileId: brandId,
          userId: rollbackId,
          role: BrandRole.CAMPAIGN_MANAGER,
        },
      ],
    });
    const dispatch = new NotificationDispatchService(
      db as never,
      new NotificationRecipientPolicyService(db as never),
    );
    team = new BrandTeamService(
      db as never,
      {
        resolveBrandContext: async () => ({ brandProfileId: brandId }),
      } as never,
      dispatch,
    );
  });

  afterAll(async () => {
    await db.notificationJob.deleteMany({ where: { workspaceId: brandId } });
    await db.brandProfile.delete({ where: { id: brandId } });
    await db.user.deleteMany({
      where: { id: { in: [ownerId, targetId, rollbackId] } },
    });
    await db.organization.delete({ where: { id: organizationId } });
    await db.$disconnect();
  });

  it("creates one mandatory email-only snapshot and a distinct later revoke cycle", async () => {
    const membership = await db.brandTeamMember.findUniqueOrThrow({
      where: {
        brandProfileId_userId: { brandProfileId: brandId, userId: targetId },
      },
    });
    await team.revoke(actor, membership.id);
    let jobs = await db.notificationJob.findMany({
      where: { workspaceId: brandId, eventType: "team.member_access_revoked" },
      include: { recipientSnapshots: true },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].recipientSnapshots).toEqual([
      expect.objectContaining({
        userId: targetId,
        inboxObligation: false,
        emailStatus: "PENDING",
      }),
    ]);

    await db.brandTeamMember.update({
      where: { id: membership.id },
      data: { isActive: true },
    });
    await team.revoke(actor, membership.id);
    jobs = await db.notificationJob.findMany({
      where: { workspaceId: brandId, eventType: "team.member_access_revoked" },
    });
    expect(jobs).toHaveLength(2);
  });

  it("rolls back revocation when notification intent creation fails", async () => {
    const membership = await db.brandTeamMember.findUniqueOrThrow({
      where: {
        brandProfileId_userId: { brandProfileId: brandId, userId: rollbackId },
      },
    });
    const failing = new BrandTeamService(
      db as never,
      {
        resolveBrandContext: async () => ({ brandProfileId: brandId }),
      } as never,
      {
        enqueueWithinTransaction: async () => {
          throw new Error("forced notification failure");
        },
      } as never,
    );
    await expect(failing.revoke(actor, membership.id)).rejects.toThrow(
      "forced notification failure",
    );
    await expect(
      db.brandTeamMember.findUniqueOrThrow({ where: { id: membership.id } }),
    ).resolves.toMatchObject({ isActive: true });
  });
});
