import { describe, it, expect } from "vitest";
import {
  RATE_CARD_MONETARY_KEYS,
  RateCardValuesSchema,
} from "../contracts/rate-card.contract";
const off = { enabled: false, amountMinor: null };
const base = {
  REEL_VIDEO: off,
  STORY: off,
  BANNER_CAROUSEL: off,
  PHOTOSHOOT: off,
  linkInBio: off,
  paidAmplification: off,
  contentUsageRights: null,
  usageDays: null,
  advancePercent: null,
  balanceTerm: null,
};
describe("P2 complete atomic validation matrix", () => {
  it.each(RATE_CARD_MONETARY_KEYS.map((key) => ({ key })))(
    "independently enforces every $key boundary",
    ({ key }) => {
      for (const value of [
        { enabled: true, amountMinor: 1 },
        { enabled: true, amountMinor: Number.MAX_SAFE_INTEGER },
        off,
      ])
        expect(
          RateCardValuesSchema.safeParse({ ...base, [key]: value }).success,
        ).toBe(true);
      for (const value of [
        { enabled: true, amountMinor: null },
        { enabled: false, amountMinor: 1 },
        { enabled: true, amountMinor: 0 },
        { enabled: true, amountMinor: -1 },
        { enabled: true, amountMinor: 1.5 },
        { enabled: true, amountMinor: Number.MAX_SAFE_INTEGER + 1 },
      ])
        expect(
          RateCardValuesSchema.safeParse({ ...base, [key]: value }).success,
        ).toBe(false);
    },
  );
  it("retains exact independent rights and payment vocabularies", () => {
    for (const answer of [null, "NO", "YES"])
      expect(
        RateCardValuesSchema.safeParse({ ...base, contentUsageRights: answer })
          .success,
      ).toBe(true);
    for (const days of [1, 30, Number.MAX_SAFE_INTEGER])
      expect(
        RateCardValuesSchema.safeParse({
          ...base,
          contentUsageRights: "YES",
          usageDays: days,
        }).success,
      ).toBe(true);
    for (const days of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(
        RateCardValuesSchema.safeParse({
          ...base,
          contentUsageRights: "YES",
          usageDays: days,
        }).success,
      ).toBe(false);
    for (const answer of [null, "NO"])
      expect(
        RateCardValuesSchema.safeParse({
          ...base,
          contentUsageRights: answer,
          usageDays: 30,
        }).success,
      ).toBe(false);
    for (const advancePercent of [0, 25, 50, 75, 100])
      expect(
        RateCardValuesSchema.safeParse({ ...base, advancePercent }).success,
      ).toBe(true);
    for (const advancePercent of [-1, 1, 24, 101])
      expect(
        RateCardValuesSchema.safeParse({ ...base, advancePercent }).success,
      ).toBe(false);
    for (const balanceTerm of ["NET_7", "NET_15", "NET_30", "NET_45", "NET_60"])
      expect(
        RateCardValuesSchema.safeParse({ ...base, balanceTerm }).success,
      ).toBe(true);
    for (const balanceTerm of ["IMMEDIATE", "NET7", "NET_90"])
      expect(
        RateCardValuesSchema.safeParse({ ...base, balanceTerm }).success,
      ).toBe(false);
  });
});
