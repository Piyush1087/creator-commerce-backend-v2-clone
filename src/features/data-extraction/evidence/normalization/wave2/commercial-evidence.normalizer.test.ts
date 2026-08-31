import { describe, expect, it } from "vitest";

import {
  asBrandId,
  asCaptureRef,
  asResourceRef,
} from "../../domain/evidence-identities";
import type { DataExtractionNormalizationSource } from "../owned-website-wave1-normalizers";
import { CommercialEvidenceNormalizer } from "./commercial-evidence.normalizer";
import { commercialEvidenceSchema } from "./wave2-evidence-contracts";
import { wave2Conflict } from "./wave2-normalizers";

const brandId = asBrandId("brand-commercial");
const offeringRef = "offering-commercial";

function source(
  suffix: string,
  html: string,
): DataExtractionNormalizationSource {
  const resourceRef = asResourceRef(`resource:${suffix}`);
  return {
    resource: {
      brandId,
      resourceRef,
      sourceClass: "OWNED_WEBSITE",
      resourceType: "OWNED_WEB_PAGE",
      canonicalResourceKey: `https://brand.example/${suffix}`,
      canonicalUrl: `https://brand.example/${suffix}`,
      aliases: [],
      pageRole: "OFFERING_DETAIL",
      createdAt: "2026-08-28T00:00:00.000Z",
    },
    capture: {
      brandId,
      captureRef: asCaptureRef(`capture:${suffix}`),
      resourceRef,
      acquisitionRequestKey: suffix,
      startedAt: "2026-08-28T00:00:00.000Z",
      capturedAt: "2026-08-28T00:00:01.000Z",
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
      evaluatedAt: "2026-08-28T00:00:01.000Z",
    },
  };
}

function normalize(
  sources: readonly DataExtractionNormalizationSource[],
  captureRefs: readonly string[] = sources.map(
    (entry) => entry.capture.captureRef,
  ),
) {
  return new CommercialEvidenceNormalizer().normalize({
    execution: {
      capabilityId: "owned_website.offering_commercial_evidence",
    } as never,
    sources,
    parentEvidence: [],
    exactOfferingScope: {
      canonicalOfferingRef: offeringRef,
      captureRefs,
    },
  });
}

function payload(html: string) {
  const result = normalize([source("offering", html)]);
  expect(result.drafts).toHaveLength(1);
  return commercialEvidenceSchema.parse(
    result.drafts[0].boundedNormalizedPayload,
  );
}

describe("P2B-2 exact Offering commercial normalization", () => {
  it("normalizes an exact current amount with inherited capture lineage", () => {
    expect(payload("<p>Price: INR 999.</p>")).toMatchObject({
      canonical_offering_ref: offeringRef,
      observed_price_mode: "EXACT",
      current_min_amount: 999,
      current_max_amount: 999,
      currency: "INR",
      observed_at: "2026-08-28T00:00:01.000Z",
      source_locator: expect.stringMatching(/^text:/),
    });
  });

  it("normalizes only an explicit starting-at statement", () => {
    expect(payload("<p>Plans start at USD 49.</p>")).toMatchObject({
      observed_price_mode: "STARTING_AT",
      current_min_amount: 49,
      current_max_amount: null,
      currency: "USD",
    });
  });

  it("normalizes an explicit same-unit range", () => {
    expect(payload("<p>Price range INR 1,000 - INR 1,200.</p>")).toMatchObject({
      observed_price_mode: "RANGE",
      current_min_amount: 1000,
      current_max_amount: 1200,
      currency: "INR",
    });
  });

  it("keeps an explicit not-public state distinct from absence", () => {
    expect(payload("<p>Contact us for pricing.</p>")).toMatchObject({
      observed_price_mode: "NOT_PUBLICLY_LISTED",
      explicit_not_publicly_listed: true,
      current_min_amount: null,
      current_max_amount: null,
    });
    expect(
      normalize([source("missing", "<p>Designed for professional teams.</p>")])
        .drafts,
    ).toEqual([]);
  });

  it("retains explicit regular and sale amounts without treating them as a range", () => {
    expect(payload("<p>Regular price USD 100, now USD 80.</p>")).toMatchObject({
      observed_price_mode: "EXACT",
      current_min_amount: 80,
      current_max_amount: 80,
      regular_reference_min_amount: 100,
      regular_reference_max_amount: 100,
      sale_or_reference_relationship: "CURRENT_IS_SALE_WITH_REGULAR_REFERENCE",
    });
  });

  it("retains a bare ambiguous dollar amount without fabricating ISO currency", () => {
    expect(payload("<p>Price: $99.</p>")).toMatchObject({
      observed_price_mode: "EXACT",
      current_min_amount: 99,
      currency: null,
    });
  });

  it("fails closed for sibling captures and for missing exact reconciliation", () => {
    const exact = source("exact", "<p>Price: INR 999.</p>");
    const sibling = source("sibling", "<p>Price: INR 1099.</p>");
    const isolated = normalize([exact, sibling], [exact.capture.captureRef]);
    expect(isolated.drafts).toHaveLength(1);
    expect(isolated.drafts[0].source.capture.captureRef).toBe(
      exact.capture.captureRef,
    );
    expect(normalize([exact], []).drafts).toEqual([]);
  });

  it("coexists with agreeing HTML and JSON-LD as equivalent support", () => {
    const json = JSON.stringify({
      "@type": "Product",
      offers: { "@type": "Offer", price: "999", priceCurrency: "INR" },
    });
    const result = normalize([
      source(
        "agreement",
        `<main><p>Price: INR 999.</p></main><script type="application/ld+json">${json}</script>`,
      ),
    ]);
    expect(result.drafts).toHaveLength(2);
    expect(
      new Set(result.drafts.map((draft) => draft.semanticObservationKey)).size,
    ).toBe(1);
    expect(wave2Conflict(result.drafts[0], result.drafts[1])).toBe(false);
    expect(
      result.drafts.map(
        (draft) => draft.boundedNormalizedPayload.observation_source,
      ),
    ).toEqual(["HTML", "JSON_LD"]);
  });

  it("retains conflicting HTML and JSON-LD tuples with no winner", () => {
    const json = JSON.stringify({
      "@type": "Product",
      offers: { "@type": "Offer", price: "1099", priceCurrency: "INR" },
    });
    const result = normalize([
      source(
        "conflict",
        `<main><p>Price: INR 999.</p></main><script type="application/ld+json">${json}</script>`,
      ),
    ]);
    expect(result.drafts).toHaveLength(2);
    expect(
      new Set(result.drafts.map((draft) => draft.semanticObservationKey)).size,
    ).toBe(2);
    expect(wave2Conflict(result.drafts[0], result.drafts[1])).toBe(true);
    expect(
      result.drafts.map(
        (draft) => draft.boundedNormalizedPayload.current_min_amount,
      ),
    ).toEqual([999, 1099]);
  });

  it("does not infer a range from multiple structured sibling offers", () => {
    const json = JSON.stringify({
      "@type": "Product",
      offers: [
        { "@type": "Offer", price: "10", priceCurrency: "USD" },
        { "@type": "Offer", price: "20", priceCurrency: "USD" },
      ],
    });
    expect(
      normalize([
        source(
          "structured-siblings",
          `<script type="application/ld+json">${json}</script>`,
        ),
      ]).drafts,
    ).toEqual([]);
  });
});
