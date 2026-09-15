import { z } from "zod";
import { isIso31661Alpha2CountryCode } from "../../../shared/geography/iso-country-code";

export const CREATOR_PAYOUT_COUNTRY_AUTHORITY_PORT = Symbol(
  "CREATOR_PAYOUT_COUNTRY_AUTHORITY_PORT",
);
const country = z.string().refine(isIso31661Alpha2CountryCode);
const currency = z.enum(["INR", "USD"]);
/** Settings-owned non-secret projection. This is not a transfer-readiness claim. */
export const CreatorPayoutCountryAuthoritySchema = z.discriminatedUnion(
  "state",
  [
    z
      .object({
        state: z.literal("AVAILABLE"),
        creatorProfileId: z.string().uuid(),
        destinationReference: z.string().uuid(),
        destinationVersion: z.number().int().positive(),
        countryCode: country,
        currencyCode: currency,
        destinationState: z.enum(["CONFIGURED_UNVERIFIED", "NEEDS_ATTENTION"]),
        legalProfileVersion: z.number().int().positive().nullable(),
        authorityFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
        observedAt: z.string().datetime(),
      })
      .strict(),
    z
      .object({
        state: z.literal("ABSENT"),
        creatorProfileId: z.string().uuid(),
        observedAt: z.string().datetime(),
      })
      .strict(),
    z
      .object({
        state: z.literal("CONFLICT"),
        creatorProfileId: z.string().uuid(),
        reason: z.enum([
          "MULTIPLE_PRIMARY",
          "INVALID_COUNTRY_CURRENCY",
          "LEGAL_PROFILE_MISMATCH",
          "UNRESOLVED_VERSION",
        ]),
        observedAt: z.string().datetime(),
      })
      .strict(),
  ],
);
export type CreatorPayoutCountryAuthority = z.infer<
  typeof CreatorPayoutCountryAuthoritySchema
>;
export interface CreatorPayoutCountryAuthorityPort {
  readCurrent(input: {
    creatorProfileId: string;
  }): Promise<CreatorPayoutCountryAuthority>;
}
