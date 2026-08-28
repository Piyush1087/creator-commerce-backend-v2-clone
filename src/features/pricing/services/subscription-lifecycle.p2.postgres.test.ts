import { PrismaClient, SubscriptionStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.skipIf(process.env.BS08_DATABASE_TEST !== "true")(
  "BS-08 P2 disposable PostgreSQL lifecycle persistence",
  () => {
    const prisma = new PrismaClient();
    let organizationId: string;
    let brandProfileId: string;

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/bs08_")
      ) {
        throw new Error("BS-08 requires a disposable loopback bs08_* database");
      }

      const organization = await prisma.organization.create({
        data: { name: "BS08 Lifecycle Workspace" },
      });
      organizationId = organization.id;
      const brand = await prisma.brandProfile.create({
        data: {
          name: "BS08 Lifecycle Brand",
          organizationId,
          domain: "bs08-lifecycle.example.test",
          industry: "D2C",
          countryCode: "US",
          currencyCode: "USD",
        },
      });
      brandProfileId = brand.id;
      await prisma.brandSubscription.create({
        data: {
          brandProfileId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
        },
      });
    });

    afterAll(async () => {
      if (brandProfileId) {
        await prisma.brandProfile.delete({ where: { id: brandProfileId } });
      }
      if (organizationId) {
        await prisma.organization.delete({ where: { id: organizationId } });
      }
      await prisma.$disconnect();
    });

    it("persists first-failure grace metadata without timestamp fabrication", async () => {
      const firstFailure = new Date("2026-08-25T00:00:00.000Z");
      const graceEnd = new Date("2026-09-01T00:00:00.000Z");
      await prisma.brandSubscription.update({
        where: { brandProfileId },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          providerStatus: "halted",
          firstPaymentFailureAt: firstFailure,
          paymentGraceEndsAt: graceEnd,
        },
      });
      const stored = await prisma.brandSubscription.findUniqueOrThrow({
        where: { brandProfileId },
      });
      expect(stored).toMatchObject({
        status: SubscriptionStatus.PAST_DUE,
        providerStatus: "halted",
        firstPaymentFailureAt: firstFailure,
        paymentGraceEndsAt: graceEnd,
      });
    });

    it("persists end-of-cycle cancellation metadata", async () => {
      const scheduledAt = new Date("2026-08-28T00:00:00.000Z");
      const effectiveAt = new Date("2026-09-01T00:00:00.000Z");
      const stored = await prisma.brandSubscription.update({
        where: { brandProfileId },
        data: {
          status: SubscriptionStatus.CANCEL_SCHEDULED,
          cancelScheduledAt: scheduledAt,
          cancelEffectiveAt: effectiveAt,
        },
      });
      expect(stored).toMatchObject({
        status: SubscriptionStatus.CANCEL_SCHEDULED,
        cancelScheduledAt: scheduledAt,
        cancelEffectiveAt: effectiveAt,
      });
    });
  },
);
