import { describe, expect, it } from "vitest";
import { retainOwnedSiteObservations } from "../../acquisition/owned-site-observation-fragment";
import { inferPageRole } from "../../acquisition/owned-website-wave1-acquisition.service";
import {
  asBrandId,
  asCaptureRef,
  asResourceRef,
} from "../../domain/evidence-identities";
import type {
  EvidencePageRole,
  Wave2EvidenceCapabilityId,
} from "../../domain/evidence-vocabulary";
import type {
  DataExtractionNormalizationInput,
  DataExtractionNormalizationSource,
} from "../owned-website-wave1-normalizers";
import { WAVE2_NORMALIZERS, wave2Conflict } from "./wave2-normalizers";
import {
  locationEvidenceSchema,
  proofEvidenceSchema,
  serviceabilityEvidenceSchema,
  visualEvidenceSchema,
} from "./wave2-evidence-contracts";

const proof = "explicit_factual_proof_or_claim_evidence";
const visual = "owned_website.visual_evidence";
const service = "owned_website.serviceability_evidence";
const location = "owned_website.location_evidence";
function source(
  html: string,
  path = "/",
  pageRole: EvidencePageRole = "HOMEPAGE",
): DataExtractionNormalizationSource {
  return {
    resource: {
      brandId: asBrandId("brand:test"),
      resourceRef: asResourceRef(`resource:${path}`),
      sourceClass: "OWNED_WEBSITE",
      resourceType: "OWNED_WEB_PAGE",
      canonicalResourceKey: `https://brand.example${path}`,
      canonicalUrl: `https://brand.example${path}`,
      aliases: [],
      pageRole,
      createdAt: "2026-08-26T00:00:00Z",
    },
    capture: {
      brandId: asBrandId("brand:test"),
      captureRef: asCaptureRef(`capture:${path}`),
      resourceRef: asResourceRef(`resource:${path}`),
      acquisitionRequestKey: path,
      startedAt: "2026-08-26T00:00:00Z",
      capturedAt: "2026-08-26T00:00:01Z",
      acquisitionQuality: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      providerExecutionRefs: [],
    },
    normalizedText: "",
    acquiredSourceBody: html,
    freshness: {
      state: "CURRENT",
      basis: "SAME_ACTIVE_RUN",
      evaluatedAt: "2026-08-26T00:00:01Z",
    },
  };
}
function normalize(
  capability: Wave2EvidenceCapabilityId,
  sources: DataExtractionNormalizationSource[],
  mappings?: DataExtractionNormalizationInput["locationReconciliations"],
) {
  const normalizer = WAVE2_NORMALIZERS.find(
    (candidate) => candidate.capabilityId === capability,
  )!;
  return normalizer.normalize({
    execution: {
      capabilityId: capability,
    } as DataExtractionNormalizationInput["execution"],
    sources,
    parentEvidence: [],
    locationReconciliations: mappings,
  });
}

describe("DE-W2 proof/claim semantics", () => {
  it("does not reinterpret Wave-1 conflict families as contradictions", () => {
    const drafts = normalize(proof, [
      source("<p>We were founded in 2001.</p><p>We were founded in 2010.</p>"),
    ]).drafts;
    expect(
      wave2Conflict(
        {
          ...drafts[0],
          boundedNormalizedPayload: { message_text: "We help teams grow." },
        },
        {
          ...drafts[1],
          boundedNormalizedPayload: { message_text: "Our mission is clear." },
        },
      ),
    ).toBe(false);
  });
  it("preserves a factual statement and marketing assertion without verifying either", () => {
    const result = normalize(proof, [
      source(
        "<p>We were founded in 2001.</p><p>We are the leading and best brand.</p>",
      ),
    ]);
    const payloads = result.drafts.map((d) =>
      proofEvidenceSchema.parse(d.boundedNormalizedPayload),
    );
    expect(payloads.map((p) => p.proof_class)).toEqual([
      "DIRECT_FIRST_PARTY_FACTUAL_SUPPORT",
      "BRAND_AUTHORED_ASSERTION",
    ]);
    expect(
      payloads.every(
        (p) => p.verification_status === "NOT_EXTERNALLY_VERIFIED",
      ),
    ).toBe(true);
    expect(payloads[0].statement).toBe("We were founded in 2001.");
  });
  it.each([
    "Our treatment cures diabetes.",
    "Our diagnostic accuracy is 99%.",
    "Clinically proven to deliver superior results.",
    "We guarantee a 100% success rate.",
    "Our treatment is safe without side effects.",
  ])("does not promote sensitive claim to proof: %s", (text) => {
    const payload = proofEvidenceSchema.parse(
      normalize(proof, [source(`<p>${text}</p>`)]).drafts[0]
        .boundedNormalizedPayload,
    );
    expect(payload.proof_strength).toBe("FIRST_PARTY_CLAIM");
    expect(payload.proof_class).toBe("CLAIM_REQUIRING_EXTERNAL_VERIFICATION");
    expect(payload.claim_sensitivity.length).toBeGreaterThan(0);
  });
  it("separates credentials, testimonials and unverifiable performance", () => {
    const result = normalize(proof, [
      source(
        "<p>We are ISO 9001 certified.</p><blockquote>The treatment cured me completely.</blockquote><p>Independently proven 2x performance.</p>",
      ),
    ]);
    expect(
      result.drafts.map((d) => d.boundedNormalizedPayload.proof_strength),
    ).toEqual([
      "EXPLICIT_CERTIFICATION_OR_CREDENTIAL",
      "TESTIMONIAL_OR_SOCIAL_PROOF",
      "FIRST_PARTY_CLAIM",
    ]);
  });
  it("keeps offering-specific proof scoped even on a homepage", () => {
    const result = normalize(proof, [
      source(
        '<div data-offering="premium"><p>Our product is certified for professional use.</p></div>',
      ),
    ]);
    expect(result.drafts[0].boundedNormalizedPayload.scope).toBe(
      "OFFERING_SPECIFIC",
    );
    expect(result.drafts[0].representativeness).toBe("OFFERING_SPECIFIC");
  });
  it("keeps conflicting factual statements with explicit conflict candidates", () => {
    const result = normalize(proof, [
      source("<p>We were founded in 2001.</p><p>We were founded in 2010.</p>"),
    ]);
    expect(result.drafts).toHaveLength(2);
    expect(wave2Conflict(result.drafts[0], result.drafts[1])).toBe(true);
  });
  it("emits no invented fact on empty/irrelevant content or unknown authorship", () => {
    expect(
      normalize(proof, [source("<p>Welcome to our website.</p>")]).drafts,
    ).toEqual([]);
    const raw = { ...source(""), normalizedText: "We were founded in 2001." };
    expect(
      normalize(proof, [raw]).drafts[0].boundedNormalizedPayload.proof_strength,
    ).toBe("FIRST_PARTY_CLAIM");
  });
});

describe("DE-W2 visual observations", () => {
  const html =
    '<style>body { color: #112233; font-family: Inter; display: grid; } .missing { color: red; }</style><body><img alt="Brand logo" src="/logo.svg"><p>Welcome to our company website.</p></body>';
  it("retains bounded declarations and logo observations, not approved state", () => {
    const result = normalize(visual, [source(html)]);
    expect(result.drafts).toHaveLength(4);
    const payloads = result.drafts.map((d) =>
      visualEvidenceSchema.parse(d.boundedNormalizedPayload),
    );
    expect(payloads.map((p) => p.evidence_semantic)).toContain(
      "LOGO_OR_MARK_OBSERVATION",
    );
    expect(
      payloads.every(
        (p) => p.canonical_asset_ref === null && !p.computed_or_rendered,
      ),
    ).toBe(true);
    expect(JSON.stringify(payloads)).not.toMatch(
      /approved_palette|approved_typography|primary_logo/,
    );
    expect(result.drafts[0].representativeness).toBe("PERSISTENT_BRAND_LEVEL");
  });
  it("groups repeated declarations across resources without collapsing lineage", () => {
    const result = normalize(visual, [
      source(html),
      source(html, "/about", "ABOUT_COMPANY"),
    ]);
    expect(result.drafts).toHaveLength(8);
    expect(
      result.drafts.every(
        (d) => d.representativeness === "REPEATED_REPRESENTATIVE",
      ),
    ).toBe(true);
    expect(
      new Set(result.drafts.map((d) => d.source.capture.captureRef)).size,
    ).toBe(2);
  });
  it("preserves external CSS and non-rendered limitations without guessing style", () => {
    const fragment = retainOwnedSiteObservations(
      '<link rel="stylesheet" href="/main.css"><body><p>No inline styles here.</p></body>',
    );
    expect(fragment.visuals).toEqual([]);
    expect(fragment.limitations).toContain("EXTERNAL_STYLESHEETS_NOT_FETCHED");
  });
  it("does not promote conditional CSS or hidden declarations into observed usage", () => {
    const fragment = retainOwnedSiteObservations(
      '<style>@media (max-width: 600px) { body { color: red; } } body:hover { color: blue; }</style><body><p hidden style="color:green">Hidden</p></body>',
    );
    expect(fragment.visuals).toEqual([]);
  });
  it("retains source descriptors beyond the old 60k body and enforces bounds", () => {
    const fragment = retainOwnedSiteObservations(
      `<!--${"x".repeat(70_000)}--><body style="color:#abc"><p>We were founded in 2001.</p></body>`,
    );
    expect(fragment.visuals[0].value).toBe("#abc");
    const large = retainOwnedSiteObservations(
      "<p>We were founded in 2001.</p>".repeat(200),
    );
    expect(large.statements).toHaveLength(80);
    expect(large.limitations).toContain("STATEMENT_LIMIT");
  });
});

describe("DE-W2 serviceability", () => {
  it.each([
    "Shipping is not available worldwide.",
    "We don't ship to India.",
    "Delivery isn't available in Canada.",
    "No shipping to Australia.",
  ])("does not turn negative geography into support: %s", (text) => {
    const draft = normalize(service, [source(`<p>${text}</p>`)]).drafts[0];
    const payload = serviceabilityEvidenceSchema.parse(
      draft.boundedNormalizedPayload,
    );
    expect(draft.polarity).toBe("EXPLICIT_NEGATIVE");
    expect(payload.geography_assertions).toHaveLength(1);
    expect(payload.geography_assertions[0].polarity).toBe("EXCLUDED");
  });
  it("retains global support with a separately excluded country in one statement", () => {
    const payload = serviceabilityEvidenceSchema.parse(
      normalize(service, [source("<p>We ship worldwide except India.</p>")])
        .drafts[0].boundedNormalizedPayload,
    );
    expect(
      payload.geography_assertions.map((a) => [a.scope, a.polarity]),
    ).toEqual([
      ["GLOBAL", "SUPPORTED"],
      ["COUNTRY", "EXCLUDED"],
    ]);
  });
  it("scopes a Brand shipping policy distinctly from an Offering detail", () => {
    const url = "https://brand.example/shipping-policy";
    expect(inferPageRole(url)).toBe("POLICY");
    const result = normalize(service, [
      source(
        "<p>We ship nationwide.</p>",
        "/shipping-policy",
        inferPageRole(url),
      ),
    ]);
    expect(result.drafts[0].boundedNormalizedPayload.subject_scope).toBe(
      "BRAND_LEVEL",
    );
  });
  it.each([
    "We ship nationwide.",
    "We serve customers in Delhi NCR.",
    "Available in selected states.",
    "Our service radius is 20 km.",
    "Our digital product is available worldwide.",
    "We are online-only.",
  ])("retains explicit availability: %s", (text) => {
    const result = normalize(service, [source(`<p>${text}</p>`)]);
    expect(result.drafts).toHaveLength(1);
    expect(
      serviceabilityEvidenceSchema.parse(
        result.drafts[0].boundedNormalizedPayload,
      ).statement_or_normalized_fact,
    ).toBe(text);
  });
  it("preserves explicit exclusions and contradictions without resolving them", () => {
    const result = normalize(service, [
      source(
        "<p>We ship worldwide.</p><p>We do not ship to India.</p><p>Only available in Delhi NCR.</p>",
      ),
    ]);
    expect(result.drafts).toHaveLength(3);
    expect(result.drafts[1].polarity).toBe("EXPLICIT_NEGATIVE");
    expect(result.drafts[2].polarity).toBe("RESTRICTION");
    expect(wave2Conflict(result.drafts[0], result.drafts[1])).toBe(true);
  });
  it("does not infer serviceability from website accessibility, HQ, audience or international alone", () => {
    const result = normalize(service, [
      source(
        "<p>Our website is available worldwide.</p><p>Our headquarters are in Delhi.</p><p>Our audience is global.</p>",
      ),
    ]);
    expect(result.drafts).toEqual([]);
    const international = normalize(service, [
      source("<p>International shipping is available.</p>"),
    ]);
    expect(
      international.drafts[0].boundedNormalizedPayload.geography_assertions,
    ).toEqual([]);
  });
  it("keeps Offering scope distinct and does not create canonical availability", () => {
    const result = normalize(service, [
      source(
        "<p>Our premium plan is available in India.</p>",
        "/products/premium",
        "PORTFOLIO_OVERVIEW",
      ),
    ]);
    expect(result.drafts[0].representativeness).toBe("OFFERING_SPECIFIC");
    expect(result.drafts[0].boundedNormalizedPayload.offering_ref).toBeNull();
  });
  it("keeps mixed supported and excluded countries distinct", () => {
    const result = normalize(service, [
      source("<p>We ship to India and Canada except Australia.</p>"),
    ]);
    expect(
      result.drafts[0].boundedNormalizedPayload.geography_assertions,
    ).toMatchObject([
      { country_code: "IN", polarity: "SUPPORTED" },
      { country_code: "CA", polarity: "SUPPORTED" },
      { country_code: "AU", polarity: "EXCLUDED" },
    ]);
  });
});

describe("DE-W2 observed Locations", () => {
  const entry = {
    "@type": "MedicalClinic",
    "@id": "source-branch",
    name: "Central Clinic",
    address: {
      "@type": "PostalAddress",
      streetAddress: "10 Main St",
      addressLocality: "Delhi",
      addressRegion: "Delhi",
      postalCode: "110001",
      addressCountry: "IN",
    },
    geo: { latitude: 28.61, longitude: 77.2 },
    telephone: "+911234567890",
    canonical_location_ref: "untrusted-website-id",
  };
  const html = `<script type="application/ld+json">${JSON.stringify([entry, entry, { ...entry, name: "Other Clinic", address: "20 Main St" }])}</script>`;
  it("retains multiple and duplicate-looking locations with explicit fields and no canonical identity", () => {
    const result = normalize(location, [source(html)]);
    expect(result.drafts).toHaveLength(3);
    expect(new Set(result.drafts.map((d) => d.itemFingerprint)).size).toBe(3);
    expect(
      new Set(result.drafts.map((d) => d.semanticObservationKey)).size,
    ).toBe(3);
    const payloads = result.drafts.map((d) =>
      locationEvidenceSchema.parse(d.boundedNormalizedPayload),
    );
    expect(payloads[0]).toMatchObject({
      city: "Delhi",
      postal_code: "110001",
      latitude: 28.61,
      telephone: "+911234567890",
    });
    expect(
      payloads.every(
        (p) =>
          p.canonical_location_ref === null &&
          p.candidate_location_ref === null,
      ),
    ).toBe(true);
  });
  it("carries only an application-supplied exact capture/locator reconciliation", () => {
    const result = normalize(
      location,
      [source(html)],
      [
        {
          captureRef: "capture:/",
          sourceLocator: "jsonld:0:0",
          canonicalLocationRef: "application-location",
        },
      ],
    );
    expect(
      result.drafts.map(
        (d) => d.boundedNormalizedPayload.canonical_location_ref,
      ),
    ).toEqual(["application-location", null, null]);
  });
  it("keeps ambiguous address blocks distinct and absence never means closed", () => {
    const result = normalize(location, [
      source(
        "<address>Central office</address><address>Central office</address>",
      ),
    ]);
    expect(result.drafts).toHaveLength(2);
    expect(
      normalize(location, [source("<p>Welcome back to our website.</p>")])
        .drafts,
    ).toEqual([]);
  });
  it("does not use arbitrary JSON addresses, malformed JSON, or product shipping destinations as locations", () => {
    expect(
      normalize(location, [
        source(
          '<script type="application/ld+json">{"@type":"Product","address":"India"}</script><script type="application/ld+json">invalid</script>',
        ),
      ]).drafts,
    ).toEqual([]);
  });
});
