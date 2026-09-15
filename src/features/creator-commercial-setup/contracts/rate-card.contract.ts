import { z } from "zod";
import {
  advancePaymentPercentageSchema,
  campaignNetPaymentTermsSchema,
} from "../../brand-uce/validation/shared/campaign.shared.schema";
import {
  CommercialAnswerSchema,
  CommercialConcurrencySchema,
  commercialAuthorityFingerprint,
  CountryAuthorityBindingSchema,
  type CountryAuthorityBinding,
} from "./commercial-common.contract";

export const RateCardLineSchema = z
  .object({
    enabled: z.boolean(),
    amountMinor: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.enabled !== (v.amountMinor !== null))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Enabled lines require positive minor units; disabled amounts must be null",
      });
  });
export const RATE_CARD_REFERENCES = Object.freeze({
  REEL_VIDEO: "One Reel, <15 seconds",
  STORY: "One Story",
  BANNER_CAROUSEL: "One Carousel",
  PHOTOSHOOT: "One delivered static asset",
  linkInBio: "Link in Bio — seven days",
  paidAmplification: "Partnership Ads — fifteen days",
});
export const RATE_CARD_TERMS = Object.freeze([
  "Rates are indicative starting points, not binding offers.",
  "Final pricing depends on the brief and its scope.",
  "Creator retains discretion until final terms are mutually accepted.",
  "Campaign commercial and payment terms supersede the Rate Card.",
  "Final accepted direct quote or Collaboration agreement supersedes the Rate Card.",
  "Rights apply only when explicitly included in the final agreement for the agreed scope and duration.",
  "Gifting/barter is optional, not an obligation to accept.",
  "Rate Card updates are prospective and never mutate historical Applications or locked Collaborations.",
  "Payment terms are preferences and may be superseded by final terms.",
]);
export const RateCardValuesSchema = z
  .object({
    REEL_VIDEO: RateCardLineSchema,
    STORY: RateCardLineSchema,
    BANNER_CAROUSEL: RateCardLineSchema,
    PHOTOSHOOT: RateCardLineSchema,
    linkInBio: RateCardLineSchema,
    paidAmplification: RateCardLineSchema,
    contentUsageRights: CommercialAnswerSchema,
    usageDays: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
    advancePercent: advancePaymentPercentageSchema.nullable(),
    balanceTerm: campaignNetPaymentTermsSchema.nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.contentUsageRights !== "YES" && v.usageDays !== null)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["usageDays"],
        message: "Duration requires explicit rights availability",
      });
  });
export type RateCardValues = z.infer<typeof RateCardValuesSchema>;
export const RATE_CARD_MONETARY_KEYS = [
  "REEL_VIDEO",
  "STORY",
  "BANNER_CAROUSEL",
  "PHOTOSHOOT",
  "linkInBio",
  "paidAmplification",
] as const;
export function clearRateCardMoney(values: RateCardValues): RateCardValues {
  const next = { ...values };
  for (const key of RATE_CARD_MONETARY_KEYS)
    next[key] = { enabled: false, amountMinor: null };
  return RateCardValuesSchema.parse(next);
}
export const RateCardMutationSchema = z
  .object({
    ...CommercialConcurrencySchema,
    expectedWorkPreferencesRevision: z.number().int().positive(),
    authorityFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    values: RateCardValuesSchema,
  })
  .strict();
export const RateCardStoredAuthoritySchema = z
  .object({
    binding: CountryAuthorityBindingSchema,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict()
  .refine(
    (v) => commercialAuthorityFingerprint(v.binding) === v.fingerprint,
    "Authority fingerprint mismatch",
  );
export function projectRateCardMoney(
  values: RateCardValues,
  storedFingerprint: string,
  current: CountryAuthorityBinding | null,
) {
  const matches =
    current !== null &&
    storedFingerprint === commercialAuthorityFingerprint(current);
  return {
    state: matches
      ? ("CURRENT" as const)
      : ("MONETARY_RATES_REQUIRE_REENTRY" as const),
    values: matches
      ? RateCardValuesSchema.parse(values)
      : clearRateCardMoney(values),
  };
}
