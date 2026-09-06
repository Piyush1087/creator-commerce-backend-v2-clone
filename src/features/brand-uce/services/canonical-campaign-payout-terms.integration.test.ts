import { IndustryVertical, UcePayoutTerms } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { CanonicalCampaignCreateService } from "./canonical-campaign-create.service";

const runPostgres = process.env.CAMPAIGN_POSTGRES_INTEGRATION === "1";
const describePostgres = runPostgres ? describe : describe.skip;
const canonicalTerms = [
  "NET_7",
  "NET_15",
  "NET_30",
  "NET_45",
  "NET_60",
] as const;

function payload(payoutTerm: (typeof canonicalTerms)[number]) {
  return {
    strategy: {
      campaign_name: `BP-G05 ${payoutTerm}`,
      publishing_schedule: "EVERGREEN",
      publish_from: null,
      publish_until: null,
      core_objective: "PULSE",
      platforms: ["INSTAGRAM"],
      campaign_visibility: "PUBLIC",
    },
    targeting: {
      creator_archetypes: ["EDUCATOR"],
      minimum_followers: 1_000,
      maximum_followers: 10_000,
      audience_age_min: 18,
      audience_age_max: 35,
      audience_gender: "ALL",
      audience_affinity_ids: ["SKINCARE"],
      audience_geographies: [
        {
          scope: "COUNTRY",
          label: "India",
          country_code: "IN",
          locality: null,
          region: null,
          radius_km: null,
          is_primary: true,
        },
      ],
    },
    commercials: {
      receives_brand_support: false,
      brand_support_type: null,
      brand_support_estimated_value: null,
      compensation_model: "FIXED",
      commercial_offer: 1_000,
      total_campaign_budget: 10_000,
      advance_payment_percentage: 25,
      payout_terms: payoutTerm,
    },
  };
}

describePostgres("Campaign BP-G05 PostgreSQL persistence", () => {
  const prisma = new PrismaService();
  const brandProfileId = "bp-g05-brand";
  const readService = {
    getCampaignShell: async (_brandProfileId: string, campaignId: string) =>
      prisma.uceCampaign.findUniqueOrThrow({
        where: { id: campaignId },
        include: { commercials: true },
      }),
  };
  const service = new CanonicalCampaignCreateService(
    prisma,
    readService as never,
  );

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.brandProfile.create({
      data: {
        id: brandProfileId,
        domain: "bp-g05.local.test",
        name: "BP-G05",
        industry: IndustryVertical.D2C,
        countryCode: "IN",
        brandValues: [],
        policyFlags: [],
      },
    });
  });

  afterAll(async () => {
    await prisma.brandProfile.deleteMany({ where: { id: brandProfileId } });
    await prisma.$disconnect();
  });

  it.each(canonicalTerms)(
    "round-trips %s through service, PostgreSQL, canonical definition, and readback",
    async (term) => {
      const draft = await service.createDraft(brandProfileId);
      await service.publishDraft(
        brandProfileId,
        draft.campaignId,
        payload(term),
      );
      const readback = await readService.getCampaignShell(
        brandProfileId,
        draft.campaignId,
      );
      const rows = await prisma.$queryRaw<
        Array<{
          relational_value: UcePayoutTerms;
          canonical_value: string;
        }>
      >`
        SELECT commercials."final_balance_terms" AS relational_value,
               campaign."canonical_definition" #>> '{commercials,payout_terms}' AS canonical_value
        FROM "uce_campaigns" AS campaign
        JOIN "uce_campaign_commercials" AS commercials
          ON commercials."campaign_id" = campaign."id"
        WHERE campaign."id" = ${draft.campaignId}
      `;

      expect(rows).toEqual([{ relational_value: term, canonical_value: term }]);
      expect(readback.commercials?.finalBalanceTerms).toBe(term);
      if (term === "NET_45" || term === "NET_60") {
        expect(rows[0]?.relational_value).not.toBe(UcePayoutTerms.NET_30);
      }
    },
  );

  it("reconciles only historical rows with exact canonical evidence", async () => {
    const fixtures = [
      ["bp-g05-reconcile-45", "NET_45"],
      ["bp-g05-reconcile-60", "NET_60"],
      ["bp-g05-reconcile-unknown", null],
    ] as const;

    for (const [campaignId, canonicalTerm] of fixtures) {
      await prisma.uceCampaign.create({
        data: {
          id: campaignId,
          brandProfileId,
          name: campaignId,
          status: "PUBLISHED",
          commercials: {
            create: {
              compensationType: "FIXED_FEE",
              totalCampaignBudgetPool: 1_000,
              finalBalanceTerms: UcePayoutTerms.NET_30,
            },
          },
        },
      });
      await prisma.$executeRaw`
        UPDATE "uce_campaigns"
        SET "canonical_definition" = ${JSON.stringify({
          version: "1.2",
          creationSource: "MANUAL",
          commercials: canonicalTerm ? { payout_terms: canonicalTerm } : {},
        })}::jsonb
        WHERE "id" = ${campaignId}
      `;
    }

    const migrationSql = readFileSync(
      resolve(
        process.cwd(),
        "prisma/migrations/20260910121000_campaign_bp_g05_reconcile_exact_payout_terms/migration.sql",
      ),
      "utf8",
    );
    const statements = migrationSql
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }

    const rows = await prisma.uceCampaignCommercials.findMany({
      where: { campaignId: { in: fixtures.map(([campaignId]) => campaignId) } },
      orderBy: { campaignId: "asc" },
      select: { campaignId: true, finalBalanceTerms: true },
    });
    expect(rows).toEqual([
      {
        campaignId: "bp-g05-reconcile-45",
        finalBalanceTerms: UcePayoutTerms.NET_45,
      },
      {
        campaignId: "bp-g05-reconcile-60",
        finalBalanceTerms: UcePayoutTerms.NET_60,
      },
      {
        campaignId: "bp-g05-reconcile-unknown",
        finalBalanceTerms: UcePayoutTerms.NET_30,
      },
    ]);
  });
});
