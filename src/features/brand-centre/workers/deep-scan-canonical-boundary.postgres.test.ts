import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { BrandVisualStateService } from "../../brand-canonical-state/brand-visual-state.service";
import { DeepScanWorker } from "./deep-scan.worker";

describe.skipIf(process.env.BRAND_CENTRE_DATABASE_TEST !== "true")(
  "Deep scan canonical visual boundary PostgreSQL",
  () => {
    const prisma = new PrismaClient();
    const db = prisma as unknown as PrismaService;
    const visuals = new BrandVisualStateService(db);
    afterAll(() => prisma.$disconnect());
    it.each([false, true])(
      "observed scan never approves or replaces canonical visuals (prior=%s)",
      async (approved) => {
        const brand = await prisma.brandProfile.create({
          data: {
            domain: `${randomUUID()}.example`,
            name: "Scan boundary",
            industry: "D2C",
          },
        });
        const canonical = approved
          ? await visuals.confirmLogo(
              brand.id,
              "https://approved.example/logo.png",
              "BRAND_SELECTION",
            )
          : null;
        const response = {
          brandProfile: { logoUrl: "https://observed.example/logo.png" },
          strategicDNA: {
            narrative: {
              tagline: "Observed tagline",
              briefDescription: "Observed description with enough length",
              brandUsps: ["One", "Two", "Three"],
              toneOfVoice: ["Warm"],
            },
            visuals: {
              palette: ["#123456"],
              fonts: ["Observed Font"],
              aesthetics: ["Minimal"],
            },
            complianceGuardrails: { doNotSayList: ["Guaranteed results"] },
          },
          audiencePersonas: [
            {
              personaName: "Observed persona",
              demographicsJson: {
                geo: ["US"],
                ageWindows: ["25-40"],
                explicitInterests: ["Shopping"],
              },
            },
          ],
          offersLedger: [],
          growthImpactMatrix: {
            projectedRevenueLiftPercentage: 0,
            levers: {
              pdpAlignmentLift: 0,
              paidAmplificationLift: 0,
              creatorRosterLift: 0,
            },
            statusIndicator: "YELLOW",
          },
          baselineHealth: {
            reachMoMPercentage: 0,
            engagementRateVsBenchmark: 0,
            audienceOverlapPercentage: 0,
            contentQualityScore: 0,
            averageHookRate: 0,
            brandSafetyScore: 0,
            archetypeMatch: {
              ourBrandDistribution: {
                everyman: 25,
                expert: 25,
                jester: 25,
                rebel: 25,
              },
              competitorAverageDistribution: {
                everyman: 25,
                expert: 25,
                jester: 25,
                rebel: 25,
              },
            },
          },
          shareOfVoice: {
            ourBrandShare: 0,
            competitorsShareMatrix: {},
            competitorThemesLast30Days: ["Unknown"],
          },
          financials: {
            masterMonthlyBudget: 100,
            strategyMix: {
              assetMix: { product: 100, collection: 0, sale: 0 },
              tierMix: {
                nano: 100,
                micro: 0,
                midTier: 0,
                mega: 0,
                celebrity: 0,
              },
              objectiveMix: { pulse: 100, proof: 0, push: 0, production: 0 },
            },
          },
        };
        const provider = { generateJson: vi.fn().mockResolvedValue(response) };
        const worker = new DeepScanWorker(
          db,
          provider as unknown as GeminiJsonClient,
        );
        const job = await prisma.brandCentreJob.create({
          data: { brandProfileId: brand.id, type: "DEEP_SCAN" },
        });
        await worker.run(job.id);
        expect(
          (
            await prisma.brandCentreJob.findUniqueOrThrow({
              where: { id: job.id },
            })
          ).status,
        ).toBe("COMPLETED");
        const state = await visuals.read(brand.id);
        expect(state?.primaryLogo?.id ?? null).toBe(canonical?.id ?? null);
        expect(state?.colors ?? []).toEqual([]);
        expect(state?.typography ?? []).toEqual([]);
        const profile = await prisma.brandProfile.findUniqueOrThrow({
          where: { id: brand.id },
        });
        expect(profile.visualIdentity).toMatchObject({
          colors: ["#123456"],
          observedLogoUrl: response.brandProfile.logoUrl,
        });
        expect(profile.logoUrl).toBe(
          canonical?.url ?? response.brandProfile.logoUrl,
        );
        expect(provider.generateJson).toHaveBeenCalledOnce(); // Fixture provider only; no network/model call.
      },
    );
  },
);
