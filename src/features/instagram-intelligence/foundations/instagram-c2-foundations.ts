import {
  canonicalJson,
  sha256Canonical,
} from "../../brand-intelligence/contracts/bundle/canonical-json";
import { INSTAGRAM_INTELLIGENCE_V1_CONSTANTS } from "../contracts/instagram-intelligence.constants";
import { INSTAGRAM_GRAPH_METRIC_CONTRACT } from "../contracts/instagram-intelligence.registry";
import {
  exactMean,
  exactMedian,
  exactRatio,
  INSTAGRAM_C2_CALCULATION_CONTRACT,
  type ExactRatio,
} from "./instagram-c2-exact-arithmetic";

export const C2_RESULT_CLASSES = [
  "FACTUAL_RESULT",
  "DETERMINISTIC_DERIVED_RESULT",
] as const;
export const C2_METRICS = [
  "reach",
  "views",
  "likes",
  "comments",
  "saved",
  "shares",
  "total_interactions",
] as const;
export type C2Metric = (typeof C2_METRICS)[number];
export type C2MetricField =
  | Readonly<{ state: "OBSERVED"; value: number }>
  | Readonly<{ state: "OBSERVED_ZERO"; value: 0 }>
  | Readonly<{ state: "UNAVAILABLE"; reason?: string }>
  | Readonly<{ state: "UNSUPPORTED"; reason?: string }>
  | Readonly<{ state: "PROVIDER_FAILURE"; classification?: string }>;

export type C2EvidenceInput = Readonly<{
  evidenceRef: string;
  captureRef: string;
  capturedAt: string;
  capabilityId: string;
  providerAccountId?: string;
  authorizationGeneration?: number;
  payload: Readonly<Record<string, unknown>>;
}>;

export type C2InputSnapshot = Readonly<{
  brandId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  sourceClass: "INSTAGRAM_OWNED";
  executionCutoff: string;
  windowStart: string;
  windowEnd: string;
  historicalComparison?: boolean;
  evidence: readonly C2EvidenceInput[];
}>;

export type C2MediaInput = Readonly<{
  evidenceRef: string;
  providerMediaId: string;
  format: string;
  publishedAt?: string;
  captionState?: string;
  visualInspection?: string;
  selected?: boolean;
  metrics: Partial<Record<C2Metric, C2MetricField>>;
}>;

type Aggregate = Readonly<{
  resultClass: "DETERMINISTIC_DERIVED_RESULT";
  metric: C2Metric;
  cohort: string;
  eligibleSampleSize: number;
  supportedSampleSize: number;
  availableSampleSize: number;
  unavailableCount: number;
  unsupportedCount: number;
  providerFailureCount: number;
  observedZeroCount: number;
  coverageNumerator: number;
  coverageDenominator: number;
  coverageRatio: ExactRatio;
  availability: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
  sum: string | null;
  sumLabel: "SUMMED_MEDIA_REACH" | null;
  minimum: string | null;
  maximum: string | null;
  arithmeticMean: ExactRatio | null;
  median: ExactRatio | null;
}>;

export function buildC2InputManifest(snapshot: C2InputSnapshot) {
  assertSnapshot(snapshot);
  const evidence = [...snapshot.evidence]
    .sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef))
    .map((item) => ({
      evidenceRef: item.evidenceRef,
      captureRef: item.captureRef,
      capturedAt: item.capturedAt,
      capabilityId: item.capabilityId,
      providerAccountId: item.providerAccountId ?? snapshot.providerAccountId,
      authorizationGeneration:
        item.authorizationGeneration ?? snapshot.authorizationGeneration,
      payloadHash: sha256Canonical(item.payload),
    }));
  const manifest = {
    contractVersion: INSTAGRAM_C2_CALCULATION_CONTRACT,
    brandId: snapshot.brandId,
    providerAccountId: snapshot.providerAccountId,
    authorizationGeneration: snapshot.authorizationGeneration,
    sourceClass: snapshot.sourceClass,
    executionCutoff: snapshot.executionCutoff,
    windowStart: snapshot.windowStart,
    windowEnd: snapshot.windowEnd,
    historicalComparison: snapshot.historicalComparison === true,
    evidence,
  };
  return { ...manifest, inputHash: sha256Canonical(manifest) };
}

export function calculateC2Foundations(snapshot: C2InputSnapshot) {
  const inputManifest = buildC2InputManifest(snapshot);
  const media = projectMedia(snapshot.evidence).filter((item) => {
    if (!item.publishedAt) return false;
    return (
      item.publishedAt >= snapshot.windowStart &&
      item.publishedAt <= snapshot.windowEnd
    );
  });
  const inventory = inventoryFacts(snapshot.evidence);
  const accountFacts = projectAccountFacts(snapshot.evidence);
  const corpus = calculateCorpus(media, inventory);
  const metricAggregates = calculateMetricAggregates(media);
  const mediaRates = calculateMediaRates(media);
  const audience = calculateAudienceFoundations(snapshot.evidence);
  const audienceComparisons = audience.flatMap((followers) =>
    followers.population === "FOLLOWERS"
      ? audience
          .filter((engaged) => engaged.population === "ENGAGED_AUDIENCE")
          .map((engaged) => compareAudienceDistributions(followers, engaged))
      : [],
  );
  const result = {
    contractVersion: INSTAGRAM_C2_CALCULATION_CONTRACT,
    resultClass: "DETERMINISTIC_DERIVED_RESULT" as const,
    inputManifest,
    accountFacts,
    corpus,
    metricAggregates,
    mediaRates,
    audience,
    audienceComparisons,
    supportEvidenceRefs: [
      ...new Set(snapshot.evidence.map((item) => item.evidenceRef)),
    ].sort(),
  };
  return {
    ...result,
    calculationIdentity: sha256Canonical({
      contractVersion: INSTAGRAM_C2_CALCULATION_CONTRACT,
      inputHash: inputManifest.inputHash,
    }),
    valueHash: sha256Canonical(result),
    canonicalOutput: canonicalJson(result),
  };
}

export function projectAccountFacts(evidence: readonly C2EvidenceInput[]) {
  const selected = [...evidence]
    .filter((item) => item.capabilityId === "instagram.account_profile")
    .sort(
      (a, b) =>
        b.capturedAt.localeCompare(a.capturedAt) ||
        a.evidenceRef.localeCompare(b.evidenceRef),
    )[0];
  return selected
    ? {
        resultClass: "FACTUAL_RESULT" as const,
        evidenceRef: selected.evidenceRef,
        capturedAt: selected.capturedAt,
        facts: selected.payload,
      }
    : {
        resultClass: "FACTUAL_RESULT" as const,
        availability: "UNAVAILABLE" as const,
      };
}

export function calculateCorpus(
  media: readonly C2MediaInput[],
  inventory?: ReturnType<typeof inventoryFacts>,
) {
  const ordered = [...media].sort(
    (a, b) =>
      (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "") ||
      a.providerMediaId.localeCompare(b.providerMediaId),
  );
  const formatCounts = new Map<string, number>();
  const captionCounts = new Map<string, number>();
  const visualCounts = new Map<string, number>();
  for (const item of ordered) {
    formatCounts.set(item.format, (formatCounts.get(item.format) ?? 0) + 1);
    const caption = item.captionState ?? "UNAVAILABLE";
    captionCounts.set(caption, (captionCounts.get(caption) ?? 0) + 1);
    const visual = item.visualInspection ?? "UNAVAILABLE";
    visualCounts.set(visual, (visualCounts.get(visual) ?? 0) + 1);
  }
  const timestamps = ordered.map((item) => Date.parse(item.publishedAt!));
  const intervalSeconds = timestamps
    .slice(1)
    .map((value, index) => Math.trunc((value - timestamps[index]!) / 1_000));
  const total = ordered.length;
  return {
    resultClass: "DETERMINISTIC_DERIVED_RESULT" as const,
    inventoryCount: inventory?.rowsReturned ?? total,
    eligibleMediaCount: total,
    missingTimestampCount: inventory?.rowsMissingTimestamp ?? 0,
    evidencedExcludedCount: Math.max(
      0,
      (inventory?.rowsReturned ?? total) -
        total -
        (inventory?.rowsMissingTimestamp ?? 0),
    ),
    inventoryStopReason: inventory?.stopReason ?? "UNKNOWN",
    inventoryPartial:
      inventory?.stopReason === "CAP_REACHED" ||
      inventory?.stopReason === "PROVIDER_FAILURE",
    postingRatePerDay: exactRatio(total, 30)!,
    postingRatePerSevenDays: exactRatio(total * 7, 30)!,
    distinctPublicationDateCount: new Set(
      ordered.map((item) => item.publishedAt!.slice(0, 10)),
    ).size,
    postingIntervalsSeconds: intervalSeconds,
    postingIntervalMinimumSeconds: intervalSeconds.length
      ? Math.min(...intervalSeconds)
      : null,
    postingIntervalMaximumSeconds: intervalSeconds.length
      ? Math.max(...intervalSeconds)
      : null,
    postingIntervalArithmeticMeanSeconds: exactMean(intervalSeconds),
    postingIntervalMedianSeconds: exactMedian(intervalSeconds),
    formats: [...formatCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([format, count]) => ({
        format,
        eligibleCount: count,
        totalEligibleMediaCount: total,
        formatShare: exactRatio(count, total),
      })),
    selectedVisualCount: ordered.filter((item) => item.selected).length,
    unselectedVisualCount: ordered.filter((item) => !item.selected).length,
    captionAvailabilityCounts: sortedCounts(captionCounts),
    visualInspectionStateCounts: sortedCounts(visualCounts),
  };
}

export function calculateMetricAggregates(
  media: readonly C2MediaInput[],
): readonly Aggregate[] {
  const cohorts = [
    ["ALL_ELIGIBLE", media] as const,
    ...[...new Set(media.map((item) => item.format))]
      .sort()
      .map(
        (format) =>
          [format, media.filter((item) => item.format === format)] as const,
      ),
  ];
  return cohorts.flatMap(([cohort, items]) =>
    C2_METRICS.map((metric) => aggregateMetric(cohort, metric, items)),
  );
}

function aggregateMetric(
  cohort: string,
  metric: C2Metric,
  media: readonly C2MediaInput[],
): Aggregate {
  const fields = media.map((item) =>
    metricSupported(item.format, metric)
      ? (item.metrics[metric] ?? { state: "UNAVAILABLE" as const })
      : { state: "UNSUPPORTED" as const },
  );
  const values = fields.flatMap((field) =>
    field.state === "OBSERVED" || field.state === "OBSERVED_ZERO"
      ? [field.value]
      : [],
  );
  const unsupportedCount = fields.filter(
    (field) => field.state === "UNSUPPORTED",
  ).length;
  const providerFailureCount = fields.filter(
    (field) => field.state === "PROVIDER_FAILURE",
  ).length;
  const unavailableCount = fields.filter(
    (field) => field.state === "UNAVAILABLE",
  ).length;
  const supportedSampleSize = fields.length - unsupportedCount;
  const availableSampleSize = values.length;
  return {
    resultClass: "DETERMINISTIC_DERIVED_RESULT",
    metric,
    cohort,
    eligibleSampleSize: media.length,
    supportedSampleSize,
    availableSampleSize,
    unavailableCount,
    unsupportedCount,
    providerFailureCount,
    observedZeroCount: fields.filter((field) => field.state === "OBSERVED_ZERO")
      .length,
    coverageNumerator: availableSampleSize,
    coverageDenominator: media.length,
    coverageRatio:
      exactRatio(availableSampleSize, media.length) ?? exactRatio(0, 1)!,
    availability:
      availableSampleSize === 0
        ? "UNAVAILABLE"
        : availableSampleSize === media.length
          ? "AVAILABLE"
          : "PARTIAL",
    sum: values.length
      ? values.reduce((sum, value) => sum + BigInt(value), 0n).toString()
      : null,
    sumLabel: metric === "reach" && values.length ? "SUMMED_MEDIA_REACH" : null,
    minimum: values.length ? Math.min(...values).toString() : null,
    maximum: values.length ? Math.max(...values).toString() : null,
    arithmeticMean: exactMean(values),
    median: exactMedian(values),
  };
}

const RATE_NUMERATORS = [
  "total_interactions",
  "likes",
  "comments",
  "saved",
  "shares",
] as const;
export function calculateMediaRates(media: readonly C2MediaInput[]) {
  return [...media]
    .sort((a, b) => a.providerMediaId.localeCompare(b.providerMediaId))
    .flatMap((item) =>
      RATE_NUMERATORS.map((metric) => {
        const numerator = item.metrics[metric];
        const denominator = item.metrics.reach;
        const reason = rateReason(numerator, denominator);
        const available = reason === "AVAILABLE";
        return {
          resultClass: "DETERMINISTIC_DERIVED_RESULT" as const,
          providerMediaId: item.providerMediaId,
          format: item.format,
          numeratorMetric: metric,
          numeratorValue: observedValue(numerator),
          denominatorMetric: "reach" as const,
          denominatorValue: observedValue(denominator),
          ratio: available
            ? exactRatio(observedValue(numerator)!, observedValue(denominator)!)
            : null,
          calculationContractVersion: INSTAGRAM_C2_CALCULATION_CONTRACT,
          availability: available
            ? ("AVAILABLE" as const)
            : ("UNAVAILABLE" as const),
          reason,
          supportingEvidenceRefs: [item.evidenceRef],
        };
      }),
    );
}

function rateReason(
  numerator: C2MetricField | undefined,
  denominator: C2MetricField | undefined,
) {
  if (denominator?.state === "UNSUPPORTED") return "DENOMINATOR_UNSUPPORTED";
  if (
    !denominator ||
    denominator.state === "UNAVAILABLE" ||
    denominator.state === "PROVIDER_FAILURE"
  )
    return "DENOMINATOR_UNAVAILABLE";
  if (denominator.value === 0) return "DENOMINATOR_ZERO";
  if (
    !numerator ||
    numerator.state === "UNAVAILABLE" ||
    numerator.state === "PROVIDER_FAILURE"
  )
    return "NUMERATOR_UNAVAILABLE";
  if (numerator.state === "UNSUPPORTED") return "NUMERATOR_UNSUPPORTED";
  return "AVAILABLE";
}

export function calculateAudienceFoundations(
  evidence: readonly C2EvidenceInput[],
) {
  return evidence
    .filter(
      (item) =>
        item.capabilityId === "instagram.audience_followers" ||
        item.capabilityId === "instagram.audience_engaged",
    )
    .sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef))
    .map((item) => {
      const payload = item.payload;
      const values = Array.isArray(payload.values) ? payload.values : [];
      const buckets = values
        .flatMap((entry) => {
          const row = asRecord(entry);
          return typeof row.dimension === "string" &&
            Number.isSafeInteger(row.value)
            ? [{ dimension: row.dimension, value: row.value as number }]
            : [];
        })
        .sort((a, b) => a.dimension.localeCompare(b.dimension));
      const explicitTotal = Number.isSafeInteger(payload.distributionTotal)
        ? (payload.distributionTotal as number)
        : null;
      const exhaustive =
        payload.partitionComplete === true && payload.limitation === null;
      const denominator =
        explicitTotal ??
        (exhaustive ? buckets.reduce((sum, row) => sum + row.value, 0) : null);
      return {
        resultClass: "FACTUAL_RESULT" as const,
        population:
          item.capabilityId === "instagram.audience_followers"
            ? "FOLLOWERS"
            : "ENGAGED_AUDIENCE",
        breakdown: payload.breakdown ?? null,
        timeframe: payload.timeframe ?? null,
        providerUnit: payload.unit ?? "COUNT",
        limitation: payload.limitation ?? null,
        evidenceRef: item.evidenceRef,
        denominatorValid: denominator !== null && denominator > 0,
        denominator,
        buckets: buckets.map((bucket) => ({
          ...bucket,
          share:
            denominator && denominator > 0
              ? exactRatio(bucket.value, denominator)
              : null,
        })),
      };
    });
}

export function compareAudienceDistributions(
  followers: ReturnType<typeof calculateAudienceFoundations>[number],
  engaged: ReturnType<typeof calculateAudienceFoundations>[number],
) {
  if (
    !followers.denominatorValid ||
    !engaged.denominatorValid ||
    followers.breakdown !== engaged.breakdown ||
    followers.timeframe !== engaged.timeframe ||
    followers.providerUnit !== engaged.providerUnit
  ) {
    return {
      availability: "INCONCLUSIVE" as const,
      reason: "INCOMPATIBLE_AUDIENCE_BASIS",
    };
  }
  const engagedByBucket = new Map(
    engaged.buckets.map((item) => [item.dimension, item]),
  );
  return {
    availability: "AVAILABLE" as const,
    buckets: followers.buckets.flatMap((follower) => {
      const other = engagedByBucket.get(follower.dimension);
      if (!other?.share || !follower.share) return [];
      const followerScaled = BigInt(follower.share.decimal.replace(".", ""));
      const engagedScaled = BigInt(other.share.decimal.replace(".", ""));
      const delta = exactRatio(engagedScaled - followerScaled, 10_000n)!;
      const absolute = delta.decimal.startsWith("-")
        ? delta.decimal.slice(1)
        : delta.decimal;
      return [
        {
          dimension: follower.dimension,
          followerValue: follower.value,
          followerShare: follower.share,
          engagedValue: other.value,
          engagedShare: other.share,
          percentagePointDelta: delta,
          absolutePercentagePointDelta: absolute,
          atLeastFivePoints:
            Number(absolute) >=
            INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.notableAudienceDifferencePercentagePoints,
          atLeastTenPoints:
            Number(absolute) >=
            INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.materialAudienceDifferencePercentagePoints,
        },
      ];
    }),
  };
}

export function calculateSnapshotChange(
  snapshots: readonly Readonly<{
    observedAt: string;
    value: number;
    providerAccountId: string;
    authorizationGeneration: number;
    evidenceRef: string;
  }>[],
) {
  if (snapshots.length === 0)
    return {
      state: "UNAVAILABLE" as const,
      validSnapshotCount: 0,
      trendInterpretationEligible: false,
    };
  const accounts = new Set(snapshots.map((item) => item.providerAccountId));
  if (accounts.size !== 1)
    return {
      state: "UNAVAILABLE" as const,
      reason: "PROVIDER_ACCOUNT_MISMATCH",
      validSnapshotCount: 0,
      trendInterpretationEligible: false,
    };
  const ordered = [...snapshots].sort(
    (a, b) =>
      a.observedAt.localeCompare(b.observedAt) ||
      a.evidenceRef.localeCompare(b.evidenceRef),
  );
  const earliest = ordered[0]!;
  const latest = ordered.at(-1)!;
  const elapsedDays = Math.trunc(
    (Date.parse(latest.observedAt) - Date.parse(earliest.observedAt)) /
      86_400_000,
  );
  const prior = ordered.length >= 2 ? ordered.at(-2)! : null;
  return {
    state:
      ordered.length === 1
        ? ("CURRENT_STATE_ONLY" as const)
        : ("FACTUAL_CHANGE_ELIGIBLE" as const),
    validSnapshotCount: ordered.length,
    earliestObservedAt: earliest.observedAt,
    latestObservedAt: latest.observedAt,
    elapsedDays,
    latestValue: latest.value,
    priorComparableValue: prior?.value ?? null,
    absoluteDelta: prior ? latest.value - prior.value : null,
    percentageChange:
      prior && prior.value !== 0
        ? exactRatio((latest.value - prior.value) * 100, prior.value)
        : null,
    trendInterpretationEligible:
      ordered.length >=
        INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.trendMinimumSnapshots &&
      elapsedDays >=
        INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.trendMinimumElapsedDays,
    authorizationGenerationLineage: [
      ...new Set(ordered.map((item) => item.authorizationGeneration)),
    ].sort((a, b) => a - b),
    supportingEvidenceRefs: ordered.map((item) => item.evidenceRef),
  };
}

function projectMedia(evidence: readonly C2EvidenceInput[]): C2MediaInput[] {
  const byMedia = new Map<string, C2MediaInput>();
  for (const item of [...evidence].sort(
    (a, b) =>
      a.capturedAt.localeCompare(b.capturedAt) ||
      a.evidenceRef.localeCompare(b.evidenceRef),
  )) {
    if (item.capabilityId !== "instagram.media_inventory") continue;
    const payload = item.payload;
    if (typeof payload.providerMediaId !== "string") continue;
    const timestamp = asField(payload.publishedTimestamp);
    const mediaType = asField(payload.mediaType);
    const caption = asField(payload.caption);
    const metrics = asRecord(payload.metrics) as Partial<
      Record<C2Metric, C2MetricField>
    >;
    byMedia.set(payload.providerMediaId, {
      evidenceRef: item.evidenceRef,
      providerMediaId: payload.providerMediaId,
      format: normalizeFormat(
        typeof mediaType.value === "string" ? mediaType.value : "UNKNOWN",
      ),
      ...(typeof timestamp.value === "string"
        ? { publishedAt: timestamp.value }
        : {}),
      captionState:
        typeof caption.state === "string" ? caption.state : "UNAVAILABLE",
      visualInspection:
        typeof payload.visualInspection === "string"
          ? payload.visualInspection
          : "UNAVAILABLE",
      selected:
        asRecord(payload.selection).selectionRank !== null &&
        asRecord(payload.selection).selectionRank !== undefined,
      metrics,
    });
  }
  return [...byMedia.values()];
}

function inventoryFacts(evidence: readonly C2EvidenceInput[]) {
  const candidates = evidence.filter(
    (item) =>
      item.capabilityId === "instagram.media_inventory" &&
      asRecord(item.payload.coverage).rowsReturned !== undefined &&
      typeof item.payload.providerMediaId !== "string",
  );
  const selected = [...candidates].sort(
    (a, b) =>
      b.capturedAt.localeCompare(a.capturedAt) ||
      a.evidenceRef.localeCompare(b.evidenceRef),
  )[0];
  const coverage = asRecord(selected?.payload.coverage);
  return {
    rowsReturned: safeInt(coverage.rowsReturned),
    rowsMissingTimestamp: safeInt(coverage.rowsMissingTimestamp),
    stopReason:
      typeof coverage.stopReason === "string" ? coverage.stopReason : "UNKNOWN",
  };
}

function assertSnapshot(snapshot: C2InputSnapshot) {
  if (
    !snapshot.brandId ||
    !snapshot.providerAccountId ||
    snapshot.sourceClass !== "INSTAGRAM_OWNED" ||
    !Number.isSafeInteger(snapshot.authorizationGeneration)
  )
    throw new Error("C2_SOURCE_SCOPE_MISMATCH");
  const cutoff = Date.parse(snapshot.executionCutoff);
  if (
    !Number.isFinite(cutoff) ||
    snapshot.evidence.some(
      (item) =>
        Date.parse(item.capturedAt) > cutoff ||
        (item.providerAccountId !== undefined &&
          item.providerAccountId !== snapshot.providerAccountId) ||
        (!snapshot.historicalComparison &&
          item.authorizationGeneration !== undefined &&
          item.authorizationGeneration !== snapshot.authorizationGeneration),
    )
  )
    throw new Error("C2_EXECUTION_CUTOFF_VIOLATION");
}

function observedValue(field: C2MetricField | undefined): number | null {
  return field?.state === "OBSERVED" || field?.state === "OBSERVED_ZERO"
    ? field.value
    : null;
}
function normalizeFormat(value: string) {
  return value.toUpperCase() === "REELS" ? "REEL" : value.toUpperCase();
}
function metricSupported(format: string, metric: C2Metric) {
  const supported =
    INSTAGRAM_GRAPH_METRIC_CONTRACT.media[
      normalizeFormat(
        format,
      ) as keyof typeof INSTAGRAM_GRAPH_METRIC_CONTRACT.media
    ];
  return Boolean(
    (supported as readonly string[] | undefined)?.includes(metric),
  );
}
function safeInt(value: unknown) {
  return Number.isSafeInteger(value) ? (value as number) : 0;
}
function sortedCounts(values: Map<string, number>) {
  return [...values.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([state, count]) => ({ state, count }));
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function asField(value: unknown): Record<string, unknown> {
  return asRecord(value);
}
