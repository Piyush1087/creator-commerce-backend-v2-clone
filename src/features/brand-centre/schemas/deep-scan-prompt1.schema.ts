import { z } from "zod";

const archetypeDistribution = z
  .object({
    everyman: z.number(),
    expert: z.number(),
    jester: z.number(),
    rebel: z.number(),
  })
  .refine(
    (v) => v.everyman + v.expert + v.jester + v.rebel === 100,
    "Archetype weights must sum to 100",
  );

const inventoryEntitySchema = z.object({
  entityType: z.enum([
    "PRODUCT",
    "MODULE",
    "TREATMENT",
    "EXPERIENCE",
    "COLLECTION",
  ]),
  entityName: z.string().min(2),
  entityUrl: z.string().url(),
  imageUrl: z.string().url().optional(),
  briefDescription: z.string().max(500).optional(),
  sellingPoints: z.array(z.string().min(2)).length(3),
  productDoNotSay: z.array(z.string()).optional(),
});

const offerLedgerSchema = z.object({
  offerName: z.string().min(2),
  promoCode: z.string().min(2),
  applicabilityScope: z.string().min(2),
  validityStart: z.string().datetime(),
  validityEnd: z.string().datetime(),
  description: z.string().optional(),
});

export const DeepScanPrompt1Schema = z.object({
  brandProfile: z
    .object({
      logoUrl: z.string().url().nullish(),
      igHandle: z.string().nullish(),
      ytHandle: z.string().nullish(),
      tiktokHandle: z.string().nullish(),
      lifecycleStage: z.string().nullish(),
    })
    .optional(),
  strategicDNA: z.object({
    narrative: z.object({
      tagline: z.string().min(5).max(255),
      briefDescription: z.string().min(20),
      brandUsps: z.array(z.string().min(2)).length(3),
      toneOfVoice: z.array(z.string()).min(1),
    }),
    visuals: z.object({
      palette: z.array(z.string()).min(1),
      fonts: z.array(z.string()).min(1),
      aesthetics: z.array(z.string()).min(1),
    }),
    complianceGuardrails: z.object({
      doNotSayList: z.array(z.string()).min(1),
    }),
  }),
  audiencePersonas: z
    .array(
      z.object({
        personaName: z.string().min(2),
        demographicsJson: z.object({
          geo: z.array(z.string()).min(1),
          ageWindows: z.array(z.string()).min(1),
          explicitInterests: z.array(z.string()).min(1),
        }),
        psychographicsText: z.string().optional(),
      }),
    )
    .min(1),
  inventoryInfrastructure: z
    .object({
      entities: z.array(inventoryEntitySchema).min(1),
    })
    .optional(),
  offersLedger: z.array(offerLedgerSchema).optional().default([]),
  growthImpactMatrix: z.object({
    projectedRevenueLiftPercentage: z.number().min(0).max(500),
    levers: z.object({
      pdpAlignmentLift: z.number().min(0).max(100),
      paidAmplificationLift: z.number().min(0).max(100),
      creatorRosterLift: z.number().min(0).max(100),
    }),
    statusIndicator: z.enum(["GREEN", "YELLOW", "RED"]),
  }),
  baselineHealth: z.object({
    reachMoMPercentage: z.number(),
    engagementRateVsBenchmark: z.number(),
    audienceOverlapPercentage: z.number().min(0).max(100),
    contentQualityScore: z.number().min(0).max(10),
    averageHookRate: z.number().min(0).max(100),
    brandSafetyScore: z.number().min(0).max(100),
    archetypeMatch: z.object({
      ourBrandDistribution: archetypeDistribution,
      competitorAverageDistribution: archetypeDistribution,
    }),
  }),
  shareOfVoice: z.object({
    ourBrandShare: z.number().min(0).max(100),
    competitorsShareMatrix: z.record(z.string(), z.number().min(0).max(100)),
    competitorThemesLast30Days: z.array(z.string()).min(1),
  }),
  financials: z.object({
    masterMonthlyBudget: z.number().min(1),
    strategyMix: z.object({
      assetMix: z
        .object({
          product: z.number(),
          collection: z.number(),
          sale: z.number(),
        })
        .refine((v) => v.product + v.collection + v.sale === 100),
      tierMix: z
        .object({
          nano: z.number(),
          micro: z.number(),
          midTier: z.number(),
          mega: z.number(),
          celebrity: z.number(),
        })
        .refine(
          (v) =>
            v.nano + v.micro + v.midTier + v.mega + v.celebrity === 100,
        ),
      objectiveMix: z
        .object({
          pulse: z.number(),
          proof: z.number(),
          push: z.number(),
          production: z.number(),
        })
        .refine((v) => v.pulse + v.proof + v.push + v.production === 100),
    }),
  }),
});

export type DeepScanPrompt1Payload = z.infer<typeof DeepScanPrompt1Schema>;
export type DeepScanInventoryEntity = z.infer<typeof inventoryEntitySchema>;
export type DeepScanOfferLedgerRow = z.infer<typeof offerLedgerSchema>;
