import { IndustryVertical } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { BrandStateReadTelemetryService } from "./brand-state-read-telemetry.service";
import { CanonicalBrandStateService } from "./canonical-brand-state.service";
import type {
  BrandStateCandidates,
  CanonicalBrandStateReadRequest,
} from "./brand-state-read.types";

const confirmedGatekeeper = {
  gatekeeper: {
    decision: { outcome: "ADMITTED" },
    confirmation: {
      surface_eligible: true,
      confirmed_industry: IndustryVertical.D2C,
    },
  },
};

function lead(overrides: Record<string, unknown> = {}) {
  return {
    normalizedUrl: "https://example.com/",
    industry: IndustryVertical.D2C,
    subIndustry: "Provisional tools",
    temporaryPayload: confirmedGatekeeper,
    brandIntelligenceScan: null,
    ...overrides,
  };
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    domain: "example.com",
    name: "Canonical Name",
    logoUrl: "https://cdn.example.com/canonical-logo.png",
    industry: IndustryVertical.D2C,
    subIndustry: "Stored provisional tools",
    countryCode: null,
    currencyCode: "USD",
    igHandle: "canonical_brand",
    ytHandle: null,
    tiktokHandle: null,
    ...overrides,
  };
}

function identitySnapshot() {
  const wrapped = <T>(wrappedValue: T) => ({
    value: wrappedValue,
    confidence: 80,
    evidence: [
      {
        page_url: "https://legacy.example.com/",
        page_type: "homepage",
        excerpt: "Legacy evidence",
      },
    ],
    source: "CRAWLER",
    edited: false,
  });
  return {
    scan_id: "86f014f6-4554-48a4-986a-a45342490d4e",
    brand_name: wrapped("Legacy Name"),
    website_url: wrapped("https://legacy.example.com/"),
    country: wrapped("US"),
    reporting_currency: wrapped("USD"),
    brand_logo: wrapped("https://legacy.example.com/logo.png"),
    industry: wrapped(IndustryVertical.HEALTHCARE),
    sub_industry: wrapped("Legacy sub-industry"),
    social_handles: wrapped({
      instagram: "https://instagram.com/legacy_ig",
      tiktok: "https://tiktok.com/@legacy_tt",
      youtube: "https://youtube.com/@legacy_yt",
    }),
    tagline: wrapped(null),
    discovered_root_links: [],
    logo_candidates: [],
  };
}

function harness(
  args: {
    lead?: ReturnType<typeof lead> | null;
    profile?: ReturnType<typeof profile> | null;
  } = {},
) {
  const findLead = vi
    .fn()
    .mockResolvedValue(
      Object.prototype.hasOwnProperty.call(args, "lead") ? args.lead : lead(),
    );
  const findProfile = vi
    .fn()
    .mockResolvedValue(
      Object.prototype.hasOwnProperty.call(args, "profile")
        ? args.profile
        : profile(),
    );
  const record = vi.fn();
  const prisma = {
    discoveryLead: { findUnique: findLead },
    brandProfile: { findUnique: findProfile },
  };
  const service = new CanonicalBrandStateService(
    prisma as unknown as PrismaService,
    { record } as unknown as BrandStateReadTelemetryService,
  );
  const read = (
    lifecycleMode: "PRE_PROFILE" | "POST_PROFILE",
    candidates?: BrandStateCandidates,
  ) =>
    service.readSnapshot({
      leadId: "lead-1",
      lifecycleMode,
      ...(lifecycleMode === "POST_PROFILE"
        ? { brandProfileId: "profile-1" }
        : {}),
      candidates,
      correlationId: "run-1",
    } satisfies CanonicalBrandStateReadRequest);
  return { service, read, prisma, findLead, findProfile, record };
}

describe("CanonicalBrandStateService", () => {
  it("reads PRE_PROFILE website, confirmed Industry, provisional sub-industry, and current candidates", async () => {
    const { read, findProfile } = harness();
    const result = await read("PRE_PROFILE", {
      brandName: "Observed Name",
      brandLogo: "https://example.com/logo.png",
      instagramHandle: "@observed_ig",
      youtubeHandle: "@observed_yt",
      tiktokHandle: "@observed_tt",
    });

    expect(result.website_url).toMatchObject({
      value: "https://example.com/",
      source: "DISCOVERY_LEAD",
      authority: "APPLICATION_CANONICAL",
      fallback_used: false,
    });
    expect(result.brand_name).toMatchObject({
      value: "Observed Name",
      source: "PRE_VERIFICATION_CANDIDATE",
      authority: "OBSERVED",
      fallback_used: true,
    });
    expect(result.brand_logo.value).toBe("https://example.com/logo.png");
    expect(result.industry).toMatchObject({
      value: IndustryVertical.D2C,
      source: "GATEKEEPER_CONFIRMED",
      authority: "GATEKEEPER_CONFIRMED",
    });
    expect(result.sub_industry).toMatchObject({
      value: "Provisional tools",
      authority: "PROVISIONAL",
    });
    expect(result.country.value).toBeNull();
    expect(result.reporting_currency).toMatchObject({
      value: null,
      resolution_status: "UNKNOWN_PROVENANCE",
    });
    expect(findProfile).not.toHaveBeenCalled();
  });

  it("does not present a provisional or legacy classifier as confirmed Industry", async () => {
    const legacy = identitySnapshot();
    const { read } = harness({
      lead: lead({
        industry: IndustryVertical.HEALTHCARE,
        temporaryPayload: { stage1a: legacy },
        brandIntelligenceScan: {
          authoritativeIdentity: legacy,
          stage1aSnapshot: legacy,
        },
      }),
    });
    const result = await read("PRE_PROFILE");
    expect(result.industry).toMatchObject({
      value: null,
      source: "UNKNOWN",
      authority: "UNKNOWN",
    });
  });

  it("uses temporary legacy fallback only where allowed and labels it compatibility-only", async () => {
    const legacy = identitySnapshot();
    const { read, record } = harness({
      lead: lead({
        subIndustry: null,
        temporaryPayload: {
          ...confirmedGatekeeper,
          stage1a: legacy,
        },
        brandIntelligenceScan: {
          authoritativeIdentity: legacy,
          stage1aSnapshot: legacy,
        },
      }),
    });
    const result = await read("PRE_PROFILE");
    for (const semantic of [
      "brand_name",
      "brand_logo",
      "instagram_handle",
      "youtube_handle",
      "tiktok_handle",
    ] as const) {
      expect(result[semantic]).toMatchObject({
        source: "LEGACY_IDENTITY_COMPATIBILITY",
        authority: "UNKNOWN",
        fallback_used: true,
        provenance_status: "LEGACY_MIGRATION_POSSIBLE",
      });
    }
    expect(result.sub_industry.authority).toBe("PROVISIONAL");
    expect(result.website_url.source).toBe("DISCOVERY_LEAD");
    expect(result.industry.source).toBe("GATEKEEPER_CONFIRMED");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        semantic: "youtube_handle",
        legacy_fallback_used: true,
      }),
    );
  });

  it("protects POST_PROFILE website and Settings-edited name from a later Preview scan", async () => {
    const { read, prisma, record } = harness({
      lead: lead({ normalizedUrl: "https://changed.example/" }),
    });
    const result = await read("POST_PROFILE", {
      brandName: "Later Scan Name",
      brandLogo: "https://example.com/later-logo.png",
      confirmedIndustry: IndustryVertical.D2C,
    });

    expect(result.website_url).toMatchObject({
      value: "example.com",
      candidate_value: "https://changed.example/",
      conflict_detected: true,
      fallback_used: false,
    });
    expect(result.brand_name).toMatchObject({
      value: "Canonical Name",
      candidate_value: "Later Scan Name",
      conflict_detected: true,
    });
    expect(result.brand_logo.value).toBe(
      "https://cdn.example.com/canonical-logo.png",
    );
    expect(Object.keys(prisma.discoveryLead)).toEqual(["findUnique"]);
    expect(Object.keys(prisma.brandProfile)).toEqual(["findUnique"]);
    expect(record).toHaveBeenCalledTimes(10);
    expect(JSON.stringify(record.mock.calls)).not.toContain("Canonical Name");
    expect(JSON.stringify(record.mock.calls)).not.toContain("changed.example");
  });

  it("normalizes equal website, name, logo, and handle representations without hiding real mismatches", async () => {
    const { read } = harness();
    const result = await read("POST_PROFILE", {
      brandName: "  canonical   name ",
      brandLogo: "https://cdn.example.com/canonical-logo.png/",
      confirmedIndustry: IndustryVertical.D2C,
      instagramHandle: "https://instagram.com/canonical_brand/",
    });
    expect(result.website_url.conflict_detected).toBe(false);
    expect(result.brand_name.conflict_detected).toBe(false);
    expect(result.brand_logo.conflict_detected).toBe(false);
    expect(result.instagram_handle.conflict_detected).toBe(false);
  });

  it.each([
    {
      label: "candidate logo fallback",
      candidate: "https://example.com/candidate.png",
      expectedValue: "https://example.com/candidate.png",
      expectedSource: "PRE_VERIFICATION_CANDIDATE",
    },
    {
      label: "both logo values absent",
      candidate: null,
      expectedValue: null,
      expectedSource: "UNKNOWN",
    },
  ])("allows $label when canonical logo is null", async (scenario) => {
    const { read } = harness({ profile: profile({ logoUrl: null }) });
    const result = await read("POST_PROFILE", {
      brandLogo: scenario.candidate,
    });
    expect(result.brand_logo.value).toBe(scenario.expectedValue);
    expect(result.brand_logo.source).toBe(scenario.expectedSource);
  });

  it("reports DiscoveryLead/Profile Industry disagreement without reconciliation", async () => {
    const { read } = harness({
      lead: lead({ industry: IndustryVertical.HEALTHCARE }),
      profile: profile({ industry: IndustryVertical.D2C }),
    });
    const result = await read("POST_PROFILE", {
      confirmedIndustry: IndustryVertical.D2C,
    });
    expect(result.industry).toMatchObject({
      value: IndustryVertical.D2C,
      candidate_value: IndustryVertical.HEALTHCARE,
      authority: "GATEKEEPER_CONFIRMED",
      conflict_detected: true,
    });
  });

  it("never elevates stored sub-industry above PROVISIONAL", async () => {
    const { read } = harness();
    const result = await read("POST_PROFILE", {
      provisionalSubIndustry: "Different provisional value",
    });
    expect(result.sub_industry).toMatchObject({
      value: "Stored provisional tools",
      authority: "PROVISIONAL",
      provenance_status: "UNATTRIBUTED_CANONICAL_FIELD",
      conflict_detected: true,
    });
    expect(result.sub_industry.authority).not.toBe("BRAND_CONFIRMED");
  });

  it("returns canonical country or valid null and never infers it from currency, Industry, or domain", async () => {
    const missing = await harness({
      profile: profile({ countryCode: null, currencyCode: "INR" }),
    }).read("POST_PROFILE");
    expect(missing.country).toMatchObject({
      value: null,
      source: "BRAND_PROFILE",
    });

    const mismatch = await harness({
      profile: profile({ countryCode: "US" }),
    }).read("POST_PROFILE", { country: "IN" });
    expect(mismatch.country).toMatchObject({
      value: "US",
      candidate_value: "IN",
      conflict_detected: true,
    });
  });

  it.each(["USD", "INR"])(
    "returns stored %s with UNKNOWN_PROVENANCE rather than claiming policy resolution",
    async (currencyCode) => {
      const { read } = harness({ profile: profile({ currencyCode }) });
      const result = await read("POST_PROFILE");
      expect(result.reporting_currency).toMatchObject({
        value: currencyCode,
        source: "BRAND_PROFILE",
        authority: "UNVERIFIED_PROVENANCE",
        provenance_status: "UNATTRIBUTED_CANONICAL_FIELD",
        resolution_status: "UNKNOWN_PROVENANCE",
      });
      expect(result.reporting_currency.resolution_status).not.toBe("RESOLVED");
      expect(result.country.value).toBeNull();
    },
  );

  it("keeps the canonical Instagram value over equal or mismatching observed handles", async () => {
    const equal = await harness().read("POST_PROFILE", {
      instagramHandle: "@canonical_brand",
    });
    expect(equal.instagram_handle.conflict_detected).toBe(false);

    const mismatch = await harness().read("POST_PROFILE", {
      instagramHandle: "@scraped_brand",
    });
    expect(mismatch.instagram_handle).toMatchObject({
      value: "canonical_brand",
      candidate_value: "@scraped_brand",
      source: "BRAND_PROFILE",
      conflict_detected: true,
    });
  });

  it.each([
    ["youtube_handle", "ytHandle", "@canonical_yt", "@observed_yt"],
    ["tiktok_handle", "tiktokHandle", "@canonical_tt", "@observed_tt"],
  ] as const)(
    "gives %s canonical-field precedence without inventing writer provenance",
    async (semantic, field, canonicalHandle, candidateHandle) => {
      const candidates =
        semantic === "youtube_handle"
          ? { youtubeHandle: candidateHandle }
          : { tiktokHandle: candidateHandle };
      const { read } = harness({
        profile: profile({ [field]: canonicalHandle }),
      });
      const result = await read("POST_PROFILE", candidates);
      expect(result[semantic]).toMatchObject({
        value: canonicalHandle,
        candidate_value: candidateHandle,
        authority: "UNVERIFIED_PROVENANCE",
        provenance_status: "UNATTRIBUTED_CANONICAL_FIELD",
        conflict_detected: true,
      });
    },
  );

  it("rejects POST_PROFILE reads without an explicit profile identity", async () => {
    const { service, findLead } = harness();
    await expect(
      service.readSnapshot({
        leadId: "lead-1",
        lifecycleMode: "POST_PROFILE",
      }),
    ).rejects.toThrow("require brandProfileId");
    expect(findLead).not.toHaveBeenCalled();
  });
});
