import type { z } from "zod";
import { CreatorAudienceConsumerSchema } from "../creator-audience/contracts/creator-audience-v0.contract";
import { calculateSnapshotChange } from "../instagram-intelligence/foundations/instagram-c2-foundations";
import {
  AudienceV1ConsumerSchema,
  AUDIENCE_V1_VERSION,
  type AudienceV1Consumer,
  type AudienceV1Manifest,
} from "./creator-audience-v1.contract";

export type AudienceV1Snapshot = {
  objectGenerationId: string;
  value: z.infer<typeof CreatorAudienceConsumerSchema>;
  evidence: AudienceV1Manifest["evidence"];
  breakdowns: Array<{
    cohort: "FOLLOWERS" | "ENGAGED";
    dimension: "AGE" | "GENDER" | "COUNTRY" | "CITY";
    evidenceRef: string;
    denominator: number | null;
    basis: string;
  }>;
  capturedAt: string;
  providerAccountId: string;
  authorizationGeneration: number;
};
export type AudienceV1Content = {
  objectGenerationId: string;
  capturedAt: string;
  facts: Array<{ text: string; evidenceRefs: string[] }>;
  evidence: AudienceV1Manifest["evidence"];
};

/** Source-native arithmetic only. Optional Content is never a synthesized Audience claim. */
export function calculateAudienceV1(input: {
  latest: AudienceV1Snapshot;
  history: Array<AudienceV1Snapshot | null>;
  content: AudienceV1Content | null;
  now: Date;
}): AudienceV1Consumer {
  const { latest } = input;
  const stale =
    input.now.getTime() - Date.parse(latest.capturedAt) >= 192 * 3_600_000;
  const facts: AudienceV1Consumer["overview"]["facts"] = [];
  const profiles: AudienceV1Consumer["profiles"] = [];
  for (const cohort of latest.value.cohorts) {
    if (cohort.availability === "UNAVAILABLE") continue;
    const cohortFacts: typeof facts = [];
    for (const dimension of cohort.dimensions) {
      const support = latest.breakdowns.find(
        (row) => row.cohort === cohort.id && row.dimension === dimension.id,
      );
      if (dimension.state !== "AVAILABLE" || !support) continue;
      const bucket = [...dimension.buckets].sort(
        (a, b) => b.count - a.count || a.key.localeCompare(b.key),
      )[0];
      if (!bucket) continue;
      const fact = {
        cohort: cohort.id,
        dimension: dimension.id,
        bucket: bucket.key,
        count: bucket.count,
        percentage: bucket.percentage,
        evidenceRefs: [support.evidenceRef],
      };
      facts.push(fact);
      cohortFacts.push(fact);
    }
    const denominators = [
      ...new Set(
        latest.breakdowns
          .filter(
            (row) =>
              row.cohort === cohort.id &&
              row.denominator !== null &&
              cohort.dimensions.some(
                (dim) => dim.id === row.dimension && dim.denominatorValid,
              ),
          )
          .map((row) => row.denominator),
      ),
    ];
    profiles.push({
      cohort: cohort.id,
      cohortSize: denominators.length === 1 ? denominators[0] : null,
      facts: cohortFacts,
      coverage: {
        availableDimensions: cohort.dimensions.filter(
          (dim) => dim.state === "AVAILABLE",
        ).length,
        requiredDimensions: 4,
      },
      limitations: [...cohort.limitations],
    });
  }
  const observations: AudienceV1Consumer["change"]["observations"] = [];
  let seriesBreak = false;
  let eligible = false;
  // Keep only the contiguous comparable suffix. A missing middle snapshot is not bridged.
  for (const fact of facts) {
    if (fact.percentage === null) continue;
    const basis = latest.breakdowns.find(
      (row) => row.cohort === fact.cohort && row.dimension === fact.dimension,
    )!;
    const comparable: Array<{
      snapshot: AudienceV1Snapshot;
      percentage: number;
      ref: string;
    }> = [];
    for (const snapshot of [...input.history, latest].reverse()) {
      const support = snapshot?.breakdowns.find(
        (row) => row.cohort === fact.cohort && row.dimension === fact.dimension,
      );
      const dim = snapshot?.value.cohorts
        .find((row) => row.id === fact.cohort)
        ?.dimensions.find(
          (row) =>
            row.id === fact.dimension &&
            row.denominatorValid &&
            row.state === "AVAILABLE",
        );
      const bucket = dim?.buckets.find((row) => row.key === fact.bucket);
      if (
        !snapshot ||
        !support ||
        !bucket ||
        bucket.percentage === null ||
        support.basis !== basis.basis ||
        snapshot.providerAccountId !== latest.providerAccountId ||
        snapshot.authorizationGeneration !== latest.authorizationGeneration
      ) {
        seriesBreak = true;
        break;
      }
      if (
        comparable.some(
          (row) => row.snapshot.capturedAt === snapshot.capturedAt,
        )
      )
        continue;
      comparable.push({
        snapshot,
        percentage: bucket.percentage,
        ref: support.evidenceRef,
      });
    }
    comparable.reverse();
    if (!comparable.length) continue;
    const change = calculateSnapshotChange(
      comparable.map((row) => ({
        observedAt: row.snapshot.capturedAt,
        value: row.percentage,
        providerAccountId: row.snapshot.providerAccountId,
        authorizationGeneration: row.snapshot.authorizationGeneration,
        evidenceRef: row.ref,
      })),
    );
    const first = comparable[0];
    const last = comparable[comparable.length - 1];
    const elapsedDays = Math.floor(
      (Date.parse(last.snapshot.capturedAt) -
        Date.parse(first.snapshot.capturedAt)) /
        86_400_000,
    );
    if (!change.trendInterpretationEligible) continue;
    // Donor eligibility gates are retained; the current contract exposes supported pp change only.
    eligible = true;
    const delta = Math.round((last.percentage - first.percentage) * 10) / 10;
    if (Math.abs(delta) < 5) continue;
    observations.push({
      cohort: fact.cohort,
      dimension: fact.dimension,
      bucket: fact.bucket,
      priorPercentage: first.percentage,
      latestPercentage: last.percentage,
      percentagePointDelta: delta,
      snapshotCount: comparable.length,
      elapsedDays,
      priorCapturedAt: first.snapshot.capturedAt,
      latestCapturedAt: last.snapshot.capturedAt,
      evidenceRefs: comparable.map((row) => row.ref),
    });
  }
  observations.sort(
    (a, b) =>
      Math.abs(b.percentagePointDelta) - Math.abs(a.percentagePointDelta) ||
      a.cohort.localeCompare(b.cohort) ||
      a.dimension.localeCompare(b.dimension) ||
      a.bucket.localeCompare(b.bucket),
  );
  const contentUsable =
    !stale &&
    input.content &&
    input.now.getTime() - Date.parse(input.content.capturedAt) < 48 * 3_600_000;
  return AudienceV1ConsumerSchema.parse({
    ...latest.value,
    contractVersion: AUDIENCE_V1_VERSION,
    freshness: { state: stale ? "STALE" : "CURRENT", staleAfterHours: 192 },
    overview: {
      accountFollowerCount:
        latest.value.cohorts.find((row) => row.id === "FOLLOWERS")?.size ??
        null,
      facts,
    },
    profiles,
    contentContext:
      contentUsable && facts.length
        ? input.content!.facts.slice(0, 2).map((fact, index) => ({
            audienceFact: facts[index % facts.length],
            contentFact: { ...fact, capturedAt: input.content!.capturedAt },
            interpretation: "SEPARATE_SOURCE_FACTS_NOT_AUDIENCE_PREFERENCE",
          }))
        : [],
    change: {
      state: observations.length
        ? "AVAILABLE"
        : eligible
          ? "NO_MATERIAL_CHANGE"
          : seriesBreak
            ? "SERIES_BREAK"
            : "INSUFFICIENT_COMPARABLE_HISTORY",
      observations: observations.slice(0, 3),
    },
  });
}
