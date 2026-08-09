import { z } from "zod";

export const PlannerPrompt3Schema = z
  .object({
    cardType: z.enum(["NEW_CAMPAIGN", "SUGGESTED_UPDATE", "AUTO_PAUSE_LOG"]),
    aggregationKey: z.object({
      objective: z.enum(["PULSE", "PROOF", "PUSH", "PRODUCTION"]),
      targetCreatorTier: z.enum([
        "NANO",
        "MICRO",
        "MID_TIER",
        "MEGA",
        "CELEBRITY",
      ]),
      aiContextHook: z.string().min(5),
    }),
    existingTargetCampaignId: z.string().uuid().nullable(),
    campaignMetadata: z.object({
      audienceDemographics: z.object({
        geoTargets: z.array(z.string()).min(1),
        genderFocus: z.array(z.string()).min(1),
        ageWindows: z.array(z.string()).min(1),
        explicitInterests: z.array(z.string()).min(1),
      }),
      operationalBudgetParameters: z
        .object({
          minAllocationThreshold: z.number().min(500),
          maxAllocationThreshold: z.number().min(500),
          complimentaryProductBundle: z.string().optional(),
        })
        .refine((b) => b.maxAllocationThreshold >= b.minAllocationThreshold),
      campaignArchitectureDeadline: z.string().datetime(),
    }),
    assetsAndBriefsMatrix: z
      .array(
        z.object({
          entityId: z.string().uuid().optional(),
          entityName: z.string().min(2),
          entityType: z
            .enum([
              "PRODUCT",
              "MODULE",
              "TREATMENT",
              "EXPERIENCE",
              "COLLECTION",
            ])
            .optional(),
          productionBriefs: z
            .array(
              z.object({
                briefId: z.string().optional(),
                briefName: z.string().min(5),
                contentPillarThemeCore: z.string().min(10),
                requiredDeliverables: z
                  .array(
                    z.object({
                      platform: z.string(),
                      quantity: z.number().int().min(1),
                    }),
                  )
                  .min(1),
                operationalChecklists: z
                  .object({
                    customLandingPageUrl: z.string().url().optional(),
                    metaPartnershipAdWhitelistingEnabled: z
                      .boolean()
                      .optional(),
                    whitelistingAccessWindowDays: z.number().optional(),
                    customDiscountTrackingCode: z.string().optional(),
                  })
                  .optional(),
              }),
            )
            .min(1),
        }),
      )
      .min(1),
    workflowStatus: z
      .enum([
        "PENDING_USER_REVIEW",
        "PROCEEDED_TO_PIPELINE",
        "DISCARDED",
        "AUTO_EXECUTED_BYPASS",
      ])
      .optional(),
  })
  .refine(
    (data) =>
      data.cardType !== "SUGGESTED_UPDATE" ||
      data.existingTargetCampaignId !== null,
    { message: "SUGGESTED_UPDATE requires existingTargetCampaignId" },
  );

export type PlannerPrompt3Payload = z.infer<typeof PlannerPrompt3Schema>;
