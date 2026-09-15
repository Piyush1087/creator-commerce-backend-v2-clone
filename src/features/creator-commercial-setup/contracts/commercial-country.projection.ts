import {
  CreatorPayoutCountryAuthoritySchema,
  type CreatorPayoutCountryAuthority,
} from "../../creator-settings/payouts/creator-payout-country-authority.port";
import { GeoRoutingService } from "../../pricing/services/geo-routing.service";
import {
  commercialAuthorityFingerprint,
  CommercialCountrySchema,
  type CountryAuthorityBinding,
} from "./commercial-common.contract";
import { EffectiveCountrySchema } from "./commercial-consumer.contract";

/** Consumer projection only. Settings owns every bank/legal fact. */
export function projectCommercialCountry(input: {
  creatorProfileId: string;
  bank: CreatorPayoutCountryAuthority;
  declared: { reference: string; revision: number; country: string } | null;
}) {
  const bank = CreatorPayoutCountryAuthoritySchema.parse(input.bank);
  const unavailable = (state: "CONFLICT" | "UNCONFIGURED") =>
    EffectiveCountrySchema.parse({
      state,
      effectiveBaseCountry: null,
      baseCountrySource: null,
      baseCountryEditable: state === "UNCONFIGURED",
      canonicalRateCardCurrency: null,
      authorityBinding: null,
      authorityFingerprint: null,
    });
  if (
    bank.creatorProfileId !== input.creatorProfileId ||
    bank.state === "CONFLICT"
  )
    return unavailable("CONFLICT");
  let binding: CountryAuthorityBinding;
  if (bank.state === "AVAILABLE") {
    binding = {
      source: "PAYOUT_BANK",
      sourceReference: bank.destinationReference,
      sourceVersion: bank.destinationVersion,
      legalProfileVersion: bank.legalProfileVersion,
      country: bank.countryCode,
      currency: bank.currencyCode,
    };
    try {
      if (bank.authorityFingerprint !== commercialAuthorityFingerprint(binding))
        return unavailable("CONFLICT");
    } catch {
      return unavailable("CONFLICT");
    }
  } else {
    if (!input.declared) return unavailable("UNCONFIGURED");
    const country = CommercialCountrySchema.parse(input.declared.country);
    binding = {
      source: "CREATOR_DECLARED",
      sourceReference: input.declared.reference,
      sourceVersion: input.declared.revision,
      legalProfileVersion: null,
      country,
      currency: new GeoRoutingService().resolveGeoContext(country).currency,
    };
  }
  return EffectiveCountrySchema.parse({
    state: "AVAILABLE",
    effectiveBaseCountry: binding.country,
    baseCountrySource: binding.source,
    baseCountryEditable: binding.source === "CREATOR_DECLARED",
    canonicalRateCardCurrency: binding.currency,
    authorityBinding: binding,
    authorityFingerprint: commercialAuthorityFingerprint(binding),
  });
}
