import { BrandRole, PrismaClient, UserRole } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotificationDispatchService } from "./services/notification-dispatch.service";
import { NotificationProcessorService } from "./services/notification-processor.service";
import { NotificationRecipientPolicyService } from "./services/notification-recipient-policy.service";

const enabled = process.env.RUN_NOTIFICATION_POSTGRES_TESTS === "true";
const suite = enabled ? describe : describe.skip;

suite("BS-05 P1C1 immutable notification intent", () => {
  const db = new PrismaClient({
    transactionOptions: { maxWait: 10_000, timeout: 10_000 },
  });
  const suffix = randomUUID().slice(0, 8);
  const brandA = `bs05-a-${suffix}`;
  const brandB = `bs05-b-${suffix}`;
  const owner = `bs05-owner-${suffix}`;
  const managerB = `bs05-manager-b-${suffix}`;
  const managerC = `bs05-manager-c-${suffix}`;
  const outsider = `bs05-outsider-${suffix}`;
  let dispatch: NotificationDispatchService;
  let processor: NotificationProcessorService;

  beforeAll(async () => {
    await db.brandProfile.createMany({
      data: [
        {
          id: brandA,
          domain: `${brandA}.example`,
          name: "A",
          industry: "UNKNOWN",
          brandValues: [],
          policyFlags: [],
        },
        {
          id: brandB,
          domain: `${brandB}.example`,
          name: "B",
          industry: "UNKNOWN",
          brandValues: [],
          policyFlags: [],
        },
      ],
    });
    await db.user.createMany({
      data: [owner, managerB, managerC, outsider].map((id) => ({
        id,
        email: `${id}@example.com`,
        role: UserRole.BRAND,
      })),
    });
    await db.brandTeamMember.createMany({
      data: [
        { brandProfileId: brandA, userId: owner, role: BrandRole.BRAND_OWNER },
        {
          brandProfileId: brandA,
          userId: managerB,
          role: BrandRole.CAMPAIGN_MANAGER,
        },
        {
          brandProfileId: brandB,
          userId: outsider,
          role: BrandRole.CAMPAIGN_MANAGER,
        },
      ],
    });
    const resolver = new NotificationRecipientPolicyService(db as never);
    dispatch = new NotificationDispatchService(db as never, resolver);
    processor = new NotificationProcessorService(db as never);
  });

  afterAll(async () => {
    await db.notificationJob.deleteMany({
      where: { workspaceId: { in: [brandA, brandB] } },
    });
    await db.brandProfile.deleteMany({
      where: { id: { in: [brandA, brandB] } },
    });
    await db.user.deleteMany({
      where: { id: { in: [owner, managerB, managerC, outsider] } },
    });
    await db.$disconnect();
  });

  it("freezes recipients and optional-email decisions before membership/preferences change", async () => {
    const intent = await dispatch.dispatch({
      workspaceId: brandA,
      eventType: "campaigns.application_received",
      source: {
        sourceType: "application",
        sourceId: `app-${suffix}`,
        transitionId: "received",
      },
      payload: {},
      triggerUserId: managerB,
    });
    await db.userBrandNotificationPreference.create({
      data: {
        brandProfileId: brandA,
        userId: managerB,
        category: "CAMPAIGNS_APPLICATIONS",
        optionalEmailEnabled: false,
      },
    });
    await db.brandTeamMember.update({
      where: {
        brandProfileId_userId: { brandProfileId: brandA, userId: managerB },
      },
      data: { isActive: false },
    });
    await db.brandTeamMember.create({
      data: {
        brandProfileId: brandA,
        userId: managerC,
        role: BrandRole.CAMPAIGN_MANAGER,
      },
    });
    const job = await db.notificationJob.findUniqueOrThrow({
      where: { id: intent.job_id },
    });
    await processor.processJob({
      id: job.id,
      workspaceId: job.workspaceId,
      eventType: job.eventType,
      semanticEventKey: job.semanticEventKey,
      claimToken: "test",
      triggerUserId: job.triggerUserId,
      payload: job.payload as Record<string, unknown>,
      actorName: job.actorName,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    });
    await processor.processJob({
      id: job.id,
      workspaceId: job.workspaceId,
      eventType: job.eventType,
      semanticEventKey: job.semanticEventKey,
      claimToken: "test",
      triggerUserId: job.triggerUserId,
      payload: job.payload as Record<string, unknown>,
      actorName: job.actorName,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    });
    const notification = await db.notification.findFirstOrThrow({
      where: { semanticEventKey: job.semanticEventKey },
    });
    const recipients = await db.notificationRecipient.findMany({
      where: { notificationId: notification.id },
    });
    const deliveries = await db.notificationEmailDelivery.findMany({
      where: { notificationId: notification.id },
    });
    expect(recipients.map((row) => row.userId).sort()).toEqual(
      [managerB, owner].sort(),
    );
    expect(deliveries.map((row) => [row.userId, row.status]).sort()).toEqual(
      [
        [managerB, "PENDING"],
        [owner, "PENDING"],
      ].sort(),
    );
    expect(recipients.some((row) => row.userId === managerC)).toBe(false);
  });

  it("rejects email-only affected users without a membership in that Brand", async () => {
    await expect(
      dispatch.dispatch({
        workspaceId: brandA,
        eventType: "team.member_access_revoked",
        source: {
          sourceType: "membership",
          sourceId: outsider,
          transitionId: "revoked",
        },
        payload: {},
        affectedUserId: outsider,
      }),
    ).rejects.toThrow("NOTIFICATION_AFFECTED_USER_WORKSPACE_MISMATCH");
    expect(
      await db.notificationJob.count({
        where: { workspaceId: brandA, eventType: "team.member_access_revoked" },
      }),
    ).toBe(0);

    const allowed = await dispatch.dispatch({
      workspaceId: brandA,
      eventType: "team.member_access_revoked",
      source: {
        sourceType: "membership",
        sourceId: managerB,
        transitionId: "revoked",
      },
      payload: {},
      affectedUserId: managerB,
    });
    expect(
      await db.notificationJobRecipient.findMany({
        where: { jobId: allowed.job_id },
      }),
    ).toMatchObject([
      { userId: managerB, inboxObligation: false, emailStatus: "PENDING" },
    ]);
  });

  it("concurrently accepts one semantic intent and one immutable snapshot", async () => {
    const input = {
      workspaceId: brandA,
      eventType: "billing.subscription_payment_failed" as const,
      source: {
        sourceType: "payment",
        sourceId: `race-${suffix}`,
        transitionId: "failed",
      },
      payload: {},
    };
    const [a, b] = await Promise.all([
      dispatch.dispatch(input),
      dispatch.dispatch(input),
    ]);
    expect(a.job_id).toBe(b.job_id);
    expect(await db.notificationJob.count({ where: { id: a.job_id } })).toBe(1);
    expect(
      await db.notificationJobRecipient.count({ where: { jobId: a.job_id } }),
    ).toBe(1);
  });

  it("keeps optional email off even when preference turns on before processing", async () => {
    await db.brandTeamMember.update({
      where: {
        brandProfileId_userId: { brandProfileId: brandA, userId: managerB },
      },
      data: { isActive: true },
    });
    await db.userBrandNotificationPreference.upsert({
      where: {
        brandProfileId_userId_category: {
          brandProfileId: brandA,
          userId: managerB,
          category: "CAMPAIGNS_APPLICATIONS",
        },
      },
      create: {
        brandProfileId: brandA,
        userId: managerB,
        category: "CAMPAIGNS_APPLICATIONS",
        optionalEmailEnabled: false,
      },
      update: { optionalEmailEnabled: false },
    });
    const intent = await dispatch.dispatch({
      workspaceId: brandA,
      eventType: "campaigns.application_received",
      source: {
        sourceType: "application",
        sourceId: `app-off-${suffix}`,
        transitionId: "received",
      },
      payload: {},
    });
    await db.userBrandNotificationPreference.update({
      where: {
        brandProfileId_userId_category: {
          brandProfileId: brandA,
          userId: managerB,
          category: "CAMPAIGNS_APPLICATIONS",
        },
      },
      data: { optionalEmailEnabled: true },
    });
    const job = await db.notificationJob.findUniqueOrThrow({
      where: { id: intent.job_id },
    });
    await processor.processJob({
      id: job.id,
      workspaceId: job.workspaceId,
      eventType: job.eventType,
      semanticEventKey: job.semanticEventKey,
      claimToken: "test",
      triggerUserId: job.triggerUserId,
      payload: job.payload as Record<string, unknown>,
      actorName: job.actorName,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    });
    const notification = await db.notification.findFirstOrThrow({
      where: { semanticEventKey: job.semanticEventKey },
    });
    expect(
      await db.notificationEmailDelivery.findUniqueOrThrow({
        where: {
          notificationId_userId: {
            notificationId: notification.id,
            userId: managerB,
          },
        },
      }),
    ).toMatchObject({ status: "NOT_REQUIRED" });
  });

  it("rolls back notification, recipients, and deliveries as one materialization", async () => {
    const intent = await dispatch.dispatch({
      workspaceId: brandA,
      eventType: "billing.invoice_ready",
      source: {
        sourceType: "invoice",
        sourceId: `invoice-${suffix}`,
        transitionId: "ready",
      },
      payload: {},
    });
    const job = await db.notificationJob.findUniqueOrThrow({
      where: { id: intent.job_id },
    });
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION bs05_fail_delivery() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'forced delivery failure'; END; $$ LANGUAGE plpgsql`);
    await db.$executeRawUnsafe(`CREATE TRIGGER bs05_fail_delivery_trigger
      BEFORE INSERT ON notification_email_deliveries
      FOR EACH ROW EXECUTE FUNCTION bs05_fail_delivery()`);
    const input = {
      id: job.id,
      workspaceId: job.workspaceId,
      eventType: job.eventType,
      semanticEventKey: job.semanticEventKey,
      claimToken: "test",
      triggerUserId: job.triggerUserId,
      payload: job.payload as Record<string, unknown>,
      actorName: job.actorName,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    };
    await expect(processor.processJob(input)).rejects.toThrow(
      "forced delivery failure",
    );
    expect(
      await db.notification.count({
        where: { semanticEventKey: job.semanticEventKey },
      }),
    ).toBe(0);
    await db.$executeRawUnsafe(
      "DROP TRIGGER bs05_fail_delivery_trigger ON notification_email_deliveries",
    );
    await db.$executeRawUnsafe("DROP FUNCTION bs05_fail_delivery()");
    await processor.processJob(input);
    expect(
      await db.notification.count({
        where: { semanticEventKey: job.semanticEventKey },
      }),
    ).toBe(1);
  });

  it("supports enqueue in the authoritative transaction and rolls back together", async () => {
    const sourceId = `tx-${suffix}`;
    await expect(
      db.$transaction(async (tx) => {
        await tx.brandProfile.update({
          where: { id: brandA },
          data: { tagline: "must rollback" },
        });
        await dispatch.enqueueWithinTransaction(tx, {
          workspaceId: brandA,
          eventType: "billing.invoice_ready",
          source: { sourceType: "fixture", sourceId, transitionId: "ready" },
          payload: {},
        });
        throw new Error("fixture rollback");
      }),
    ).rejects.toThrow("fixture rollback");
    expect(
      (await db.brandProfile.findUniqueOrThrow({ where: { id: brandA } }))
        .tagline,
    ).toBeNull();
    const semanticEventKey = createHash("sha256")
      .update(JSON.stringify(["fixture", sourceId, "ready"]))
      .digest("hex");
    expect(
      await db.notificationJob.count({
        where: {
          workspaceId: brandA,
          eventType: "billing.invoice_ready",
          semanticEventKey,
        },
      }),
    ).toBe(0);
  });
});
