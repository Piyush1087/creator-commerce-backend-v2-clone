import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  PAYOUT_DUE_RULE_VERSION,
  kolkataPaymentDueAt,
} from "../brand-payouts/utils/kolkata-due-date";
import type { CreatorPayoutObligationItem } from "./contracts/creator-payouts.contract";
import {
  classifySummary,
  resolveProviderDisabledGate,
} from "./services/creator-payouts-obligation-projection.service";
import { summarizeCreatorPayouts } from "./services/creator-payouts-query.service";

describe("C06 P2 obligation and summary projection", () => {
  it.each([
    ["NET_7", 7],
    ["NET_15", 15],
    ["NET_30", 30],
    ["NET_45", 45],
    ["NET_60", 60],
  ] as const)(
    "validates persisted %s due evidence at the exact boundary",
    (term, days) => {
      const eligible = new Date("2026-09-08T18:29:59.999Z");
      const expected = new Date(eligible.getTime() + days * 86_400_000);
      expect(kolkataPaymentDueAt(eligible, term)).toEqual(expected);
      expect(PAYOUT_DUE_RULE_VERSION).toBe("KOLKATA_CALENDAR_V1");
    },
  );

  it("overlays provider-disabled truth only when an otherwise-ready obligation is due", () => {
    const due = new Date("2026-09-08T12:00:00.000Z");
    expect(resolveProviderDisabledGate("READY", due, due)).toBe(
      "PROVIDER_UNAVAILABLE",
    );
    expect(
      resolveProviderDisabledGate("READY", new Date(due.getTime() + 1), due),
    ).toBe("NOT_YET_DUE");
    for (const gate of [
      "CREATOR_SETUP_REQUIRED",
      "UNSUPPORTED_GEOGRAPHY_OR_RAIL",
      "FUNDING_REQUIRED",
      "RESOLUTION_BLOCKED",
    ] as const) {
      expect(resolveProviderDisabledGate(gate, due, due)).toBe(gate);
    }
  });

  it("uses non-overlapping current-outstanding priority", () => {
    const asOf = new Date("2026-09-08T12:00:00.000Z");
    expect(
      classifySummary(
        item({ lifecycle: "PROCESSING", effective_gate: "RESOLUTION_BLOCKED" }),
        asOf,
      ),
    ).toBe("PROCESSING");
    expect(
      classifySummary(
        item({ lifecycle: "ACTION_REQUIRED", effective_gate: "NOT_YET_DUE" }),
        asOf,
      ),
    ).toBe("DUE_OR_ACTION_REQUIRED");
    expect(
      classifySummary(
        item({
          lifecycle: "SCHEDULED",
          effective_gate: "NOT_YET_DUE",
          payment_due_at: "2026-09-09T12:00:00.000Z",
        }),
        asOf,
      ),
    ).toBe("UPCOMING");
    expect(
      classifySummary(
        item({
          lifecycle: "SETTLED",
          outstanding_value: { amount: "0.0000", currency: "INR" },
        }),
        asOf,
      ),
    ).toBeNull();
    expect(
      classifySummary(
        item({
          legacy: {
            classification: "DISPLAY_WITH_LIMITATION",
            limitation_reason_code: "UNPROVEN",
          },
        }),
        asOf,
      ),
    ).toBeNull();
  });

  it("keeps currencies separate and paid-to-date independent", () => {
    const asOf = new Date("2026-09-08T12:00:00.000Z");
    const summaries = summarizeCreatorPayouts(
      [
        item({
          lifecycle: "PROCESSING",
          settled_value: { amount: "20.0000", currency: "INR" },
        }),
        item({
          obligation_id: "usd",
          entitlement_value: { amount: "10.0000", currency: "USD" },
          outstanding_value: { amount: "10.0000", currency: "USD" },
          settled_value: { amount: "2.0000", currency: "USD" },
        }),
      ],
      asOf,
    );
    expect(summaries).toContainEqual({
      family: "PROCESSING",
      value: { amount: "100.0000", currency: "INR" },
    });
    expect(summaries).toContainEqual({
      family: "PAID_TO_DATE",
      value: { amount: "20.0000", currency: "INR" },
    });
    expect(summaries).toContainEqual({
      family: "PAID_TO_DATE",
      value: { amount: "2.0000", currency: "USD" },
    });
    expect(summaries).toHaveLength(8);
  });

  it("uses explicit selects and performs no write or provider method action", () => {
    const source = readFileSync(
      "src/features/creator-payouts/services/creator-payouts-obligation-projection.service.ts",
      "utf8",
    );
    expect(source).toContain("CreatorPayoutObligationSelect");
    expect(source).toContain("CANONICAL_C04");
    expect(source).toContain("PROVIDER_UNAVAILABLE");
    expect(source).not.toMatch(
      /\.(create|update|delete|upsert|executeRaw)\s*\(/,
    );
    expect(source).not.toMatch(
      /ProviderNeutralPayoutService|CreatorPayoutProviderPort|Razorpay/,
    );
  });
});

function item(
  overrides: Partial<CreatorPayoutObligationItem>,
): CreatorPayoutObligationItem {
  return {
    obligation_id: "obligation-1",
    public_reference: "payout-obligation:obligation-1",
    resource_version: "observed:2026-09-08T12:00:00.000Z",
    campaign_reference: "campaign-1",
    collaboration_reference: "collaboration-1",
    lifecycle: "SCHEDULED",
    effective_gate: "NOT_YET_DUE",
    blocking_reason_code: null,
    entitlement_value: { amount: "100.0000", currency: "INR" },
    settled_value: { amount: "0.0000", currency: "INR" },
    outstanding_value: { amount: "100.0000", currency: "INR" },
    payment_due_at: "2026-09-09T12:00:00.000Z",
    settlement_eligible_at: "2026-09-02T12:00:00.000Z",
    payment_term: "NET_7",
    last_observed_at: "2026-09-08T12:00:00.000Z",
    legacy: null,
    ...overrides,
  };
}
