import { IndustryVertical } from "@prisma/client";
import { z } from "zod";

const CanonicalIndustrySchema = z.nativeEnum(IndustryVertical).nullable();

export const GatekeeperSiteAssessmentSchema = z
  .object({
    provisional_industry: CanonicalIndustrySchema,
    provisional_sub_industry: z.string().trim().min(1).max(160).nullable(),
    entity_category: z.enum([
      "BRAND",
      "MARKETPLACE",
      "CREATOR_MARKETING_PLATFORM",
      "NON_COMMERCIAL_ENTITY",
      "UNKNOWN",
    ]),
    english_evidence_status: z.enum(["SUFFICIENT", "INSUFFICIENT", "UNCERTAIN"]),
    creator_marketing_applicability: z.enum([
      "APPLICABLE",
      "NOT_APPLICABLE",
      "UNCERTAIN",
    ]),
    commercial_destination_types: z
      .array(
        z.enum([
          "WEBSITE",
          "APP_STORE",
          "PLAY_STORE",
          "DIRECT_APK",
          "LEAD_GENERATION",
          "BOOKING",
          "OFFLINE_LOCATION",
          "SALES_CONTACT",
          "MULTI_DESTINATION",
        ]),
      )
      .refine((values) => new Set(values).size === values.length, {
        message: "commercial_destination_types must contain unique values",
      }),
    assessment_confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  })
  .strict();

export type GatekeeperSiteAssessmentPayload = z.infer<
  typeof GatekeeperSiteAssessmentSchema
>;
