import { describe, expect, it } from "vitest";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import { serviceabilityItemPath } from "./serviceability-identity";
import {
  serviceabilityComponentPlan,
  serviceabilityOutputReadiness,
} from "./serviceability-plan";
import type { ServiceabilityCurrentState } from "./serviceability-state.repository";
import type { ServiceabilityOutput } from "./serviceability.types";

const brandId = "brand";
const scope: readonly ComponentSemanticAddress[] = [
  {
    brandId,
    objectSemanticId: "serviceability_profile",
    componentSemanticPath: "$",
    pathSchemeVersion: 1,
  },
];
const metadata = (semantic_id?: string) => ({
  ...(semantic_id ? { semantic_id } : {}),
  authority: "CREATOR_SHOP_DERIVED" as const,
  source_class: "OWNED_WEBSITE" as const,
  freshness: "CURRENT" as const,
  evidence_refs: ["e1"],
  business_state_refs: null,
});
const output = (label = "India"): ServiceabilityOutput => ({
  serviceability_profile: {
    overall_scope: "COUNTRY",
    coverage_is_heterogeneous: false,
    serviceable_markets: [
      {
        semantic_id: "country:IN",
        scope: "COUNTRY",
        label,
        country_code: "IN",
        locality: null,
        region: null,
        radius_km: null,
      },
    ],
    serviceability_basis: null,
    mixed_coverage_note: null,
  },
  output_metadata: {
    overall_scope: metadata(),
    coverage_is_heterogeneous: metadata(),
    serviceable_markets: [metadata("country:IN")],
    serviceability_basis: null,
    mixed_coverage_note: null,
  },
});
const current = (
  path: string,
  value: unknown,
  protectionState: "UNPROTECTED" | "BRAND_CONFIRMED" = "UNPROTECTED",
): ServiceabilityCurrentState =>
  ({
    brandId,
    objectSemanticId: "serviceability_profile",
    componentSemanticPath: path,
    currentComponentGenerationId: `generation:${path}`,
    revision: 1n,
    protectionState,
    lifecycle: "ACTIVE",
    currentComponentGeneration: { valuePayload: value },
  }) as unknown as ServiceabilityCurrentState;

describe("serviceability reconciliation plan", () => {
  it("preserves semantic identity across wording changes and reorder-independent paths", () => {
    const path = serviceabilityItemPath("serviceable_markets", "country:IN");
    const plans = serviceabilityComponentPlan(
      output("Republic of India"),
      [
        current("$", {}),
        current("$/f/serviceable_markets", []),
        current(path, { semantic_id: "country:IN" }),
        current(`${path}/f/label`, "India"),
      ],
      scope,
    );
    expect(plans.some((plan) => plan.path === `${path}/f/label`)).toBe(true);
    expect(plans.some((plan) => plan.path.includes("Republic of India"))).toBe(
      false,
    );
  });

  it("never treats omitted prior market or basis items as deletion", () => {
    const oldMarket = serviceabilityItemPath(
      "serviceable_markets",
      "country:GB",
    );
    const oldBasis = serviceabilityItemPath(
      "serviceability_basis",
      "shipping:gb",
    );
    const plans = serviceabilityComponentPlan(
      output(),
      [
        current("$", {}),
        current(oldMarket, { semantic_id: "country:GB" }),
        current(oldBasis, { semantic_id: "shipping:gb" }),
      ],
      scope,
    );
    expect(plans.some((plan) => plan.path.startsWith(oldMarket))).toBe(false);
    expect(plans.some((plan) => plan.path.startsWith(oldBasis))).toBe(false);
  });

  it("routes protected item changes into a protected plan and rejects root bypass", () => {
    const path = serviceabilityItemPath("serviceable_markets", "country:IN");
    const plans = serviceabilityComponentPlan(
      output("Updated India"),
      [
        current("$", {}),
        current("$/f/serviceable_markets", []),
        current(path, { semantic_id: "country:IN" }, "BRAND_CONFIRMED"),
        current(`${path}/f/scope`, "COUNTRY"),
        current(`${path}/f/label`, "India"),
        current(`${path}/f/country_code`, "IN"),
        current(`${path}/f/locality`, null),
        current(`${path}/f/region`, null),
        current(`${path}/f/radius_km`, null),
      ],
      scope,
    );
    expect(plans.find((plan) => plan.path === path)?.value).toMatchObject({
      semantic_id: "country:IN",
      label: "Updated India",
    });
    expect(() =>
      serviceabilityComponentPlan(
        output(),
        [current("$", {}, "BRAND_CONFIRMED")],
        scope,
      ),
    ).toThrowError("SERVICEABILITY_PROTECTED_ROOT_REQUIRES_RESOLUTION");
  });

  it("keeps sparse and null outputs consumer-bounded", () => {
    expect(serviceabilityOutputReadiness(output())).toBe("PARTIAL");
    expect(
      serviceabilityOutputReadiness({
        serviceability_profile: null,
        output_metadata: {
          overall_scope: null,
          coverage_is_heterogeneous: null,
          serviceable_markets: null,
          serviceability_basis: null,
          mixed_coverage_note: null,
        },
      }),
    ).toBe("NOT_READY");
  });
});
