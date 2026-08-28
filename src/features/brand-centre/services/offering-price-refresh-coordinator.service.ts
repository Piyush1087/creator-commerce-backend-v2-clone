import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import { asBrandId } from "../../data-extraction/evidence/domain/evidence-identities";
import { DataExtractionPersistenceService } from "../../data-extraction/evidence/persistence/prisma-evidence-repositories";
import { OwnedWebsiteWave1AcquisitionService } from "../../data-extraction/evidence/acquisition/owned-website-wave1-acquisition.service";
import { OwnedWebsiteWave1NormalizationService } from "../../data-extraction/evidence/normalization/owned-website-wave1-normalization.service";
import {
  CanonicalOfferingPriceReconciliationService,
  type CurrentCanonicalOfferingPrice,
} from "./canonical-offering-price-reconciliation.service";
import { CanonicalOfferingStateService } from "./canonical-offering-state.service";
import {
  OfferingPriceRefreshEligibilityService,
  type EligibleOfferingPriceRefresh,
} from "./offering-price-refresh-eligibility.service";
import { OfferingPriceRefreshConfigService } from "./offering-price-refresh-config.service";

export type OfferingPriceRefreshOperationalOutcome =
  | "ADVANCED"
  | "NO_CHANGE"
  | "MARKED_STALE"
  | "BLOCKED_MANUAL"
  | "CONFLICT"
  | "INSUFFICIENT_EVIDENCE"
  | "INACTIVE"
  | "CLAIM_SKIPPED"
  | "ACQUISITION_FAILED"
  | "NORMALIZATION_FAILED"
  | "CAS_REJECTED";

@Injectable()
export class OfferingPriceRefreshCoordinatorService {
  private readonly logger = new Logger(
    OfferingPriceRefreshCoordinatorService.name,
  );

  constructor(
    private readonly config: OfferingPriceRefreshConfigService,
    private readonly eligibility: OfferingPriceRefreshEligibilityService,
    private readonly acquisition: OwnedWebsiteWave1AcquisitionService,
    private readonly normalization: OwnedWebsiteWave1NormalizationService,
    private readonly persistence: DataExtractionPersistenceService,
    private readonly prisma: PrismaService,
    private readonly canonical: CanonicalOfferingStateService,
    private readonly reconciliation: CanonicalOfferingPriceReconciliationService,
  ) {}

  async runBatch(now = new Date()) {
    const config = this.config.read();
    if (!config.enabled) return [];
    const candidates = await this.eligibility.select(
      config.refreshIntervalHours,
      config.batchSize,
      now,
    );
    const results: Array<{
      offeringId: string;
      outcome: OfferingPriceRefreshOperationalOutcome;
    }> = [];
    for (const candidate of candidates) {
      try {
        results.push({
          offeringId: candidate.offeringId,
          outcome: await this.runOne(candidate, now),
        });
      } catch (error) {
        this.log(candidate, "ACQUISITION_FAILED", error);
        results.push({
          offeringId: candidate.offeringId,
          outcome: "ACQUISITION_FAILED",
        });
      }
    }
    return results;
  }

  private async runOne(
    candidate: EligibleOfferingPriceRefresh,
    now: Date,
  ): Promise<OfferingPriceRefreshOperationalOutcome> {
    const brandId = asBrandId(candidate.brandProfileId);
    const requestKey = offeringPriceRefreshRequestKey(
      candidate.brandProfileId,
      candidate.offeringId,
      now,
    );
    let acquired;
    try {
      acquired = await this.acquisition.request({
        brandId,
        capabilityId: "owned_website.offering_commercial_evidence",
        freshnessIntent: "FORCE_RECAPTURE",
        normalizationContractVersion: "1.0",
        requestKey,
        ownedWebsiteRoot: candidate.ownedWebsiteRoot,
        exactOfferingScope: {
          canonicalOfferingRef: candidate.offeringId,
          resourceUrls: [candidate.offeringUrl],
        },
        acquisitionMode: "EXACT_RESOURCES_ONLY",
        executionClaim: "REQUIRE_CREATOR",
      });
    } catch (error) {
      this.log(candidate, "ACQUISITION_FAILED", error);
      return "ACQUISITION_FAILED";
    }
    if (acquired.executionClaim === "EXISTING") {
      this.log(candidate, "CLAIM_SKIPPED");
      return "CLAIM_SKIPPED";
    }
    const captureRefs = acquired.exactOfferingResources?.map(
      (entry) => entry.captureRef,
    );
    if (!captureRefs?.length) {
      this.log(candidate, "ACQUISITION_FAILED");
      return "ACQUISITION_FAILED";
    }

    let normalized;
    try {
      normalized = await this.normalization.normalize({
        brandId,
        capabilityExecutionRef: acquired.capabilityExecutionRef,
        exactOfferingScope: {
          canonicalOfferingRef: candidate.offeringId,
          captureRefs,
        },
      });
    } catch (error) {
      this.log(candidate, "NORMALIZATION_FAILED", error);
      return "NORMALIZATION_FAILED";
    }
    if (normalized.availability === "UNAVAILABLE") {
      this.log(candidate, "ACQUISITION_FAILED");
      return "ACQUISITION_FAILED";
    }

    const repositories = this.persistence.repositories();
    const execution = await repositories.capabilityExecutions.findByRef(
      brandId,
      acquired.capabilityExecutionRef,
    );
    if (!execution) return "NORMALIZATION_FAILED";
    const evidence = (
      await Promise.all(
        execution.evidenceRefs.map((ref) =>
          repositories.evidenceItems.findByRef(brandId, ref),
        ),
      )
    ).filter((item): item is NonNullable<typeof item> => Boolean(item));
    const successfulUsableCapture =
      (await this.prisma.dataExtractionCapture.count({
        where: {
          brandId: candidate.brandProfileId,
          capabilityExecutionRef: acquired.capabilityExecutionRef,
          captureRef: { in: [...captureRefs] },
          status: "COMPLETED",
          acquisitionQuality: { in: ["COMPLETE", "PARTIAL", "DEGRADED"] },
        },
      })) > 0;
    const offering = await this.canonical.read(
      candidate.brandProfileId,
      candidate.offeringId,
    );
    if (!offering) return "INACTIVE";
    const state = offering.priceState;
    const currentRevision = state?.currentRevision;
    const current: CurrentCanonicalOfferingPrice | null =
      state && currentRevision
        ? {
            stateRevision: state.revision,
            revisionId: currentRevision.id,
            mode: currentRevision.mode,
            currentMinAmount: currentRevision.currentMinAmount,
            currentMaxAmount: currentRevision.currentMaxAmount,
            regularMinAmount: currentRevision.regularMinAmount,
            regularMaxAmount: currentRevision.regularMaxAmount,
            currency: currentRevision.currency,
            freshness: currentRevision.freshness,
            authority: currentRevision.authority,
            origin: currentRevision.origin,
          }
        : null;
    const result = await this.reconciliation.reconcile({
      brandProfileId: candidate.brandProfileId,
      offeringId: candidate.offeringId,
      offeringLifecycle: offering.canonicalLifecycle,
      current,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
      successfulUsableCapture,
      evidence,
      evaluatedAt: now,
    });
    const outcome = operationalOutcome(result.outcome);
    this.log(candidate, outcome);
    return outcome;
  }

  private log(
    candidate: EligibleOfferingPriceRefresh,
    outcome: OfferingPriceRefreshOperationalOutcome,
    error?: unknown,
  ) {
    this.logger.log(
      JSON.stringify({
        event: "offering_price_refresh",
        brandProfileId: candidate.brandProfileId,
        offeringId: candidate.offeringId,
        outcome,
        ...(error instanceof Error ? { error: error.message } : {}),
      }),
    );
  }
}

export function offeringPriceRefreshRequestKey(
  brandProfileId: string,
  offeringId: string,
  now: Date,
): string {
  const bucket = now.toISOString().slice(0, 13);
  return [
    "offering-price-refresh:v1",
    "owned_website.offering_commercial_evidence",
    brandProfileId,
    offeringId,
    bucket,
  ].join(":");
}

function operationalOutcome(
  outcome:
    | "NO_CHANGE"
    | "ADVANCE_PRICE"
    | "MARK_STALE"
    | "BLOCKED_MANUAL"
    | "CONFLICT_NO_ADVANCE"
    | "INSUFFICIENT_EVIDENCE"
    | "INACTIVE_NO_ADVANCE"
    | "CAS_REJECTED",
): OfferingPriceRefreshOperationalOutcome {
  return {
    NO_CHANGE: "NO_CHANGE",
    ADVANCE_PRICE: "ADVANCED",
    MARK_STALE: "MARKED_STALE",
    BLOCKED_MANUAL: "BLOCKED_MANUAL",
    CONFLICT_NO_ADVANCE: "CONFLICT",
    INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
    INACTIVE_NO_ADVANCE: "INACTIVE",
    CAS_REJECTED: "CAS_REJECTED",
  }[outcome] as OfferingPriceRefreshOperationalOutcome;
}
