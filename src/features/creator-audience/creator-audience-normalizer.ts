import type {
  InstagramAudienceBreakdown,
  InstagramAudienceInsightsTruth,
  InstagramField,
} from "../instagram/instagram-intelligence-provider.types";
import {
  CREATOR_AUDIENCE_V0_CONTRACT_VERSION,
  CreatorAudienceConsumerSchema,
  finalizeAudienceHighlights,
  type AudienceHighlightCandidate,
  type CreatorAudienceConsumer,
} from "./contracts/creator-audience-v0.contract";

const BREAKDOWNS: readonly InstagramAudienceBreakdown[] = [
  "AGE",
  "GENDER",
  "COUNTRY",
  "CITY",
];

export type CreatorAudienceAcquisition = Readonly<{
  capturedAt: string;
  followerCount: InstagramField<number>;
  results: readonly InstagramAudienceInsightsTruth[];
}>;

export function normalizeCreatorAudience(input: {
  acquisition: CreatorAudienceAcquisition;
  role: "OWNER" | "MANAGER" | "ASSISTANT";
  sourceStatus?: CreatorAudienceConsumer["sourceStatus"];
  now?: Date;
  processingState?: CreatorAudienceConsumer["processingState"];
  currentPreserved?: boolean;
}): CreatorAudienceConsumer {
  const generatedAt = input.acquisition.capturedAt;
  const cohorts = (["FOLLOWERS", "ENGAGED"] as const).map((id) => {
    const population = id === "FOLLOWERS" ? "FOLLOWERS" : "ENGAGED_AUDIENCE";
    const dimensions = BREAKDOWNS.map((breakdown) => {
      const result = input.acquisition.results.find(
        (item) =>
          item.population === population && item.breakdown === breakdown,
      );
      if (!result || result.availability === "UNAVAILABLE") {
        return {
          id: breakdown,
          state: result?.failureClassification
            ? ("PROVIDER_FAILURE" as const)
            : ("UNAVAILABLE" as const),
          denominatorValid: false,
          buckets: [],
          limitations: [
            result?.limitation ??
              (result?.failureClassification
                ? "PROVIDER_FAILURE"
                : "PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED"),
          ],
        };
      }
      const values = result.values
        .filter(
          (row) =>
            row.dimension.trim().length > 0 &&
            Number.isInteger(row.value) &&
            row.value >= 0,
        )
        .sort(
          (left, right) =>
            right.value - left.value ||
            left.dimension.localeCompare(right.dimension),
        );
      const sum = values.reduce((total, row) => total + row.value, 0);
      const denominatorValid =
        typeof result.denominator === "number" &&
        Number.isInteger(result.denominator) &&
        result.denominator > 0 &&
        sum <= result.denominator;
      return {
        id: breakdown,
        state: "AVAILABLE" as const,
        denominatorValid,
        buckets: values.map((row) => ({
          key: row.dimension.normalize("NFKC"),
          count: row.value,
          percentage: denominatorValid
            ? roundShare((row.value / result.denominator!) * 100)
            : null,
        })),
        limitations: [
          ...(result.limitation ? [result.limitation] : []),
          ...(!denominatorValid ? ["NO_VALID_DENOMINATOR"] : []),
        ],
      };
    });
    const usable = dimensions.filter((item) => item.state === "AVAILABLE");
    const size =
      id === "FOLLOWERS"
        ? fieldNumber(input.acquisition.followerCount)
        : commonDenominator(
            input.acquisition.results.filter(
              (item) => item.population === "ENGAGED_AUDIENCE",
            ),
          );
    return {
      id,
      availability:
        usable.length === 0
          ? ("UNAVAILABLE" as const)
          : usable.length === dimensions.length &&
              usable.every((item) => item.limitations.length === 0)
            ? ("AVAILABLE" as const)
            : ("PARTIAL" as const),
      size,
      dimensions,
      limitations: [...new Set(dimensions.flatMap((item) => item.limitations))],
    };
  });
  const usable = cohorts.filter(
    (cohort) => cohort.availability !== "UNAVAILABLE",
  );
  const limitations = [
    ...new Set(cohorts.flatMap((cohort) => cohort.limitations)),
  ];
  const snapshot: CreatorAudienceConsumer = {
    contractVersion: CREATOR_AUDIENCE_V0_CONTRACT_VERSION,
    generatedAt,
    status:
      usable.length === 0
        ? "UNAVAILABLE"
        : usable.length === 2 &&
            cohorts.every((item) => item.availability === "AVAILABLE")
          ? "READY"
          : "PARTIAL",
    context: { role: input.role },
    source: "INSTAGRAM",
    sourceStatus: input.sourceStatus ?? "CONNECTED",
    snapshotBasis: {
      period: "lifetime",
      timeframe: "this_month",
      capturedAt: generatedAt,
    },
    defaultCohort:
      cohorts[0].availability !== "UNAVAILABLE"
        ? "FOLLOWERS"
        : cohorts[1].availability !== "UNAVAILABLE"
          ? "ENGAGED"
          : null,
    highlights: buildHighlights(cohorts),
    cohorts,
    freshness: {
      state:
        (input.now ?? new Date()).getTime() - new Date(generatedAt).getTime() >
        192 * 3_600_000
          ? "STALE"
          : "CURRENT",
      staleAfterHours: 192,
    },
    processingState: input.processingState ?? "IDLE",
    currentPreserved: input.currentPreserved ?? false,
    limitations,
    settingsRecoveryRoute: "/creator/settings/instagram",
  };
  return CreatorAudienceConsumerSchema.parse(snapshot);
}

function buildHighlights(
  cohorts: CreatorAudienceConsumer["cohorts"],
): CreatorAudienceConsumer["highlights"] {
  const candidates: AudienceHighlightCandidate[] = [];
  for (const cohort of cohorts) {
    for (const dimension of cohort.dimensions) {
      const first = dimension.buckets.find(
        (bucket) => bucket.percentage !== null,
      );
      if (!first || first.percentage === null) continue;
      candidates.push({
        id: `${cohort.id.toLowerCase()}-${dimension.id.toLowerCase()}-${slug(first.key)}`,
        text: `${first.key} is the largest ${dimension.id.toLowerCase()} group in ${cohort.id.toLowerCase()}.`,
        evidence: [`${cohort.id}:${dimension.id}:${first.key}`],
        absolutePercentagePointDelta: Math.max(
          0,
          first.percentage -
            (dimension.buckets.find(
              (bucket) => bucket !== first && bucket.percentage !== null,
            )?.percentage ?? 0),
        ),
      });
    }
  }
  const followers = cohorts.find((cohort) => cohort.id === "FOLLOWERS");
  const engaged = cohorts.find((cohort) => cohort.id === "ENGAGED");
  for (const breakdown of BREAKDOWNS) {
    const follower = followers?.dimensions.find(
      (item) => item.id === breakdown,
    );
    const engagement = engaged?.dimensions.find(
      (item) => item.id === breakdown,
    );
    if (!follower?.denominatorValid || !engagement?.denominatorValid) continue;
    for (const bucket of follower.buckets) {
      const other = engagement.buckets.find((item) => item.key === bucket.key);
      if (!other || bucket.percentage === null || other.percentage === null)
        continue;
      const delta = Math.abs(other.percentage - bucket.percentage);
      candidates.push({
        id: `cross-${breakdown.toLowerCase()}-${slug(bucket.key)}`,
        text: `${bucket.key} differs by ${roundShare(delta)} percentage points between followers and engaged audience.`,
        evidence: [
          `FOLLOWERS:${breakdown}:${bucket.key}`,
          `ENGAGED:${breakdown}:${bucket.key}`,
        ],
        absolutePercentagePointDelta: delta,
      });
    }
  }
  return finalizeAudienceHighlights(candidates);
}

function fieldNumber(field: InstagramField<number>): number | null {
  return field.state === "OBSERVED" || field.state === "OBSERVED_ZERO"
    ? field.value
    : null;
}

function commonDenominator(
  results: readonly InstagramAudienceInsightsTruth[],
): number | null {
  const values = results
    .map((result) => result.denominator)
    .filter((value): value is number => typeof value === "number");
  return values.length > 0 && values.every((value) => value === values[0])
    ? values[0]
    : null;
}

function roundShare(value: number): number {
  return Math.round(value * 10) / 10;
}

function slug(value: string): string {
  return (
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 48) || "bucket"
  );
}
