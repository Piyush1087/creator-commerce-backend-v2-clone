import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creatorWorkspaceActionsForRole } from "../../creator-settings/team/creator-team.policy";
import { CreatorPayoutCountryAuthoritySchema } from "../../creator-settings/payouts/creator-payout-country-authority.port";
import {
  COMMERCIAL_INDUSTRY_IDS,
  commercialAuthorityFingerprint,
  CountryAuthorityBindingSchema,
} from "./commercial-common.contract";
import {
  validateWorkPreferencesAt,
  WorkPreferencesValuesSchema,
  UNCONFIGURED_WORK_PREFERENCES,
} from "./work-preferences.contract";
import {
  clearRateCardMoney,
  projectRateCardMoney,
  RATE_CARD_REFERENCES,
  RATE_CARD_TERMS,
  RateCardValuesSchema,
} from "./rate-card.contract";

const work = {
  baseCountry: "IN",
  openToInternationalBrands: null,
  preferredIndustryIds: ["D2C", "D2C"],
  excludedIndustryIds: [],
  availability: "ACCEPTING_COLLABORATIONS",
  pausedUntil: null,
  physicalProductCollaborations: null,
  ugcProjects: null,
  giftingBarter: null,
};
const off = { enabled: false, amountMinor: null };
const rates = {
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
};
const authority = {
  source: "CREATOR_DECLARED" as const,
  sourceReference: "00000000-0000-4000-8000-000000000001",
  sourceVersion: 1,
  legalProfileVersion: null,
  country: "IN",
  currency: "INR" as const,
};
describe("Commercial P0 frozen contracts", () => {
  it.each(["OWNER", "MANAGER", "ASSISTANT"] as const)(
    "uses explicit scoped %s actions",
    (role) => {
      const actions = creatorWorkspaceActionsForRole(role);
      expect(actions).toContain("COMMERCIAL_SETUP_READ");
      for (const action of ["WORK_PREFERENCES_EDIT", "RATE_CARD_EDIT"] as const)
        expect(actions.includes(action)).toBe(role !== "ASSISTANT");
      if (role === "ASSISTANT")
        expect(actions).not.toContain("PAYOUT_SETTINGS_MANAGE");
    },
  );
  it("adapts only active industries and deterministically deduplicates", () => {
    expect(COMMERCIAL_INDUSTRY_IDS).toEqual([
      "D2C",
      "HEALTHCARE",
      "OFFLINE_SERVICES",
      "SAAS_AI",
    ]);
    expect(
      WorkPreferencesValuesSchema.parse(work).preferredIndustryIds,
    ).toEqual(["D2C"]);
    for (const id of [
      "UNKNOWN",
      "GAMBLING",
      "ADULT",
      "FRAUDULENT_HIGH_RISK",
      "REAL_ESTATE",
    ])
      expect(
        WorkPreferencesValuesSchema.safeParse({
          ...work,
          preferredIndustryIds: [id],
        }).success,
      ).toBe(false);
    expect(
      WorkPreferencesValuesSchema.safeParse({
        ...work,
        excludedIndustryIds: ["D2C"],
      }).success,
    ).toBe(false);
  });
  it("preserves unanswered defaults without source inference", () => {
    expect(UNCONFIGURED_WORK_PREFERENCES.availability).toBe(
      "ACCEPTING_COLLABORATIONS",
    );
    expect(UNCONFIGURED_WORK_PREFERENCES.baseCountry).toBeNull();
    expect(UNCONFIGURED_WORK_PREFERENCES.ugcProjects).toBeNull();
    expect(
      WorkPreferencesValuesSchema.safeParse({
        ...work,
        creatorProfileId: authority.sourceReference,
      }).success,
    ).toBe(false);
  });
  it("normalizes country and checks future pause at mutation time", () => {
    expect(
      WorkPreferencesValuesSchema.parse({ ...work, baseCountry: " gb " })
        .baseCountry,
    ).toBe("GB");
    expect(() =>
      validateWorkPreferencesAt(
        {
          ...work,
          availability: "PAUSED_UNTIL",
          pausedUntil: "2026-09-16T00:00:00.000Z",
        },
        new Date("2026-09-15T00:00:00.000Z"),
      ),
    ).not.toThrow();
    expect(() =>
      validateWorkPreferencesAt(
        {
          ...work,
          availability: "PAUSED_UNTIL",
          pausedUntil: "2026-09-14T00:00:00.000Z",
        },
        new Date("2026-09-15T00:00:00.000Z"),
      ),
    ).toThrow();
    expect(
      WorkPreferencesValuesSchema.safeParse({
        ...work,
        pausedUntil: "2026-09-16T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid monetary minor units %s",
    (amount) => {
      expect(
        RateCardValuesSchema.safeParse({
          ...rates,
          REEL_VIDEO: { enabled: true, amountMinor: amount },
        }).success,
      ).toBe(false);
    },
  );
  it("rejects disabled money, UGC, manual currency, Immediate and implicit rights", () => {
    for (const values of [
      { ...rates, STORY: { enabled: false, amountMinor: 1 } },
      { ...rates, UGC_VIDEO: off },
      { ...rates, currency: "USD" },
      { ...rates, balanceTerm: "IMMEDIATE" },
      { ...rates, contentUsageRights: "NO" },
    ])
      expect(RateCardValuesSchema.safeParse(values).success).toBe(false);
    expect(RATE_CARD_REFERENCES.paidAmplification).toBe(
      "Partnership Ads — fifteen days",
    );
    expect(RATE_CARD_TERMS).toHaveLength(9);
  });
  it("binds exact source revision, country, currency and bank/legal version", () => {
    const fingerprint = commercialAuthorityFingerprint(authority);
    expect(commercialAuthorityFingerprint({ ...authority })).toBe(fingerprint);
    for (const input of [
      { ...authority, sourceVersion: 2 },
      { ...authority, country: "US", currency: "USD" as const },
      { ...authority, source: "PAYOUT_BANK" as const, legalProfileVersion: 1 },
    ])
      expect(commercialAuthorityFingerprint(input)).not.toBe(fingerprint);
    expect(
      CountryAuthorityBindingSchema.safeParse({ ...authority, country: "US" })
        .success,
    ).toBe(false);
    expect(
      CountryAuthorityBindingSchema.safeParse({
        ...authority,
        source: "VERIFIED_KYC",
      }).success,
    ).toBe(false);
  });
  it("hides old money on conflict/mismatch but preserves independent terms", () => {
    const v = RateCardValuesSchema.parse(rates);
    const fp = commercialAuthorityFingerprint(authority);
    expect(
      projectRateCardMoney(v, fp, authority).values.REEL_VIDEO.amountMinor,
    ).toBe(10000);
    for (const current of [null, { ...authority, sourceVersion: 2 }]) {
      const projected = projectRateCardMoney(v, fp, current);
      expect(projected.state).toBe("MONETARY_RATES_REQUIRE_REENTRY");
      expect(projected.values.REEL_VIDEO).toEqual(off);
      expect(projected.values.usageDays).toBe(30);
      expect(projected.values.advancePercent).toBe(25);
    }
    expect(clearRateCardMoney(v).balanceTerm).toBe("NET_30");
    expect(v.REEL_VIDEO.amountMinor).toBe(10000);
  });
  it("country port strictly excludes secrets and readiness coupling", () => {
    const base = {
      state: "AVAILABLE",
      creatorProfileId: authority.sourceReference,
      destinationReference: authority.sourceReference,
      destinationVersion: 1,
      countryCode: "IN",
      currencyCode: "INR",
      destinationState: "CONFIGURED_UNVERIFIED",
      legalProfileVersion: 1,
      authorityFingerprint: commercialAuthorityFingerprint({
        ...authority,
        source: "PAYOUT_BANK",
        legalProfileVersion: 1,
      }),
      observedAt: "2026-09-15T00:00:00.000Z",
    };
    expect(CreatorPayoutCountryAuthoritySchema.safeParse(base).success).toBe(
      true,
    );
    for (const field of [
      "secretPayloadEncrypted",
      "maskedDisplay",
      "bankAccountNumber",
      "providerReference",
      "bankValidated",
      "transferReady",
    ])
      expect(
        CreatorPayoutCountryAuthoritySchema.safeParse({
          ...base,
          [field]: "not-allowed",
        }).success,
      ).toBe(false);
    const source = readFileSync(
      join(
        process.cwd(),
        "src/features/creator-settings/payouts/creator-payout-country-authority.port.ts",
      ),
      "utf8",
    );
    expect(source).not.toContain("creator-commercial-setup");
  });
});
