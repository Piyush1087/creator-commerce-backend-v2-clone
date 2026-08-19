import { describe, expect, it } from "vitest";

import {
  canonicalDerivedProjection,
  type CanonicalObjective,
  resolveCanonicalCampaignReadiness,
} from "./canonical-campaign-readiness.resolver";

const OBJECTIVES: CanonicalObjective[] = [
  "PULSE",
  "PROOF",
  "PRODUCTION",
  "PUSH",
];
const INDUSTRIES = ["D2C", "SAAS_AI", "HEALTHCARE"] as const;

describe("canonical Campaign readiness resolver", () => {
  it.each(OBJECTIVES)(
    "resolves %s for every supported industry",
    (objective) => {
      for (const industry of INDUSTRIES) {
        const result = resolveCanonicalCampaignReadiness(
          objective,
          industry,
          "IN",
        );
        expect(result.status).toBe("READY");
        if (result.status === "READY") {
          expect(result.objective).toBe(objective);
          expect(result.primaryKpi).toBeTruthy();
          expect(result.supportingKpis).toHaveLength(4);
          expect(result.revision).toBe(`objective:${objective}`);
        }
      }
    },
  );

  it.each([
    ["IN", "INR"],
    ["in", "INR"],
    ["US", "USD"],
    [null, "USD"],
  ] as const)("maps country %s to %s", (countryCode, currency) => {
    const result = resolveCanonicalCampaignReadiness(
      "PULSE",
      "D2C",
      countryCode,
    );
    expect(result.status).toBe("READY");
    if (result.status === "READY") expect(result.currency).toBe(currency);
  });

  it("returns a stable non-retryable configuration failure", () => {
    expect(
      resolveCanonicalCampaignReadiness("PULSE", "UNSUPPORTED", "IN"),
    ).toEqual({
      objective: "PULSE",
      status: "FAILED",
      reason: "SUPPORTING_KPI_CONFIGURATION_UNAVAILABLE",
      retryable: false,
      revision: "objective:PULSE",
    });
  });

  it("is deterministic and does not expose mutable configuration arrays", () => {
    const first = resolveCanonicalCampaignReadiness("PROOF", "D2C", "IN");
    const second = resolveCanonicalCampaignReadiness("PROOF", "D2C", "IN");
    expect(first).toEqual(second);
    if (first.status === "READY") first.supportingKpis.push("MUTATED");
    const third = resolveCanonicalCampaignReadiness("PROOF", "D2C", "IN");
    expect(third).toEqual(second);
  });

  it("produces the exact projection consumed by publication", () => {
    const readiness = resolveCanonicalCampaignReadiness(
      "PUSH",
      "SAAS_AI",
      "US",
    );
    expect(readiness.status).toBe("READY");
    if (readiness.status !== "READY")
      throw new Error("Expected ready configuration");
    expect(canonicalDerivedProjection(readiness)).toEqual({
      currency: "USD",
      primaryKpi: "UNIQUE_CTA_CLICKS",
      supportingKpis: [
        "CTR",
        "LANDING_PAGE_VISITS",
        "DOCUMENTATION_CLICKS",
        "TRIAL_PAGE_VISITS",
      ],
      supportingKpiStatus: "READY",
    });
  });
});
