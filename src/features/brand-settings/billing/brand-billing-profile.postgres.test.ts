import { ForbiddenException } from "@nestjs/common";
import { BrandRole, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { PricingInvoiceService } from "../../pricing/services/pricing-invoice.service";
import type { PricingRazorpayClient } from "../../pricing/services/pricing-razorpay.client";
import type { BrandSettingsAccessService } from "../services/brand-settings-access.service";
import { BrandSettingsService } from "../services/brand-settings.service";
import type { BrandTeamInvitationsService } from "../services/brand-team-invitations.service";
import type { BrandTeamService } from "../services/brand-team.service";

describe.skipIf(process.env.BS03_DATABASE_TEST !== "true")(
  "BS-03 disposable PostgreSQL",
  () => {
    const prisma = new PrismaClient();
    let role = BrandRole.BRAND_OWNER;
    let organizationId: string;
    let brandProfileId: string;
    let subscriptionId: string;
    const user = {
      id: "bs03-test-user",
      email: "bs03@example.test",
    } as AuthUser;
    const access = {
      resolveBrandContext: async () => ({
        brandProfileId,
        membership: { role },
      }),
      assertFinancialMutation(requestedRole: BrandRole) {
        if (requestedRole === BrandRole.CAMPAIGN_MANAGER)
          throw new ForbiddenException("Read-only");
      },
      isFinancialReadOnly: (requestedRole: BrandRole) =>
        requestedRole === BrandRole.CAMPAIGN_MANAGER,
    } as unknown as BrandSettingsAccessService;
    const service = new BrandSettingsService(
      prisma as unknown as PrismaService,
      access,
      {} as BrandTeamService,
      {} as BrandTeamInvitationsService,
    );

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/bs03_")
      )
        throw new Error("BS-03 requires a disposable loopback bs03_* database");

      const organization = await prisma.organization.create({
        data: { name: "Operational Workspace Only" },
      });
      organizationId = organization.id;
      const brand = await prisma.brandProfile.create({
        data: {
          name: "Protected Brand Identity",
          organizationId,
          domain: "bs03.example.test",
          industry: "D2C",
          countryCode: "IN",
          currencyCode: "INR",
        },
      });
      brandProfileId = brand.id;
      const subscription = await prisma.brandSubscription.create({
        data: {
          brandProfileId,
          razorpaySubscriptionId: "sub_bs03",
          currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
        },
      });
      subscriptionId = subscription.id;
    });

    afterAll(async () => {
      if (brandProfileId)
        await prisma.brandProfile.delete({ where: { id: brandProfileId } });
      if (organizationId)
        await prisma.organization.delete({ where: { id: organizationId } });
      await prisma.$disconnect();
    });

    it("persists independent country, CONFIGURED then UPDATED, without legacy writes", async () => {
      role = BrandRole.BRAND_OWNER;
      const created = await service.upsertBillingProfile(user, {
        legalEntityName: "Acme LLC",
        legalEntityType: "LLC",
        billingCountryCode: "IN",
        billingAddress: "100 Main Street, Wilmington, DE",
        gstin: "27ABCDE1234F1Z5",
      });
      expect(created.profile_state).toBe("CONFIGURED");
      expect(created.is_complete_for_paid_conversion).toBe(true);

      role = BrandRole.FINANCE_ADMIN;
      const updated = await service.upsertBillingProfile(user, {
        legalEntityName: "Acme Corporation",
        legalEntityType: "Corporation",
        billingCountryCode: "US",
        billingAddress: "100 Main Street, Wilmington, DE",
        gstin: null,
      });
      expect(updated.profile_state).toBe("UPDATED");

      const countAfterMaterialUpdate =
        await prisma.brandBillingProfileVersion.count({
          where: { brandProfileId },
        });
      await service.upsertBillingProfile(user, {
        legalEntityName: "Acme Corporation",
        legalEntityType: "Corporation",
        billingCountryCode: "US",
        billingAddress: "100 Main Street, Wilmington, DE",
        gstin: null,
      });
      expect(
        await prisma.brandBillingProfileVersion.count({
          where: { brandProfileId },
        }),
      ).toBe(countAfterMaterialUpdate);

      const [billing, brand] = await Promise.all([
        prisma.brandBillingProfile.findUniqueOrThrow({
          where: { brandProfileId },
        }),
        prisma.brandProfile.findUniqueOrThrow({
          where: { id: brandProfileId },
        }),
      ]);
      expect(billing.billingCountryCode).toBe("US");
      expect(brand.countryCode).toBe("IN");
      expect(brand.name).toBe("Protected Brand Identity");
      expect(billing.pan).toBeNull();
      expect(billing.defaultTdsPercentage.toNumber()).toBe(2);
      expect(billing.currencyPreference).toBe("INR");
      const versions = await prisma.brandBillingProfileVersion.findMany({
        where: { brandProfileId },
        orderBy: { createdAt: "asc" },
      });
      expect(versions).toHaveLength(2);
      expect(versions[0]).toMatchObject({
        legalEntityName: "Acme LLC",
        billingCountryCode: "IN",
        gstin: "27ABCDE1234F1Z5",
      });
      expect(versions[1]).toMatchObject({
        legalEntityName: "Acme Corporation",
        billingCountryCode: "US",
        gstin: null,
      });
    });

    it("resolves immutable invoice snapshots by issuedAt without current-profile fallback", async () => {
      const versions = await prisma.brandBillingProfileVersion.findMany({
        where: { brandProfileId },
        orderBy: { createdAt: "asc" },
      });
      const effectiveA = new Date("2026-08-01T00:00:00.000Z");
      const effectiveB = new Date("2026-08-03T00:00:00.000Z");
      await prisma.brandBillingProfileVersion.update({
        where: { id: versions[0].id },
        data: { effectiveFrom: effectiveA },
      });
      await prisma.brandBillingProfileVersion.update({
        where: { id: versions[1].id },
        data: { effectiveFrom: effectiveB },
      });
      const invoices = new PricingInvoiceService(
        prisma as unknown as PrismaService,
        {} as PricingRazorpayClient,
      );
      const base = {
        subscription_id: "sub_bs03",
        amount: 1000,
        amount_paid: 0,
        currency: "USD",
        status: "issued",
      };

      await invoices.upsertFromRazorpayEntity({
        brandProfileId,
        brandSubscriptionId: subscriptionId,
        razorpaySubscriptionId: "sub_bs03",
        invoice: {
          ...base,
          id: "inv_before_change",
          issued_at: Date.parse("2026-08-02T00:00:00.000Z") / 1000,
        },
      });
      const before = await prisma.brandBillingInvoice.findUniqueOrThrow({
        where: { razorpayInvoiceId: "inv_before_change" },
      });
      expect(before).toMatchObject({
        billingProfileVersionId: versions[0].id,
        billingLegalEntityName: "Acme LLC",
        billingGstin: "27ABCDE1234F1Z5",
      });

      await invoices.upsertFromRazorpayEntity({
        brandProfileId,
        brandSubscriptionId: subscriptionId,
        razorpaySubscriptionId: "sub_bs03",
        invoice: {
          ...base,
          id: "inv_before_change",
          status: "paid",
          amount_paid: 1000,
          issued_at: Date.parse("2026-08-02T00:00:00.000Z") / 1000,
        },
      });
      expect(
        await prisma.brandBillingInvoice.findUniqueOrThrow({
          where: { razorpayInvoiceId: "inv_before_change" },
        }),
      ).toMatchObject({
        status: "paid",
        billingProfileVersionId: versions[0].id,
        billingLegalEntityName: "Acme LLC",
      });

      await invoices.upsertFromRazorpayEntity({
        brandProfileId,
        brandSubscriptionId: subscriptionId,
        razorpaySubscriptionId: "sub_bs03",
        invoice: {
          ...base,
          id: "inv_after_change",
          issued_at: Date.parse("2026-08-05T00:00:00.000Z") / 1000,
        },
      });
      expect(
        await prisma.brandBillingInvoice.findUniqueOrThrow({
          where: { razorpayInvoiceId: "inv_after_change" },
        }),
      ).toMatchObject({
        billingProfileVersionId: versions[1].id,
        billingLegalEntityName: "Acme Corporation",
        billingGstin: null,
      });

      await invoices.upsertFromRazorpayEntity({
        brandProfileId,
        brandSubscriptionId: subscriptionId,
        razorpaySubscriptionId: "sub_bs03",
        invoice: {
          ...base,
          id: "inv_no_history",
          issued_at: Date.parse("2026-07-01T00:00:00.000Z") / 1000,
        },
      });
      expect(
        await prisma.brandBillingInvoice.findUniqueOrThrow({
          where: { razorpayInvoiceId: "inv_no_history" },
        }),
      ).toMatchObject({
        billingProfileVersionId: null,
        billingLegalEntityName: null,
      });

      const invoiceViews = new PricingInvoiceService(
        prisma as unknown as PrismaService,
        {
          listSubscriptionInvoices: async () => [
            {
              ...base,
              id: "inv_before_change",
              issued_at: Date.parse("2026-08-02T00:00:00.000Z") / 1000,
            },
            {
              ...base,
              id: "provider_only_invoice",
              issued_at: Date.parse("2026-08-02T00:00:00.000Z") / 1000,
            },
          ],
        } as unknown as PricingRazorpayClient,
      );
      const views = await invoiceViews.listInvoicesForBrand(brandProfileId);
      expect(
        views.find((invoice) => invoice.id === "inv_before_change"),
      ).toMatchObject({
        historicalBillingIdentityAvailable: true,
        billingIdentity: {
          legalEntityName: "Acme LLC",
          gstin: "27ABCDE1234F1Z5",
        },
      });
      expect(
        views.find((invoice) => invoice.id === "provider_only_invoice"),
      ).toMatchObject({
        historicalBillingIdentityAvailable: false,
        billingIdentity: null,
      });
    });

    it("keeps Campaign Manager reads read-only and denies mutation", async () => {
      role = BrandRole.CAMPAIGN_MANAGER;
      await expect(service.getBillingProfile(user)).resolves.toMatchObject({
        is_read_only: true,
        profile_state: "UPDATED",
      });
      await expect(
        service.upsertBillingProfile(user, {
          legalEntityName: "Denied Entity",
          legalEntityType: "Corporation",
          billingCountryCode: "US",
          billingAddress: "100 Main Street, Wilmington, DE",
          gstin: null,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("reads a legacy row as incomplete without Organization-name fallback", async () => {
      await prisma.brandBillingProfile.delete({ where: { brandProfileId } });
      await prisma.brandBillingProfile.create({
        data: {
          brandProfileId,
          registeredCompanyName: "Legacy Legal Name",
          corporateBillingAddress: "Legacy billing address",
          legalEntityType: null,
          billingCountryCode: null,
        },
      });
      role = BrandRole.BRAND_OWNER;
      const response = await service.getBillingProfile(user);
      expect(response.billing_profile).toMatchObject({
        legal_entity_name: "Legacy Legal Name",
        legal_entity_type: null,
        billing_country_code: null,
      });
      expect(response.missing_required_fields).toEqual([
        "legal_entity_type",
        "billing_country_code",
      ]);
      expect(response.billing_profile?.legal_entity_name).not.toBe(
        "Operational Workspace Only",
      );
    });
  },
);
