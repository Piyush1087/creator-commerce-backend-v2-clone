import {
  RateCardValuesSchema,
  clearRateCardMoney,
  RATE_CARD_MONETARY_KEYS,
  type RateCardValues,
} from "./rate-card.contract";
import {
  CountryAuthorityBindingSchema,
  commercialAuthorityFingerprint,
  type CountryAuthorityBinding,
} from "./commercial-common.contract";

/** Owning mutation must persist this decision and both revisions atomically. Never called on GET. */
export function decideRateCardCountryTransition(input: {
  values: RateCardValues;
  previous: CountryAuthorityBinding;
  next: CountryAuthorityBinding;
  manualCountryChange: boolean;
  confirmMonetaryReset: boolean;
}) {
  const values = RateCardValuesSchema.parse(input.values);
  const previous = CountryAuthorityBindingSchema.parse(input.previous);
  const next = CountryAuthorityBindingSchema.parse(input.next);
  const currencyChanged = previous.currency !== next.currency;
  const hasMoney = RATE_CARD_MONETARY_KEYS.some((key) => values[key].enabled);
  if (input.manualCountryChange && next.source !== "CREATOR_DECLARED")
    throw new Error("Bank country changes belong to Settings");
  if (
    input.manualCountryChange &&
    currencyChanged &&
    hasMoney &&
    !input.confirmMonetaryReset
  )
    throw new Error("MONETARY_RESET_CONFIRMATION_REQUIRED");
  return {
    values: currencyChanged ? clearRateCardMoney(values) : values,
    authorityBinding: next,
    authorityFingerprint: commercialAuthorityFingerprint(next),
    currencyChanged,
    clearedMonetaryKeys: currencyChanged
      ? RATE_CARD_MONETARY_KEYS.filter((key) => values[key].enabled)
      : [],
    origin:
      input.manualCountryChange && currencyChanged
        ? ("MANUAL_COUNTRY_MONETARY_RESET" as const)
        : ("COUNTRY_AUTHORITY_RECONCILIATION" as const),
  };
}
