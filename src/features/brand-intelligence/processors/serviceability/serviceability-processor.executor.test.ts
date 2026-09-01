import { describe, expect, it } from "vitest";
import { ServiceabilitySemanticValidator } from "../../contracts/validation/serviceability.semantic-validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { verifiedOutputZodSchema } from "../../contracts/validation/verified-output-zod-schema";
import { contracts } from "../visual-style/visual-style.test-fixtures";
import type {
  EvidenceManifestEntry,
  SemanticValidationContext,
} from "../../contracts/validation/validation.types";
import type {
  ServiceabilityOutput,
  ServiceabilityMetadata,
} from "./serviceability.types";

const validator = new ServiceabilitySemanticValidator();
const payload = (
  scope: "COUNTRY" | "GLOBAL" | "LOCAL" = "COUNTRY",
  candidate: string | null = null,
) => ({
  source_url: "https://example.test/shipping",
  source_locator: "main",
  page_role: "POLICY",
  subject_scope: candidate ? "OFFERING_SPECIFIC" : "BRAND_LEVEL",
  authorship: "BRAND_AUTHORED",
  evidence_semantic: "first_party_serviceability_observation",
  observation_type:
    scope === "GLOBAL"
      ? "DIGITAL_REMOTE_AVAILABILITY"
      : scope === "LOCAL"
        ? "SERVICE_AREA_STATEMENT"
        : "SHIPPING_DELIVERY_GEOGRAPHY",
  coverage_modality:
    scope === "GLOBAL"
      ? "DIGITAL_REMOTE"
      : scope === "LOCAL"
        ? "BOOKING_SERVICE"
        : "SHIPPING_DELIVERY",
  geography_assertions: [
    {
      polarity: "SUPPORTED",
      scope,
      country_code: scope === "GLOBAL" ? null : "IN",
      region: null,
      locality: scope === "LOCAL" ? "Delhi" : null,
      radius_km: null,
    },
  ],
  offering_ref: null,
  offering_candidate_ref: candidate,
  statement_or_normalized_fact:
    scope === "GLOBAL"
      ? "Service is explicitly available worldwide"
      : "Service is explicitly available in the stated area",
  evidence_strength: "SPECIFIC_AVAILABILITY_STATEMENT",
});
const evidence = (
  ref: string,
  data = payload(),
  capabilityId = "owned_website.serviceability_evidence",
): EvidenceManifestEntry => ({
  evidenceRef: ref,
  capabilityId,
  semanticId: ref,
  revisionIdentity: "v1",
  normalizedPayload: data,
  freshness: "CURRENT",
  sourceClass: "OWNED_WEBSITE",
  polarity: "AFFIRMATIVE",
});
const locationPayload = (canonicalLocationRef: string) => ({
  source_url: "https://example.test/locations",
  source_locator: "address:0",
  page_role: "LOCATION",
  subject_scope: "BRAND_LEVEL",
  authorship: "BRAND_AUTHORED",
  evidence_semantic: "first_party_location_observation",
  observation_type: "PHYSICAL_ADDRESS_OR_PRESENCE",
  candidate_location_ref: null,
  canonical_location_ref: canonicalLocationRef,
  geography_assertion: {
    polarity: "SUPPORTED",
    scope: "COUNTRY",
    country_code: "IN",
    region: null,
    locality: null,
    radius_km: null,
  },
  booking_or_access_ref: null,
  offering_ref: null,
  statement_or_normalized_fact: "Delhi office",
  observed_name: "Delhi office",
  street_address: "10 Main Street",
  city: "Delhi",
  region: null,
  postal_code: null,
  country: "India",
  latitude: null,
  longitude: null,
  telephone: null,
  email: null,
  source_location_identifier: null,
});
const meta = (
  refs: string[],
  semantic_id?: string,
): ServiceabilityMetadata & { semantic_id?: string } => ({
  ...(semantic_id ? { semantic_id } : {}),
  authority: "CREATOR_SHOP_DERIVED",
  source_class: "OWNED_WEBSITE",
  freshness: "CURRENT",
  evidence_refs: refs,
  business_state_refs: null,
});
const countryOutput = (ref = "e1"): ServiceabilityOutput => ({
  serviceability_profile: {
    overall_scope: "COUNTRY",
    coverage_is_heterogeneous: false,
    serviceable_markets: [
      {
        semantic_id: "country:IN",
        scope: "COUNTRY",
        label: "India",
        country_code: "IN",
        locality: null,
        region: null,
        radius_km: null,
      },
    ],
    serviceability_basis: [
      {
        semantic_id: `shipping:${ref}`,
        basis_type: "SHIPPING_OR_DELIVERY_POLICY",
        business_state_refs: null,
        evidence_refs: [ref],
        applies_to_market_refs: ["country:IN"],
        offering_refs: null,
      },
    ],
    mixed_coverage_note: null,
  },
  output_metadata: {
    overall_scope: meta([ref]),
    coverage_is_heterogeneous: meta([ref]),
    serviceable_markets: [meta([ref], "country:IN") as never],
    serviceability_basis: [meta([ref], `shipping:${ref}`) as never],
    mixed_coverage_note: null,
  },
});
const context = (
  entries: EvidenceManifestEntry[],
  businessStateManifest: SemanticValidationContext["businessStateManifest"] = [],
): SemanticValidationContext =>
  ({
    bundle: {} as SemanticValidationContext["bundle"],
    evidenceManifest: entries,
    businessStateManifest,
  }) as SemanticValidationContext;

describe("serviceability_synthesis bounded validation", () => {
  it("accepts the evidence-only country shape through the frozen structural contract", () => {
    const bundle = contracts().getVerifiedBundle({
      processorId: "serviceability_synthesis",
      processorVersion: "1.0",
      outputContractId: "serviceability_synthesis_output_contract",
      outputContractVersion: "1.0",
    });
    expect(
      new StructuralValidator().validate(bundle, countryOutput()).issues,
    ).toEqual([]);
    expect(
      verifiedOutputZodSchema(bundle).safeParse(countryOutput()).success,
    ).toBe(true);
  });
  it("accepts nationwide evidence-only execution without Offering availability refs", () => {
    expect(
      validator.validate(countryOutput(), context([evidence("e1")])),
    ).toEqual([]);
    expect(
      countryOutput().serviceability_profile?.serviceability_basis?.[0]
        .business_state_refs,
    ).toBeNull();
  });
  it("allows explicit grounded global digital availability", () => {
    const out = countryOutput();
    const p = out.serviceability_profile!;
    const global: ServiceabilityOutput = {
      ...out,
      serviceability_profile: {
        ...p,
        overall_scope: "GLOBAL",
        serviceable_markets: [
          {
            semantic_id: "global",
            scope: "GLOBAL",
            label: "Global",
            country_code: null,
            locality: null,
            region: null,
            radius_km: null,
          },
        ],
        serviceability_basis: [
          {
            semantic_id: "digital:e1",
            basis_type: "DIGITAL_SERVICE_AVAILABILITY",
            business_state_refs: null,
            evidence_refs: ["e1"],
            applies_to_market_refs: ["global"],
            offering_refs: null,
          },
        ],
      },
      output_metadata: {
        ...out.output_metadata,
        serviceable_markets: [meta(["e1"], "global") as never],
        serviceability_basis: [meta(["e1"], "digital:e1") as never],
      },
    };
    expect(
      validator.validate(global, context([evidence("e1", payload("GLOBAL"))])),
    ).toEqual([]);
  });
  it("rejects GLOBAL without an explicit GLOBAL assertion", () => {
    const base = countryOutput();
    const out: ServiceabilityOutput = {
      ...base,
      serviceability_profile: {
        ...base.serviceability_profile!,
        overall_scope: "GLOBAL",
      },
    };
    expect(
      validator
        .validate(out, context([evidence("e1")]))
        .map((item) => item.code),
    ).toContain("SERVICEABILITY_GLOBAL_UNSAFE");
  });
  it("rejects canonical Offering availability basis while unavailable", () => {
    const base = countryOutput();
    const out: ServiceabilityOutput = {
      ...base,
      serviceability_profile: {
        ...base.serviceability_profile!,
        serviceability_basis: [
          {
            ...base.serviceability_profile!.serviceability_basis![0],
            basis_type: "CANONICAL_OFFERING_AVAILABILITY",
          },
        ],
      },
    };
    expect(
      validator
        .validate(out, context([evidence("e1")]))
        .map((item) => item.code),
    ).toContain("SERVICEABILITY_CANONICAL_AVAILABILITY_UNAVAILABLE");
  });
  it("accepts canonical Location coverage only with matching service, Location, and business refs", () => {
    const base = countryOutput();
    const basis = {
      ...base.serviceability_profile!.serviceability_basis![0],
      basis_type: "CANONICAL_LOCATION_COVERAGE" as const,
      business_state_refs: ["location-ref"],
      evidence_refs: ["e1", "l1"],
    };
    const out: ServiceabilityOutput = {
      ...base,
      serviceability_profile: {
        ...base.serviceability_profile!,
        serviceability_basis: [basis],
      },
      output_metadata: {
        ...base.output_metadata,
        serviceability_basis: [
          {
            ...meta(["e1", "l1"], basis.semantic_id),
            business_state_refs: ["location-ref"],
          } as never,
        ],
      },
    };
    expect(
      validator.validate(
        out,
        context(
          [
            evidence("e1"),
            evidence(
              "l1",
              locationPayload("location-1"),
              "owned_website.location_evidence",
            ),
          ],
          [
            {
              businessStateRef: "location-ref",
              semanticId: "location:location-1",
              revisionIdentity: "v1",
            },
          ],
        ),
      ),
    ).toEqual([]);
  });
  it("rejects unknown Evidence and business-state references", () => {
    const base = countryOutput();
    const out: ServiceabilityOutput = {
      ...base,
      serviceability_profile: {
        ...base.serviceability_profile!,
        serviceability_basis: [
          {
            ...base.serviceability_profile!.serviceability_basis![0],
            evidence_refs: ["unknown"],
            business_state_refs: ["unknown-state"],
          },
        ],
      },
    };
    expect(
      validator
        .validate(out, context([evidence("e1")]))
        .map((item) => item.code),
    ).toContain("SERVICEABILITY_BASIS_REFERENCE_INVALID");
  });
  it("permits explicit heterogeneous Offering-candidate coverage", () => {
    const base = countryOutput("a");
    const out: ServiceabilityOutput = {
      ...base,
      serviceability_profile: {
        ...base.serviceability_profile!,
        coverage_is_heterogeneous: true,
        mixed_coverage_note:
          "One explicitly scoped service is local while another is nationwide.",
      },
      output_metadata: {
        ...base.output_metadata,
        mixed_coverage_note: meta(["a", "b"]),
      },
    };
    const local = payload("LOCAL", "service-a");
    const national = payload("COUNTRY", "service-b");
    expect(
      validator
        .validate(out, context([evidence("a", local), evidence("b", national)]))
        .map((item) => item.code),
    ).not.toContain("SERVICEABILITY_HETEROGENEOUS_COVERAGE_UNSUPPORTED");
  });
  it("rejects invented heterogeneity without explicit differences", () => {
    const base = countryOutput();
    const out: ServiceabilityOutput = {
      ...base,
      serviceability_profile: {
        ...base.serviceability_profile!,
        coverage_is_heterogeneous: true,
        mixed_coverage_note: "Coverage differs.",
      },
      output_metadata: {
        ...base.output_metadata,
        mixed_coverage_note: meta(["e1"]),
      },
    };
    expect(
      validator
        .validate(out, context([evidence("e1")]))
        .map((item) => item.code),
    ).toContain("SERVICEABILITY_HETEROGENEOUS_COVERAGE_UNSUPPORTED");
  });
  it("rejects duplicate market identity and missing grounding", () => {
    const base = countryOutput();
    const out: ServiceabilityOutput = {
      ...base,
      serviceability_profile: {
        ...base.serviceability_profile!,
        serviceable_markets: [
          ...base.serviceability_profile!.serviceable_markets!,
          base.serviceability_profile!.serviceable_markets![0],
        ],
      },
    };
    expect(validator.validate(out, context([evidence("e1")]))).not.toEqual([]);
  });
  it("keeps null output valid without filler", () => {
    const out: ServiceabilityOutput = {
      serviceability_profile: null,
      output_metadata: {
        overall_scope: null,
        coverage_is_heterogeneous: null,
        serviceable_markets: null,
        serviceability_basis: null,
        mixed_coverage_note: null,
      },
    };
    expect(validator.validate(out, context([]))).toEqual([]);
  });
});
