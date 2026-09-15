import { describe, expect, it } from "vitest";
import { commercialAuthorityFingerprint } from "./commercial-common.contract";
import { projectCommercialCountry } from "./commercial-country.projection";
const creatorProfileId = "00000000-0000-4000-8000-000000000001";
const reference = "00000000-0000-4000-8000-000000000002";
const observedAt = "2026-09-15T00:00:00.000Z";
const declared = { reference, revision: 1, country: "IN" };
const absent = { state: "ABSENT" as const, creatorProfileId, observedAt };
describe("P0 country authority projection", () => {
  it.each([
    ["IN", "INR"],
    ["US", "USD"],
    ["GB", "USD"],
  ])("reuses canonical routing for manual %s", (country, currency) => {
    const v = projectCommercialCountry({
      creatorProfileId,
      bank: absent,
      declared: { ...declared, country },
    });
    expect(v.canonicalRateCardCurrency).toBe(currency);
    expect(v.baseCountryEditable).toBe(true);
  });
  it("does not fabricate default US country or KYC", () => {
    const v = projectCommercialCountry({
      creatorProfileId,
      bank: absent,
      declared: null,
    });
    expect(v.state).toBe("UNCONFIGURED");
    expect(v.effectiveBaseCountry).toBeNull();
    expect(v.canonicalRateCardCurrency).toBeNull();
  });
  it("locks active unverified bank country independently of payout readiness", () => {
    const binding = {
      source: "PAYOUT_BANK" as const,
      sourceReference: reference,
      sourceVersion: 2,
      legalProfileVersion: 3,
      country: "US",
      currency: "USD" as const,
    };
    const bank = {
      state: "AVAILABLE" as const,
      creatorProfileId,
      destinationReference: reference,
      destinationVersion: 2,
      countryCode: "US",
      currencyCode: "USD" as const,
      destinationState: "CONFIGURED_UNVERIFIED" as const,
      legalProfileVersion: 3,
      authorityFingerprint: commercialAuthorityFingerprint(binding),
      observedAt,
    };
    const v = projectCommercialCountry({ creatorProfileId, bank, declared });
    expect(v.baseCountrySource).toBe("PAYOUT_BANK");
    expect(v.effectiveBaseCountry).toBe("US");
    expect(v.baseCountryEditable).toBe(false);
    expect(v.authorityBinding).toEqual(binding);
    expect(
      projectCommercialCountry({
        creatorProfileId,
        bank: { ...bank, authorityFingerprint: "0".repeat(64) },
        declared,
      }).state,
    ).toBe("CONFLICT");
  });
  it("conflict and cross-Creator fence never silently fall back", () => {
    expect(
      projectCommercialCountry({
        creatorProfileId,
        bank: {
          ...absent,
          state: "CONFLICT",
          reason: "LEGAL_PROFILE_MISMATCH",
        },
        declared,
      }).state,
    ).toBe("CONFLICT");
    expect(
      projectCommercialCountry({
        creatorProfileId,
        bank: { ...absent, creatorProfileId: reference },
        declared,
      }).state,
    ).toBe("CONFLICT");
  });
  it("manual revision identity changes even with same currency", () => {
    const a = projectCommercialCountry({
      creatorProfileId,
      bank: absent,
      declared: { ...declared, country: "US" },
    });
    const b = projectCommercialCountry({
      creatorProfileId,
      bank: absent,
      declared: { ...declared, country: "GB", revision: 2 },
    });
    expect(a.canonicalRateCardCurrency).toBe(b.canonicalRateCardCurrency);
    expect(a.authorityFingerprint).not.toBe(b.authorityFingerprint);
  });
});
