import { describe, expect, it } from "vitest";
import { decideRateCardCountryTransition } from "./rate-card-country-transition.contract";
import { RateCardValuesSchema } from "./rate-card.contract";
const off = { enabled: false, amountMinor: null };
const values = RateCardValuesSchema.parse({
  REEL_VIDEO: { enabled: true, amountMinor: 10000 },
  STORY: off,
  BANNER_CAROUSEL: off,
  PHOTOSHOOT: off,
  linkInBio: off,
  paidAmplification: off,
  contentUsageRights: "YES",
  usageDays: 30,
  advancePercent: 25,
  balanceTerm: "NET_30",
});
const previous = {
  source: "CREATOR_DECLARED" as const,
  sourceReference: "00000000-0000-4000-8000-000000000001",
  sourceVersion: 1,
  legalProfileVersion: null,
  country: "US",
  currency: "USD" as const,
};
describe("P0 amended currency transition contract", () => {
  it("same-currency country change preserves money and independent terms", () => {
    const result = decideRateCardCountryTransition({
      values,
      previous,
      next: { ...previous, country: "GB", sourceVersion: 2 },
      manualCountryChange: true,
      confirmMonetaryReset: false,
    });
    expect(result.values).toEqual(values);
    expect(result.clearedMonetaryKeys).toEqual([]);
    expect(result.currencyChanged).toBe(false);
  });
  it("cross-currency manual change requires deliberate confirmation", () => {
    const input = {
      values,
      previous,
      next: {
        ...previous,
        country: "IN",
        currency: "INR" as const,
        sourceVersion: 2,
      },
      manualCountryChange: true,
      confirmMonetaryReset: false,
    };
    expect(() => decideRateCardCountryTransition(input)).toThrow(
      "MONETARY_RESET_CONFIRMATION_REQUIRED",
    );
    const result = decideRateCardCountryTransition({
      ...input,
      confirmMonetaryReset: true,
    });
    expect(result.values.REEL_VIDEO).toEqual(off);
    expect(result.values.usageDays).toBe(30);
    expect(result.values.balanceTerm).toBe("NET_30");
    expect(values.REEL_VIDEO.amountMinor).toBe(10000);
  });
  it("higher bank authority proceeds but clears old-currency money without FX", () => {
    const result = decideRateCardCountryTransition({
      values,
      previous,
      next: {
        ...previous,
        source: "PAYOUT_BANK",
        country: "IN",
        currency: "INR",
        sourceVersion: 2,
      },
      manualCountryChange: false,
      confirmMonetaryReset: false,
    });
    expect(result.values.REEL_VIDEO).toEqual(off);
    expect(result.values.advancePercent).toBe(25);
    expect(result.clearedMonetaryKeys).toEqual(["REEL_VIDEO"]);
  });
});
