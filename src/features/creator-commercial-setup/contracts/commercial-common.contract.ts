import { countryAuthorityFingerprint } from "../../../shared/geography/country-authority-fingerprint";
import { IndustryVertical } from "@prisma/client";
import { z } from "zod";
import { isIso31661Alpha2CountryCode } from "../../../shared/geography/iso-country-code";
import { mapGatekeeperToClassification } from "../../brand-onboarding/industry/map-gatekeeper-result";
import { GeoRoutingService } from "../../pricing/services/geo-routing.service";

export const CommercialCountrySchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine(isIso31661Alpha2CountryCode, "Valid ISO country required");
export const CommercialCurrencySchema = z.enum(["INR", "USD"]);
export const CommercialAnswerSchema = z.enum(["YES", "NO"]).nullable();
export const COMMERCIAL_INDUSTRY_IDS = Object.values(IndustryVertical)
  .filter(
    (industry) =>
      mapGatekeeperToClassification({
        supported: true,
        industry,
        sub_industry: "",
        confidence: 1,
      }).bucket === "supported",
  )
  .sort();
export const CommercialIndustrySchema = z
  .nativeEnum(IndustryVertical)
  .refine(
    (id) => COMMERCIAL_INDUSTRY_IDS.includes(id),
    "Active canonical industry required",
  );
export const CommercialIndustryListSchema = z
  .array(CommercialIndustrySchema)
  .max(64)
  .transform((ids) => [...new Set(ids)].sort());
export const CommercialConcurrencySchema = {
  expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
};
export const CountryAuthorityBindingSchema = z
  .object({
    source: z.enum(["CREATOR_DECLARED", "PAYOUT_BANK"]),
    sourceReference: z.string().uuid(),
    sourceVersion: z.number().int().positive(),
    legalProfileVersion: z.number().int().positive().nullable(),
    country: CommercialCountrySchema,
    currency: CommercialCurrencySchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new GeoRoutingService().resolveGeoContext(value.country).currency !==
        value.currency ||
      (value.source === "CREATOR_DECLARED" &&
        value.legalProfileVersion !== null)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid authority binding",
      });
  });
export type CountryAuthorityBinding = z.infer<
  typeof CountryAuthorityBindingSchema
>;
export function commercialAuthorityFingerprint(
  input: CountryAuthorityBinding,
): string {
  const v = CountryAuthorityBindingSchema.parse(input);
  return countryAuthorityFingerprint(v);
}
export const COMMERCIAL_MUTATION_BOUNDARY = Object.freeze({
  workPreferencesAggregate: "CreatorWorkPreferences",
  workPreferencesRevision: "CreatorWorkPreferencesRevision",
  workPreferencesMigrationOrdinal: 103,
  rateCardAggregate: "CreatorRateCard",
  rateCardRevision: "CreatorRateCardRevision",
  rateCardMigrationOrdinal: 104,
  sourceIndependent: true,
  serverResolvedSubject: true,
  activeMembershipRequired: true,
  teamLockRequired: true,
  expectedRevisionRequired: true,
  idempotencyRequired: true,
  immutableServerAudit: true,
  getWrites: false,
  liveProviderRequired: false,
  settingsMutation: false,
  payoutReadinessMutation: false,
  campaignMutation: false,
  collaborationMutation: false,
  fxConversion: false,
  kycProducer: false,
});
