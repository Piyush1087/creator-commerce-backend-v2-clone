import { ConflictException, Injectable } from "@nestjs/common";
import {
  CanonicalOfferingAuthority,
  CanonicalOfferingOrigin,
  OfferingLifecycle,
  OfferingPriceFreshness,
  OfferingPriceMode,
  Prisma,
} from "@prisma/client";

import type { DataExtractionEvidenceItemRecord } from "../../data-extraction/evidence/domain/evidence-records";
import type { CapabilityExecutionRef } from "../../data-extraction/evidence/domain/evidence-identities";
import {
  CanonicalOfferingStateService,
  ControlledPriceRefreshGuardError,
  type CanonicalPriceInput,
} from "./canonical-offering-state.service";

export type CanonicalOfferingPriceReconciliationOutcome =
  | "NO_CHANGE"
  | "ADVANCE_PRICE"
  | "MARK_STALE"
  | "BLOCKED_MANUAL"
  | "CONFLICT_NO_ADVANCE"
  | "INSUFFICIENT_EVIDENCE"
  | "INACTIVE_NO_ADVANCE"
  | "CAS_REJECTED";

export interface CurrentCanonicalOfferingPrice {
  readonly stateRevision: number;
  readonly revisionId: string;
  readonly mode: OfferingPriceMode;
  readonly currentMinAmount: Prisma.Decimal | null;
  readonly currentMaxAmount: Prisma.Decimal | null;
  readonly regularMinAmount: Prisma.Decimal | null;
  readonly regularMaxAmount: Prisma.Decimal | null;
  readonly currency: string;
  readonly freshness: OfferingPriceFreshness;
  readonly authority: CanonicalOfferingAuthority;
  readonly origin: CanonicalOfferingOrigin;
}

export interface CanonicalOfferingPriceReconciliationInput {
  readonly brandProfileId: string;
  readonly offeringId: string;
  readonly offeringLifecycle: OfferingLifecycle | null;
  readonly current: CurrentCanonicalOfferingPrice | null;
  readonly capabilityExecutionRef: CapabilityExecutionRef;
  readonly successfulUsableCapture: boolean;
  readonly evidence: readonly DataExtractionEvidenceItemRecord[];
  readonly evaluatedAt: Date;
}

export interface CanonicalOfferingPriceReconciliationResult {
  readonly outcome: CanonicalOfferingPriceReconciliationOutcome;
  readonly revisionId?: string;
}

interface PriceTuple {
  readonly mode: OfferingPriceMode;
  readonly currentMinAmount: Prisma.Decimal | null;
  readonly currentMaxAmount: Prisma.Decimal | null;
  readonly regularMinAmount: Prisma.Decimal | null;
  readonly regularMaxAmount: Prisma.Decimal | null;
  readonly currency: string;
  readonly observedAt: Date;
  readonly evidenceRefs: readonly string[];
}

@Injectable()
export class CanonicalOfferingPriceReconciliationService {
  constructor(
    private readonly canonicalOfferings: CanonicalOfferingStateService,
  ) {}

  async reconcile(
    input: CanonicalOfferingPriceReconciliationInput,
  ): Promise<CanonicalOfferingPriceReconciliationResult> {
    if (input.offeringLifecycle !== OfferingLifecycle.ACTIVE) {
      return { outcome: "INACTIVE_NO_ADVANCE" };
    }
    if (isManualProtected(input.current)) {
      return { outcome: "BLOCKED_MANUAL" };
    }
    if (!input.successfulUsableCapture) {
      return { outcome: "INSUFFICIENT_EVIDENCE" };
    }

    const observations = input.evidence
      .filter((item) => qualifies(item, input.offeringId))
      .map((item) => tupleFromEvidence(item, input.current?.currency))
      .filter((item): item is PriceTuple => item !== null);

    if (
      input.evidence.some((item) => isAmbiguousPriced(item, input.offeringId))
    ) {
      return { outcome: "INSUFFICIENT_EVIDENCE" };
    }
    if (
      input.evidence.some(
        (item) =>
          isFirstCurrencylessNpl(item, input.offeringId) && !input.current,
      )
    ) {
      return { outcome: "INSUFFICIENT_EVIDENCE" };
    }

    if (observations.length === 0) {
      if (input.evidence.length > 0) {
        return { outcome: "INSUFFICIENT_EVIDENCE" };
      }
      if (!input.current) return { outcome: "INSUFFICIENT_EVIDENCE" };
      if (input.current.freshness === OfferingPriceFreshness.STALE) {
        return { outcome: "NO_CHANGE" };
      }
      try {
        const revision = await this.canonicalOfferings.markPriceStale(
          input.brandProfileId,
          input.offeringId,
          input.current.stateRevision,
          OfferingPriceFreshness.STALE,
          input.evaluatedAt,
          {
            controlledRefresh: true,
            sourceRef: input.capabilityExecutionRef,
            provenance: {
              capabilityExecutionRef: input.capabilityExecutionRef,
              transition: "PUBLIC_PRICE_DISAPPEARED_VALUE_RETAINED",
            },
          },
        );
        return { outcome: "MARK_STALE", revisionId: revision.id };
      } catch (error) {
        return this.rejected(error);
      }
    }

    const candidates = coalesceEquivalent(observations);
    if (candidates.length !== 1) {
      return { outcome: "CONFLICT_NO_ADVANCE" };
    }
    const candidate = candidates[0];
    const sameValue = input.current
      ? equalTuple(input.current, candidate)
      : false;
    if (
      sameValue &&
      input.current?.freshness === OfferingPriceFreshness.CURRENT
    ) {
      return { outcome: "NO_CHANGE" };
    }

    const priceInput: CanonicalPriceInput = {
      mode: candidate.mode,
      currentMinAmount: candidate.currentMinAmount,
      currentMaxAmount: candidate.currentMaxAmount,
      regularMinAmount: candidate.regularMinAmount,
      regularMaxAmount: candidate.regularMaxAmount,
      currency: candidate.currency,
      freshness: OfferingPriceFreshness.CURRENT,
      authority: CanonicalOfferingAuthority.APPLICATION_CANONICAL,
      origin: CanonicalOfferingOrigin.CONTROLLED_PRICE_REFRESH,
      sourceClass: "OWNED_WEBSITE_COMMERCIAL_EVIDENCE",
      sourceRef: input.capabilityExecutionRef,
      observedAt: candidate.observedAt,
      freshnessEvaluatedAt: input.evaluatedAt,
      provenance: {
        capabilityExecutionRef: input.capabilityExecutionRef,
        evidenceRefs: candidate.evidenceRefs,
      },
    };
    try {
      const revision = await this.canonicalOfferings.advancePrice(
        input.brandProfileId,
        input.offeringId,
        input.current?.stateRevision ?? null,
        priceInput,
        { controlledRefresh: true },
      );
      return { outcome: "ADVANCE_PRICE", revisionId: revision.id };
    } catch (error) {
      return this.rejected(error);
    }
  }

  private rejected(error: unknown): CanonicalOfferingPriceReconciliationResult {
    if (error instanceof ControlledPriceRefreshGuardError) {
      return {
        outcome:
          error.guardCode === "MANUAL_PRICE_PROTECTED"
            ? "BLOCKED_MANUAL"
            : "INACTIVE_NO_ADVANCE",
      };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return { outcome: "CAS_REJECTED" };
    }
    if (error instanceof ConflictException) return { outcome: "CAS_REJECTED" };
    throw error;
  }
}

function isManualProtected(current: CurrentCanonicalOfferingPrice | null) {
  return Boolean(
    current &&
    (current.authority === CanonicalOfferingAuthority.BRAND_CONFIRMED ||
      current.origin === CanonicalOfferingOrigin.BRAND_EDIT ||
      current.origin === CanonicalOfferingOrigin.BRAND_UPLOAD),
  );
}

function payloadFor(item: DataExtractionEvidenceItemRecord) {
  return item.boundedNormalizedPayload as
    | Readonly<Record<string, unknown>>
    | undefined;
}

function qualifies(
  item: DataExtractionEvidenceItemRecord,
  offeringId: string,
): boolean {
  const payload = payloadFor(item);
  return Boolean(
    item.capabilityId === "owned_website.offering_commercial_evidence" &&
    item.pageRole === "OFFERING_DETAIL" &&
    item.freshnessAtEmission.state === "CURRENT" &&
    payload?.subject_scope === "OFFERING_SPECIFIC" &&
    payload.canonical_offering_ref === offeringId &&
    payload.evidence_semantic === "exact_offering_commercial_observation",
  );
}

function isAmbiguousPriced(
  item: DataExtractionEvidenceItemRecord,
  offeringId: string,
): boolean {
  if (!qualifies(item, offeringId)) return false;
  const payload = payloadFor(item)!;
  return (
    payload.observed_price_mode !== "NOT_PUBLICLY_LISTED" &&
    payload.currency == null
  );
}

function isFirstCurrencylessNpl(
  item: DataExtractionEvidenceItemRecord,
  offeringId: string,
): boolean {
  if (!qualifies(item, offeringId)) return false;
  const payload = payloadFor(item)!;
  return (
    payload.observed_price_mode === "NOT_PUBLICLY_LISTED" &&
    payload.currency == null
  );
}

function decimal(value: unknown): Prisma.Decimal | null {
  return value == null
    ? null
    : new Prisma.Decimal(value as Prisma.Decimal.Value);
}

function tupleFromEvidence(
  item: DataExtractionEvidenceItemRecord,
  existingCurrency?: string,
): PriceTuple | null {
  const payload = payloadFor(item);
  if (!payload) return null;
  const mode = payload.observed_price_mode as OfferingPriceMode;
  const currency =
    typeof payload.currency === "string"
      ? payload.currency.toUpperCase()
      : mode === OfferingPriceMode.NOT_PUBLICLY_LISTED
        ? existingCurrency
        : undefined;
  if (!currency) return null;
  return {
    mode,
    currentMinAmount: decimal(payload.current_min_amount),
    currentMaxAmount: decimal(payload.current_max_amount),
    regularMinAmount: decimal(payload.regular_reference_min_amount),
    regularMaxAmount: decimal(payload.regular_reference_max_amount),
    currency,
    observedAt: new Date(String(payload.observed_at)),
    evidenceRefs: [item.evidenceRef],
  };
}

function decimalKey(value: Prisma.Decimal | null): string | null {
  return value?.toString() ?? null;
}

function tupleKey(tuple: PriceTuple): string {
  return JSON.stringify([
    tuple.mode,
    decimalKey(tuple.currentMinAmount),
    decimalKey(tuple.currentMaxAmount),
    decimalKey(tuple.regularMinAmount),
    decimalKey(tuple.regularMaxAmount),
    tuple.currency.toUpperCase(),
  ]);
}

function coalesceEquivalent(observations: readonly PriceTuple[]): PriceTuple[] {
  const grouped = new Map<string, PriceTuple>();
  for (const observation of observations) {
    const key = tupleKey(observation);
    const prior = grouped.get(key);
    grouped.set(
      key,
      prior
        ? {
            ...prior,
            observedAt:
              observation.observedAt > prior.observedAt
                ? observation.observedAt
                : prior.observedAt,
            evidenceRefs: [...prior.evidenceRefs, ...observation.evidenceRefs],
          }
        : observation,
    );
  }
  return [...grouped.values()];
}

function equalDecimal(
  left: Prisma.Decimal | null,
  right: Prisma.Decimal | null,
) {
  return left === null ? right === null : right !== null && left.equals(right);
}

function equalTuple(
  current: CurrentCanonicalOfferingPrice,
  candidate: PriceTuple,
) {
  return (
    current.mode === candidate.mode &&
    equalDecimal(current.currentMinAmount, candidate.currentMinAmount) &&
    equalDecimal(current.currentMaxAmount, candidate.currentMaxAmount) &&
    equalDecimal(current.regularMinAmount, candidate.regularMinAmount) &&
    equalDecimal(current.regularMaxAmount, candidate.regularMaxAmount) &&
    current.currency.toUpperCase() === candidate.currency.toUpperCase()
  );
}
