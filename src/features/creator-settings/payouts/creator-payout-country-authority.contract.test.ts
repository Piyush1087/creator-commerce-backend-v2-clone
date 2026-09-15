import { describe, expect, it } from "vitest";
import {
  finalizePayoutCountryAuthority,
  type PayoutCountryDestination,
} from "./creator-payout-country-authority.contract";
const creatorProfileId = "00000000-0000-4000-8000-000000000001";
const destination: PayoutCountryDestination = {
  id: "00000000-0000-4000-8000-000000000002",
  creatorProfileId,
  payeeType: "INDIVIDUAL",
  destinationType: "BANK_ACCOUNT",
  countryCode: "IN",
  currencyCode: "INR",
  isPrimary: true,
  state: "CONFIGURED_UNVERIFIED",
  version: 1,
  disabledAt: null,
};
const observedAt = new Date("2026-09-15T00:00:00.000Z");
const project = (
  destinations: PayoutCountryDestination[] = [destination],
  legal: {
    creatorProfileId: string;
    payeeType: "INDIVIDUAL" | "BUSINESS";
    countryCode: string;
    version: number;
  } | null = null,
) =>
  finalizePayoutCountryAuthority({
    creatorProfileId,
    destinations,
    legal,
    observedAt,
  });
describe("Settings-owned payout country contract", () => {
  it.each(["CONFIGURED_UNVERIFIED", "NEEDS_ATTENTION"] as const)(
    "accepts current bank %s without bank verification or transfer eligibility",
    (state) => {
      expect(project([{ ...destination, state }]).state).toBe("AVAILABLE");
    },
  );
  it("accepts country authority for unsupported US transfer route", () => {
    const result = project([
      { ...destination, countryCode: "US", currencyCode: "USD" },
    ]);
    expect(result.state).toBe("AVAILABLE");
    if (result.state === "AVAILABLE") expect(result.currencyCode).toBe("USD");
  });
  it.each(
    [
      [],
      [{ ...destination, state: "DISABLED" as const }],
      [{ ...destination, disabledAt: observedAt }],
      [{ ...destination, isPrimary: false }],
      [{ ...destination, destinationType: "UPI" as const }],
    ].map((destinations) => ({ destinations })),
  )("returns ABSENT for no active bank destination", ({ destinations }) => {
    expect(project(destinations).state).toBe("ABSENT");
  });
  it("duplicate primaries fail closed, including mixed destination types", () => {
    expect(
      project([
        destination,
        {
          ...destination,
          id: "00000000-0000-4000-8000-000000000003",
          destinationType: "UPI",
        },
      ]),
    ).toMatchObject({ state: "CONFLICT", reason: "MULTIPLE_PRIMARY" });
  });
  it.each([
    { countryCode: "ZZ" },
    { currencyCode: "USD" },
    { countryCode: "in" },
    { currencyCode: "EUR" },
  ])("invalid country/currency rejects", (patch) => {
    expect(project([{ ...destination, ...patch }])).toMatchObject({
      state: "CONFLICT",
      reason: "INVALID_COUNTRY_CURRENCY",
    });
  });
  it("fences exact legal owner, country, payee and version", () => {
    const legal = {
      creatorProfileId,
      payeeType: "INDIVIDUAL" as const,
      countryCode: "IN",
      version: 1,
    };
    expect(project([destination], legal).state).toBe("AVAILABLE");
    for (const invalid of [
      { ...legal, countryCode: "US" },
      { ...legal, payeeType: "BUSINESS" as const },
    ])
      expect(project([destination], invalid)).toMatchObject({
        state: "CONFLICT",
        reason: "LEGAL_PROFILE_MISMATCH",
      });
    expect(
      project([destination], { ...legal, creatorProfileId: destination.id }),
    ).toMatchObject({ state: "CONFLICT", reason: "UNRESOLVED_VERSION" });
    expect(project([{ ...destination, version: 0 }])).toMatchObject({
      state: "CONFLICT",
      reason: "UNRESOLVED_VERSION",
    });
  });
  it("destination and legal versions invalidate exact fingerprint", () => {
    const initial = project();
    const replacement = project([{ ...destination, version: 2 }]);
    const legal = project([destination], {
      creatorProfileId,
      payeeType: "INDIVIDUAL",
      countryCode: "IN",
      version: 2,
    });
    expect(initial.state).toBe("AVAILABLE");
    if (
      initial.state === "AVAILABLE" &&
      replacement.state === "AVAILABLE" &&
      legal.state === "AVAILABLE"
    ) {
      expect(initial.authorityFingerprint).not.toBe(
        replacement.authorityFingerprint,
      );
      expect(initial.authorityFingerprint).not.toBe(legal.authorityFingerprint);
      expect(Object.keys(initial).sort()).toEqual(
        [
          "state",
          "creatorProfileId",
          "destinationReference",
          "destinationVersion",
          "countryCode",
          "currencyCode",
          "destinationState",
          "legalProfileVersion",
          "authorityFingerprint",
          "observedAt",
        ].sort(),
      );
    }
  });
  it("cross-Creator rows fail closed and never alter inputs", () => {
    const rows = [{ ...destination, creatorProfileId: destination.id }];
    const before = JSON.stringify(rows);
    expect(project(rows).state).toBe("CONFLICT");
    expect(JSON.stringify(rows)).toBe(before);
  });
});
