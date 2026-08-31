import { ConflictException } from "@nestjs/common";
import {
  CanonicalOfferingAuthority,
  CanonicalOfferingOrigin,
  OfferingLifecycle,
  OfferingPriceFreshness,
  OfferingPriceMode,
  Prisma,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  asBrandId,
  asCapabilityExecutionRef,
  asCaptureRef,
  asEvidenceRef,
  asResourceRef,
} from "../../data-extraction/evidence/domain/evidence-identities";
import type { DataExtractionEvidenceItemRecord } from "../../data-extraction/evidence/domain/evidence-records";
import {
  CanonicalOfferingPriceReconciliationService,
  type CurrentCanonicalOfferingPrice,
} from "./canonical-offering-price-reconciliation.service";
import {
  CanonicalOfferingStateService,
  ControlledPriceRefreshGuardError,
} from "./canonical-offering-state.service";

const brandProfileId = "brand-price";
const offeringId = "offering-price";
const executionRef = asCapabilityExecutionRef("capability-execution:price");
const now = new Date("2026-08-28T12:00:00.000Z");

function evidence(
  overrides: Readonly<Record<string, unknown>> = {},
  freshness: "CURRENT" | "POSSIBLY_STALE" = "CURRENT",
): DataExtractionEvidenceItemRecord {
  return {
    brandId: asBrandId(brandProfileId),
    evidenceRef: asEvidenceRef(`evidence:${Math.random()}`),
    capabilityId: "owned_website.offering_commercial_evidence",
    normalizationContractVersion: "1.0",
    resourceRef: asResourceRef("resource:price"),
    captureRef: asCaptureRef("capture:price"),
    sourceClass: "OWNED_WEBSITE",
    resourceType: "OWNED_WEB_PAGE",
    pageRole: "OFFERING_DETAIL",
    capturedAt: now.toISOString(),
    freshnessAtEmission: {
      state: freshness,
      basis: "SAME_ACTIVE_RUN",
      evaluatedAt: now.toISOString(),
    },
    representativeness: "OFFERING_SPECIFIC",
    coverageSnapshot: "SINGLE_RESOURCE",
    qualitySnapshot: {
      state: "COMPLETE",
      failureCategories: [],
      detailCodes: [],
    },
    provenance: {
      providerExecutionRefs: [],
      captureRef: asCaptureRef("capture:price"),
      resourceRef: asResourceRef("resource:price"),
    } as never,
    deduplication: { itemFingerprint: "price" } as never,
    boundedNormalizedPayload: {
      subject_scope: "OFFERING_SPECIFIC",
      canonical_offering_ref: offeringId,
      evidence_semantic: "exact_offering_commercial_observation",
      observed_price_mode: "EXACT",
      current_min_amount: 100,
      current_max_amount: 100,
      regular_reference_min_amount: null,
      regular_reference_max_amount: null,
      currency: "usd",
      observed_at: now.toISOString(),
      ...overrides,
    },
    contentHash: "hash",
    relationshipRefs: [],
  } as DataExtractionEvidenceItemRecord;
}

function current(
  overrides: Partial<CurrentCanonicalOfferingPrice> = {},
): CurrentCanonicalOfferingPrice {
  return {
    stateRevision: 3,
    revisionId: "revision-current",
    mode: OfferingPriceMode.EXACT,
    currentMinAmount: new Prisma.Decimal(100),
    currentMaxAmount: new Prisma.Decimal(100),
    regularMinAmount: null,
    regularMaxAmount: null,
    currency: "USD",
    freshness: OfferingPriceFreshness.CURRENT,
    authority: CanonicalOfferingAuthority.APPLICATION_CANONICAL,
    origin: CanonicalOfferingOrigin.CONTROLLED_PRICE_REFRESH,
    ...overrides,
  };
}

describe("CanonicalOfferingPriceReconciliationService", () => {
  let canonical: {
    advancePrice: ReturnType<typeof vi.fn>;
    markPriceStale: ReturnType<typeof vi.fn>;
  };
  let service: CanonicalOfferingPriceReconciliationService;

  beforeEach(() => {
    canonical = {
      advancePrice: vi.fn().mockResolvedValue({ id: "revision-next" }),
      markPriceStale: vi.fn().mockResolvedValue({ id: "revision-stale" }),
    };
    service = new CanonicalOfferingPriceReconciliationService(
      canonical as unknown as CanonicalOfferingStateService,
    );
  });

  const reconcile = (
    evidenceItems: readonly DataExtractionEvidenceItemRecord[],
    currentPrice: CurrentCanonicalOfferingPrice | null = current(),
    extra: Readonly<Record<string, unknown>> = {},
  ) =>
    service.reconcile({
      brandProfileId,
      offeringId,
      offeringLifecycle: OfferingLifecycle.ACTIVE,
      current: currentPrice,
      capabilityExecutionRef: executionRef,
      successfulUsableCapture: true,
      evidence: evidenceItems,
      evaluatedAt: now,
      ...extra,
    });

  it("initializes one exact fresh tuple", async () => {
    expect((await reconcile([evidence()], null)).outcome).toBe("ADVANCE_PRICE");
    expect(canonical.advancePrice).toHaveBeenCalledWith(
      brandProfileId,
      offeringId,
      null,
      expect.objectContaining({ authority: "APPLICATION_CANONICAL" }),
      { controlledRefresh: true },
    );
  });

  it("does not revise an identical current tuple", async () => {
    expect((await reconcile([evidence()])).outcome).toBe("NO_CHANGE");
    expect(canonical.advancePrice).not.toHaveBeenCalled();
  });

  it("advances a changed exact tuple", async () => {
    expect(
      (
        await reconcile([
          evidence({ current_min_amount: 110, current_max_amount: 110 }),
        ])
      ).outcome,
    ).toBe("ADVANCE_PRICE");
  });

  it("coalesces agreeing HTML and JSON-LD observations", async () => {
    expect((await reconcile([evidence(), evidence()])).outcome).toBe(
      "NO_CHANGE",
    );
  });

  it("does not advance conflicting tuples", async () => {
    expect(
      (
        await reconcile([
          evidence(),
          evidence({ current_min_amount: 120, current_max_amount: 120 }),
        ])
      ).outcome,
    ).toBe("CONFLICT_NO_ADVANCE");
  });

  it("rejects ambiguous priced currency", async () => {
    expect((await reconcile([evidence({ currency: null })])).outcome).toBe(
      "INSUFFICIENT_EVIDENCE",
    );
  });

  it("advances sale and regular-reference amounts atomically", async () => {
    const result = await reconcile([
      evidence({
        current_min_amount: 80,
        current_max_amount: 80,
        regular_reference_min_amount: 100,
        regular_reference_max_amount: 100,
      }),
    ]);
    expect(result.outcome).toBe("ADVANCE_PRICE");
    expect(canonical.advancePrice.mock.calls[0][3]).toMatchObject({
      currentMinAmount: new Prisma.Decimal(80),
      regularMinAmount: new Prisma.Decimal(100),
    });
  });

  it("advances when a prior sale reference disappears", async () => {
    const sale = current({
      currentMinAmount: new Prisma.Decimal(80),
      currentMaxAmount: new Prisma.Decimal(80),
      regularMinAmount: new Prisma.Decimal(100),
      regularMaxAmount: new Prisma.Decimal(100),
    });
    expect((await reconcile([evidence()], sale)).outcome).toBe("ADVANCE_PRICE");
  });

  it("reuses existing currency for explicit NPL", async () => {
    const result = await reconcile([
      evidence({
        observed_price_mode: "NOT_PUBLICLY_LISTED",
        current_min_amount: null,
        current_max_amount: null,
        currency: null,
      }),
    ]);
    expect(result.outcome).toBe("ADVANCE_PRICE");
    expect(canonical.advancePrice.mock.calls[0][3].currency).toBe("USD");
  });

  it("does not initialize first NPL without currency", async () => {
    expect(
      (
        await reconcile(
          [
            evidence({
              observed_price_mode: "NOT_PUBLICLY_LISTED",
              current_min_amount: null,
              current_max_amount: null,
              currency: null,
            }),
          ],
          null,
        )
      ).outcome,
    ).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("allows NPL to priced reversal", async () => {
    const npl = current({
      mode: OfferingPriceMode.NOT_PUBLICLY_LISTED,
      currentMinAmount: null,
      currentMaxAmount: null,
    });
    expect((await reconcile([evidence()], npl)).outcome).toBe("ADVANCE_PRICE");
  });

  it("does not advance or stale from stale Evidence", async () => {
    expect((await reconcile([evidence({}, "POSSIBLY_STALE")])).outcome).toBe(
      "INSUFFICIENT_EVIDENCE",
    );
    expect(canonical.markPriceStale).not.toHaveBeenCalled();
  });

  it("marks retained machine value stale after successful disappearance", async () => {
    expect((await reconcile([])).outcome).toBe("MARK_STALE");
    expect(canonical.markPriceStale).toHaveBeenCalledWith(
      brandProfileId,
      offeringId,
      3,
      "STALE",
      now,
      expect.objectContaining({ controlledRefresh: true }),
    );
  });

  it("does not stale after transient acquisition failure", async () => {
    expect(
      (
        await reconcile([], current(), {
          successfulUsableCapture: false,
        })
      ).outcome,
    ).toBe("INSUFFICIENT_EVIDENCE");
    expect(canonical.markPriceStale).not.toHaveBeenCalled();
  });

  it("blocks Brand-confirmed current price", async () => {
    expect(
      (
        await reconcile(
          [evidence({ current_min_amount: 150, current_max_amount: 150 })],
          current({ authority: CanonicalOfferingAuthority.BRAND_CONFIRMED }),
        )
      ).outcome,
    ).toBe("BLOCKED_MANUAL");
  });

  it("fails closed for manual origin with inconsistent authority", async () => {
    expect(
      (
        await reconcile(
          [evidence({ current_min_amount: 150, current_max_amount: 150 })],
          current({ origin: CanonicalOfferingOrigin.BRAND_EDIT }),
        )
      ).outcome,
    ).toBe("BLOCKED_MANUAL");
  });

  it("lets a manual edit during refresh win", async () => {
    canonical.advancePrice.mockRejectedValueOnce(
      new ControlledPriceRefreshGuardError("MANUAL_PRICE_PROTECTED"),
    );
    expect(
      (
        await reconcile([
          evidence({ current_min_amount: 125, current_max_amount: 125 }),
        ])
      ).outcome,
    ).toBe("BLOCKED_MANUAL");
  });

  it("does not advance an Offering paused during refresh", async () => {
    expect(
      (
        await reconcile([evidence()], current(), {
          offeringLifecycle: OfferingLifecycle.PAUSED_INACTIVE,
        })
      ).outcome,
    ).toBe("INACTIVE_NO_ADVANCE");
  });

  it("returns CAS_REJECTED without retry", async () => {
    canonical.advancePrice.mockRejectedValueOnce(new ConflictException("CAS"));
    expect(
      (
        await reconcile([
          evidence({ current_min_amount: 125, current_max_amount: 125 }),
        ])
      ).outcome,
    ).toBe("CAS_REJECTED");
    expect(canonical.advancePrice).toHaveBeenCalledTimes(1);
  });

  it("restores CURRENT for an identical stale or unknown tuple", async () => {
    for (const freshness of [
      OfferingPriceFreshness.STALE,
      OfferingPriceFreshness.UNKNOWN,
    ]) {
      canonical.advancePrice.mockClear();
      expect(
        (await reconcile([evidence()], current({ freshness }))).outcome,
      ).toBe("ADVANCE_PRICE");
      expect(canonical.advancePrice).toHaveBeenCalledTimes(1);
    }
  });
});
