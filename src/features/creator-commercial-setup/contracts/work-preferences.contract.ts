import { z } from "zod";
import {
  CommercialAnswerSchema,
  CommercialConcurrencySchema,
  CommercialCountrySchema,
  CommercialIndustryListSchema,
} from "./commercial-common.contract";

export const WorkPreferencesValuesSchema = z
  .object({
    baseCountry: CommercialCountrySchema,
    openToInternationalBrands: CommercialAnswerSchema,
    preferredIndustryIds: CommercialIndustryListSchema,
    excludedIndustryIds: CommercialIndustryListSchema,
    availability: z.enum([
      "ACCEPTING_COLLABORATIONS",
      "PAUSED_UNTIL",
      "NOT_ACCEPTING_NEW_COLLABORATIONS",
    ]),
    pausedUntil: z.string().datetime().nullable(),
    physicalProductCollaborations: CommercialAnswerSchema,
    ugcProjects: CommercialAnswerSchema,
    giftingBarter: CommercialAnswerSchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.preferredIndustryIds.some((id) => v.excludedIndustryIds.includes(id)))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["excludedIndustryIds"],
        message: "Preferred and excluded industries must be disjoint",
      });
    if ((v.availability === "PAUSED_UNTIL") !== (v.pausedUntil !== null))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pausedUntil"],
        message: "Paused-until date required only for paused availability",
      });
  });
export type WorkPreferencesValues = z.infer<typeof WorkPreferencesValuesSchema>;
export function validateWorkPreferencesAt(
  input: unknown,
  now: Date,
): WorkPreferencesValues {
  const v = WorkPreferencesValuesSchema.parse(input);
  if (v.pausedUntil && Date.parse(v.pausedUntil) <= now.getTime())
    throw new Error("Future paused-until date required");
  return v;
}
export const WorkPreferencesMutationSchema = z
  .object({
    ...CommercialConcurrencySchema,
    values: WorkPreferencesValuesSchema,
    expectedRateCardRevision: z.number().int().nonnegative(),
    confirmMonetaryReset: z.boolean(),
  })
  .strict();
export const CommercialReadinessSchema = z
  .object({
    shipping: z.enum(["READY", "NEEDS_SETUP"]),
    payout: z.enum(["READY", "NEEDS_SETUP", "PROVIDER_REVIEW", "UNAVAILABLE"]),
    kyc: z.literal("COMING_SOON"),
  })
  .strict();
export const UNCONFIGURED_WORK_PREFERENCES = Object.freeze({
  baseCountry: null,
  openToInternationalBrands: null,
  preferredIndustryIds: [],
  excludedIndustryIds: [],
  availability: "ACCEPTING_COLLABORATIONS",
  pausedUntil: null,
  physicalProductCollaborations: null,
  ugcProjects: null,
  giftingBarter: null,
});
