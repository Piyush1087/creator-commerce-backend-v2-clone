import { UcePayoutTerms } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  exactCampaignPaymentTerm,
  financialAuthorityHash,
} from "./utils/collaboration-financial-authority";

describe("C-04 BP-G08 financial authority", () => {
  it.each([
    UcePayoutTerms.NET_7,
    UcePayoutTerms.NET_15,
    UcePayoutTerms.NET_30,
    UcePayoutTerms.NET_45,
    UcePayoutTerms.NET_60,
  ])("accepts exact Campaign term %s", (term) => {
    expect(exactCampaignPaymentTerm(term)).toBe(term);
  });

  it("fails closed for IMMEDIATE and unavailable authority", () => {
    expect(() => exactCampaignPaymentTerm(UcePayoutTerms.IMMEDIATE)).toThrow();
    expect(() => exactCampaignPaymentTerm(null)).toThrow();
  });

  it("hashes equivalent authority records deterministically", () => {
    const first = financialAuthorityHash({ version: 1, amount: "118.00" });
    const reordered = financialAuthorityHash({ amount: "118.00", version: 1 });
    expect(first).toBe(reordered);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});
