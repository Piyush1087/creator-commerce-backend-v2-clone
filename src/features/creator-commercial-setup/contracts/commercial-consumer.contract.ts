import { z } from "zod";
import {
  CountryAuthorityBindingSchema,
  commercialAuthorityFingerprint,
} from "./commercial-common.contract";
import {
  WorkPreferencesValuesSchema,
  CommercialReadinessSchema,
} from "./work-preferences.contract";
import {
  RateCardValuesSchema,
  RateCardStoredAuthoritySchema,
  RATE_CARD_MONETARY_KEYS,
} from "./rate-card.contract";

export const CommercialContextSchema = z
  .object({
    role: z.enum(["OWNER", "MANAGER", "ASSISTANT"]),
    allowedActions: z.array(
      z.enum([
        "COMMERCIAL_SETUP_READ",
        "WORK_PREFERENCES_EDIT",
        "RATE_CARD_EDIT",
      ]),
    ),
    sourceIndependent: z.literal(true),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      !v.allowedActions.includes("COMMERCIAL_SETUP_READ") ||
      (v.role === "ASSISTANT" &&
        v.allowedActions.some((a) => a !== "COMMERCIAL_SETUP_READ"))
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid Commercial role projection",
      });
  });
export const EffectiveCountrySchema = z
  .object({
    state: z.enum(["AVAILABLE", "UNCONFIGURED", "CONFLICT"]),
    effectiveBaseCountry: z.string().nullable(),
    baseCountrySource: z.enum(["CREATOR_DECLARED", "PAYOUT_BANK"]).nullable(),
    baseCountryEditable: z.boolean(),
    canonicalRateCardCurrency: z.enum(["INR", "USD"]).nullable(),
    authorityBinding: CountryAuthorityBindingSchema.nullable(),
    authorityFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const binding = v.authorityBinding;
    if (v.state === "AVAILABLE") {
      if (
        !binding ||
        v.effectiveBaseCountry !== binding.country ||
        v.baseCountrySource !== binding.source ||
        v.canonicalRateCardCurrency !== binding.currency ||
        v.authorityFingerprint !== commercialAuthorityFingerprint(binding) ||
        v.baseCountryEditable !== (binding.source === "CREATOR_DECLARED")
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid available country authority",
        });
    } else if (
      binding !== null ||
      v.effectiveBaseCountry !== null ||
      v.baseCountrySource !== null ||
      v.canonicalRateCardCurrency !== null ||
      v.authorityFingerprint !== null ||
      v.baseCountryEditable !== (v.state === "UNCONFIGURED")
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unavailable authority must not fabricate country or money",
      });
  });
export const WorkPreferencesConsumerSchema = z
  .object({
    contractVersion: z.literal("creator-work-preferences-v0.1"),
    state: z.enum(["UNCONFIGURED", "CONFIGURED"]),
    currentRevision: z.number().int().nonnegative(),
    values: WorkPreferencesValuesSchema.nullable(),
    context: CommercialContextSchema,
    readiness: CommercialReadinessSchema,
    country: EffectiveCountrySchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      (v.currentRevision === 0) !== (v.values === null) ||
      (v.state === "UNCONFIGURED") !== (v.values === null)
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Configuration/revision mismatch",
      });
  });
export const RateCardConsumerSchema = z
  .object({
    contractVersion: z.literal("creator-rate-card-v0.1"),
    state: z.enum([
      "UNCONFIGURED",
      "CURRENT",
      "MONETARY_RATES_REQUIRE_REENTRY",
    ]),
    currentRevision: z.number().int().nonnegative(),
    values: RateCardValuesSchema.nullable(),
    country: EffectiveCountrySchema,
    context: CommercialContextSchema,
    workPreferences: z
      .object({
        ugcProjects: z.enum(["YES", "NO"]).nullable(),
        giftingBarter: z.enum(["YES", "NO"]).nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      (v.currentRevision === 0) !== (v.values === null) ||
      (v.state === "UNCONFIGURED") !== (v.values === null) ||
      (v.state === "CURRENT" && v.country.state !== "AVAILABLE") ||
      (v.state === "MONETARY_RATES_REQUIRE_REENTRY" &&
        v.values &&
        RATE_CARD_MONETARY_KEYS.some((key) => v.values?.[key].enabled))
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rate Card state must not expose unavailable monetary truth",
      });
  });
const audit = {
  workspaceId: z.string().uuid(),
  ownerCreatorProfileId: z.string().uuid(),
  actorUserId: z.string().uuid(),
  actorMembershipId: z.string().uuid(),
  actorRole: z.enum(["OWNER", "MANAGER"]),
  revision: z.number().int().positive(),
  previousRevision: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
  createdAt: z.string().datetime(),
};
export const WorkPreferencesRevisionSchema = z
  .object({
    ...audit,
    origin: z.literal("MANUAL"),
    values: WorkPreferencesValuesSchema,
  })
  .strict()
  .refine(
    (v) => v.revision === v.previousRevision + 1,
    "Monotonic revision required",
  );
export const RateCardRevisionSchema = z
  .object({
    ...audit,
    origin: z.enum([
      "MANUAL",
      "COUNTRY_AUTHORITY_RECONCILIATION",
      "MANUAL_COUNTRY_MONETARY_RESET",
    ]),
    values: RateCardValuesSchema,
    authority: RateCardStoredAuthoritySchema,
  })
  .strict()
  .refine(
    (v) => v.revision === v.previousRevision + 1,
    "Monotonic revision required",
  );
