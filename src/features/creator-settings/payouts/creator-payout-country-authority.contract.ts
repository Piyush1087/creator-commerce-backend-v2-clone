import { z } from "zod";
import {
  CreatorPayeeType,
  CreatorPayoutDestinationType,
  CreatorPayoutDestinationState,
} from "@prisma/client";
import { countryAuthorityFingerprint } from "../../../shared/geography/country-authority-fingerprint";
import { isIso31661Alpha2CountryCode } from "../../../shared/geography/iso-country-code";
import { GeoRoutingService } from "../../pricing/services/geo-routing.service";
import {
  CreatorPayoutCountryAuthoritySchema,
  type CreatorPayoutCountryAuthority,
} from "./creator-payout-country-authority.port";

/** Small selected input; no credential/payload/provider fields are loaded. */
export const PayoutCountryDestinationSchema = z
  .object({
    id: z.string().uuid(),
    creatorProfileId: z.string().uuid(),
    payeeType: z.nativeEnum(CreatorPayeeType),
    destinationType: z.nativeEnum(CreatorPayoutDestinationType),
    countryCode: z.string(),
    currencyCode: z.string(),
    isPrimary: z.boolean(),
    state: z.nativeEnum(CreatorPayoutDestinationState),
    version: z.number().int().positive(),
    disabledAt: z.date().nullable(),
  })
  .strict();
export type PayoutCountryDestination = z.infer<
  typeof PayoutCountryDestinationSchema
>;
export const PayoutCountryLegalSchema = z
  .object({
    creatorProfileId: z.string().uuid(),
    payeeType: z.nativeEnum(CreatorPayeeType),
    countryCode: z.string(),
    version: z.number().int().positive(),
  })
  .strict();
export type PayoutCountryLegal = z.infer<typeof PayoutCountryLegalSchema>;
/** No writes, provider access, bank verification or C06 readiness dependencies. */
export function finalizePayoutCountryAuthority(input: {
  creatorProfileId: string;
  destinations: readonly PayoutCountryDestination[];
  legal: PayoutCountryLegal | null;
  observedAt: Date;
}): CreatorPayoutCountryAuthority {
  const base = {
    creatorProfileId: input.creatorProfileId,
    observedAt: input.observedAt.toISOString(),
  };
  const conflict = (
    reason:
      | "MULTIPLE_PRIMARY"
      | "INVALID_COUNTRY_CURRENCY"
      | "LEGAL_PROFILE_MISMATCH"
      | "UNRESOLVED_VERSION",
  ) =>
    CreatorPayoutCountryAuthoritySchema.parse({
      ...base,
      state: "CONFLICT",
      reason,
    });
  if (
    input.destinations.some(
      (d) =>
        !PayoutCountryDestinationSchema.safeParse(d).success ||
        d.creatorProfileId !== input.creatorProfileId,
    ) ||
    (input.legal &&
      (!PayoutCountryLegalSchema.safeParse(input.legal).success ||
        input.legal.creatorProfileId !== input.creatorProfileId))
  )
    return conflict("UNRESOLVED_VERSION");
  const active = input.destinations.filter(
    (d) => d.isPrimary && d.disabledAt === null && d.state !== "DISABLED",
  );
  if (active.length > 1) return conflict("MULTIPLE_PRIMARY");
  const destination = active[0];
  if (!destination || destination.destinationType !== "BANK_ACCOUNT")
    return CreatorPayoutCountryAuthoritySchema.parse({
      ...base,
      state: "ABSENT",
    });
  if (
    !isIso31661Alpha2CountryCode(destination.countryCode) ||
    new GeoRoutingService().resolveGeoContext(destination.countryCode)
      .currency !== destination.currencyCode
  )
    return conflict("INVALID_COUNTRY_CURRENCY");
  if (
    input.legal &&
    (input.legal.countryCode !== destination.countryCode ||
      input.legal.payeeType !== destination.payeeType)
  )
    return conflict("LEGAL_PROFILE_MISMATCH");
  const currency = z.enum(["INR", "USD"]).parse(destination.currencyCode);
  return CreatorPayoutCountryAuthoritySchema.parse({
    ...base,
    state: "AVAILABLE",
    destinationReference: destination.id,
    destinationVersion: destination.version,
    destinationState: destination.state,
    countryCode: destination.countryCode,
    currencyCode: currency,
    legalProfileVersion: input.legal?.version ?? null,
    authorityFingerprint: countryAuthorityFingerprint({
      source: "PAYOUT_BANK",
      sourceReference: destination.id,
      sourceVersion: destination.version,
      legalProfileVersion: input.legal?.version ?? null,
      country: destination.countryCode,
      currency,
    }),
  });
}
