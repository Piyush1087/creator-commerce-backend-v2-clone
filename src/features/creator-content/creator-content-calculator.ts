import type {
  InstagramField,
  InstagramMediaInsightsTruth,
  InstagramMediaTruth,
} from "../instagram/instagram-intelligence-provider.types";
import {
  CREATOR_CONTENT_COMPARISON_PROFILE,
  CREATOR_CONTENT_MAX_POSTS,
  CREATOR_CONTENT_V0_CONTRACT_VERSION,
  CREATOR_CONTENT_WINDOW_DAYS,
  CreatorContentConsumerSchema,
  type CreatorContentConsumer,
  type CreatorContentMedia,
} from "./contracts/creator-content-v0.contract";

export type CreatorContentSemanticObservation = Readonly<{
  providerMediaId: string;
  state: "AVAILABLE" | "PARTIAL" | "UNKNOWN";
  themes: readonly string[];
  captionPatterns: readonly string[];
  creativeStructures: readonly string[];
  visualExecution: readonly string[];
}>;

export type CreatorContentAcquiredMedia = Readonly<{
  media: InstagramMediaTruth;
  insights: InstagramMediaInsightsTruth;
  semantic: CreatorContentSemanticObservation;
  evidenceRef: string;
}>;

function field<T>(value: InstagramField<T>): T | null {
  return value.state === "OBSERVED" ||
    value.state === "OBSERVED_ZERO" ||
    value.state === "EXPLICIT_EMPTY"
    ? (value.value as T)
    : null;
}

function canonical(values: readonly string[], max: number): string[] {
  return [
    ...new Set(
      values
        .map((value) => value.normalize("NFKC").trim().replace(/\s+/gu, " "))
        .filter(Boolean),
    ),
  ]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, max);
}

function mediaType(
  item: InstagramMediaTruth,
): CreatorContentMedia["mediaType"] | null {
  const product = field(item.mediaProductType)?.toUpperCase();
  const type = field(item.mediaType)?.toUpperCase();
  if (product === "REELS" || product === "REEL") return "REEL";
  if (type === "IMAGE" || type === "CAROUSEL_ALBUM" || type === "VIDEO")
    return type;
  return null;
}

export function selectCreatorContentCorpus(
  items: readonly InstagramMediaTruth[],
  windowEnd: Date,
): InstagramMediaTruth[] {
  const start = windowEnd.getTime() - CREATOR_CONTENT_WINDOW_DAYS * 86_400_000;
  return items
    .filter((item) => {
      const timestamp = field(item.timestamp);
      return (
        mediaType(item) !== null &&
        timestamp !== null &&
        new Date(timestamp).getTime() >= start &&
        new Date(timestamp).getTime() <= windowEnd.getTime()
      );
    })
    .sort((a, b) => {
      const delta =
        new Date(field(b.timestamp)!).getTime() -
        new Date(field(a.timestamp)!).getTime();
      return delta || a.providerMediaId.localeCompare(b.providerMediaId);
    })
    .slice(0, CREATOR_CONTENT_MAX_POSTS);
}

function metricValue(
  insights: InstagramMediaInsightsTruth,
  name: keyof InstagramMediaInsightsTruth["metrics"],
): number | null {
  return field(insights.metrics[name]);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function calculateCreatorContent(input: {
  capturedAt: Date;
  windowEnd: Date;
  providerRowsReturned: number;
  rows: readonly CreatorContentAcquiredMedia[];
  role?: "OWNER" | "MANAGER" | "ASSISTANT";
}): CreatorContentConsumer {
  const media = input.rows.map((row): CreatorContentMedia => {
    const reach = metricValue(row.insights, "reach");
    const interactions = metricValue(row.insights, "total_interactions");
    const metrics = {
      INTERACTION_RATE:
        reach !== null && reach > 0 && interactions !== null
          ? interactions / reach
          : null,
      REACH: reach,
      VIEWS: metricValue(row.insights, "views"),
      LIKES: metricValue(row.insights, "likes"),
      COMMENTS: metricValue(row.insights, "comments"),
      SAVES: metricValue(row.insights, "saved"),
      SHARES: metricValue(row.insights, "shares"),
      TOTAL_INTERACTIONS: interactions,
    };
    return {
      providerMediaId: row.media.providerMediaId,
      publishedAt: field(row.media.timestamp)!,
      mediaType: mediaType(row.media)!,
      permalink: safePermalink(field(row.media.permalink)),
      semanticState: row.semantic.state,
      themes: canonical(row.semantic.themes, 8),
      captionPatterns: canonical(row.semantic.captionPatterns, 6),
      creativeStructures: canonical(row.semantic.creativeStructures, 6),
      visualExecution: canonical(row.semantic.visualExecution, 6),
      metrics,
      evidenceRefs: [row.evidenceRef],
    };
  });
  const themes = group(
    media.flatMap((item) => item.themes.map((value) => ({ value, item }))),
  );
  const formats = group(media.map((item) => ({ value: item.mediaType, item })));
  const claims = themes.flatMap((theme) =>
    comparisonClaims(theme.value, media, theme.items),
  );
  const highlights: CreatorContentConsumer["highlights"] = claims
    .slice(0, 2)
    .map((claim) => ({
      id: `performance:${claim.id}`,
      kind: "PERFORMANCE" as const,
      text: `${claim.cohort} posts had ${claim.direction.toLowerCase()} median ${claim.metric.toLowerCase().replace(/_/gu, " ")} than the eligible complement.`,
      confidence: claim.confidence,
      evidenceRefs: claim.evidenceRefs,
    }));
  if (highlights.length < 3 && themes[0] && themes[0].items.length >= 3)
    highlights.push({
      id: `recurrence:${themes[0].value}`,
      kind: "RECURRENCE",
      text: `${themes[0].value} appeared across ${themes[0].items.length} eligible posts.`,
      confidence: themes[0].items.length >= 5 ? "MEDIUM" : "LOW",
      evidenceRefs: themes[0].items.map((item) => item.evidenceRefs[0]).sort(),
    });
  const limitations = [
    ...(media.some((item) => item.semanticState !== "AVAILABLE")
      ? ["SOME_MEDIA_SEMANTICS_PARTIAL_OR_UNKNOWN"]
      : []),
    ...(media.length < 6 ? ["LIMITED_ELIGIBLE_SAMPLE"] : []),
  ];
  const representatives = selectRepresentatives(media, claims);
  return CreatorContentConsumerSchema.parse({
    contractVersion: CREATOR_CONTENT_V0_CONTRACT_VERSION,
    generatedAt: input.capturedAt.toISOString(),
    status:
      media.length === 0
        ? "UNAVAILABLE"
        : limitations.length
          ? "PARTIAL"
          : "READY",
    context: { role: input.role ?? "OWNER" },
    source: "INSTAGRAM",
    sourceStatus: "CONNECTED",
    snapshot: {
      windowDays: 90,
      windowStart: new Date(
        input.windowEnd.getTime() - 90 * 86_400_000,
      ).toISOString(),
      windowEnd: input.windowEnd.toISOString(),
      eligibleCount: media.length,
      providerRowsReturned: input.providerRowsReturned,
      cap: 24,
      coverage:
        media.length === 0
          ? 0
          : media.filter((item) => item.semanticState === "AVAILABLE").length /
            media.length,
      media,
    },
    highlights,
    whatYouCreate: {
      themes: themes.slice(0, 12).map((item) => ({
        value: item.value,
        postCount: item.items.length,
        evidenceRefs: item.items.map((row) => row.evidenceRefs[0]).sort(),
      })),
      formats: formats.map((item) => ({
        value: item.value,
        postCount: item.items.length,
        evidenceRefs: item.items.map((row) => row.evidenceRefs[0]).sort(),
      })),
    },
    performance: {
      comparisonProfile: CREATOR_CONTENT_COMPARISON_PROFILE,
      claims,
    },
    representatives,
    freshness: {
      state: media.length ? "CURRENT" : "UNKNOWN",
      staleAfterHours: 48,
      capturedAt: media.length ? input.capturedAt.toISOString() : null,
    },
    processingState: "IDLE",
    currentPreserved: false,
    limitations,
    settingsRecoveryRoute: "/creator/settings/instagram",
  });
}

function group<T extends string>(
  rows: readonly { value: T; item: CreatorContentMedia }[],
) {
  const map = new Map<T, CreatorContentMedia[]>();
  for (const row of rows)
    map.set(row.value, [...(map.get(row.value) ?? []), row.item]);
  return [...map]
    .map(([value, items]) => ({ value, items }))
    .sort(
      (a, b) =>
        b.items.length - a.items.length || a.value.localeCompare(b.value),
    );
}

function comparisonClaims(
  cohort: string,
  all: readonly CreatorContentMedia[],
  members: readonly CreatorContentMedia[],
): CreatorContentConsumer["performance"]["claims"] {
  const complement = all.filter((item) => !members.includes(item));
  if (members.length < 3 || complement.length < 3) return [];
  const metrics = ["INTERACTION_RATE", "REACH", "VIEWS"] as const;
  return metrics.flatMap((metric) => {
    const left = members
      .map((item) => item.metrics[metric])
      .filter((v): v is number => v !== null);
    const right = complement
      .map((item) => item.metrics[metric])
      .filter((v): v is number => v !== null);
    const leftCoverage = left.length / members.length,
      rightCoverage = right.length / complement.length;
    if (
      left.length < 3 ||
      right.length < 3 ||
      leftCoverage < 0.5 ||
      rightCoverage < 0.5
    )
      return [];
    const a = median(left),
      b = median(right);
    if (b === 0) return [];
    const relative = (a - b) / b;
    const material =
      metric === "INTERACTION_RATE"
        ? Math.abs(a - b) >= 0.005 && Math.abs(relative) >= 0.2
        : Math.abs(relative) >= 0.2;
    if (!material) return [];
    const dates = new Set(members.map((item) => item.publishedAt.slice(0, 10)))
      .size;
    const confidence =
      members.length >= 5 &&
      complement.length >= 5 &&
      leftCoverage >= 0.7 &&
      rightCoverage >= 0.7 &&
      dates >= 2
        ? "MEDIUM"
        : "LOW";
    return [
      {
        id: `${cohort}:${metric}`,
        cohort,
        metric,
        direction: a > b ? ("HIGHER" as const) : ("LOWER" as const),
        cohortMedian: a,
        complementMedian: b,
        absolutePercentagePointDelta:
          metric === "INTERACTION_RATE" ? (a - b) * 100 : null,
        relativeDelta: relative,
        cohortSample: members.length,
        complementSample: complement.length,
        cohortCoverage: leftCoverage,
        complementCoverage: rightCoverage,
        confidence,
        evidenceRefs: [
          ...new Set(
            [...members, ...complement].map((item) => item.evidenceRefs[0]),
          ),
        ].sort(),
      },
    ];
  });
}

function selectRepresentatives(
  media: readonly CreatorContentMedia[],
  claims: CreatorContentConsumer["performance"]["claims"],
) {
  const selected: CreatorContentMedia[] = [];
  for (const claim of claims) {
    const candidates = media
      .filter(
        (item) =>
          item.themes.includes(claim.cohort) &&
          item.metrics[claim.metric] !== null,
      )
      .sort(
        (a, b) =>
          Math.abs(a.metrics[claim.metric]! - claim.cohortMedian) -
            Math.abs(b.metrics[claim.metric]! - claim.cohortMedian) ||
          b.publishedAt.localeCompare(a.publishedAt) ||
          a.providerMediaId.localeCompare(b.providerMediaId),
      );
    if (candidates[0] && !selected.includes(candidates[0]))
      selected.push(candidates[0]);
  }
  for (const item of media.filter((row) => row.semanticState === "AVAILABLE"))
    if (!selected.includes(item) && selected.length < 6) selected.push(item);
  return selected.slice(0, 6).map((item) => ({
    providerMediaId: item.providerMediaId,
    publishedAt: item.publishedAt,
    reason: "Representative of an observed eligible-content pattern.",
    permalink: item.permalink,
    evidenceRefs: item.evidenceRefs,
  }));
}

function safePermalink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "instagram.com" ||
        url.hostname.endsWith(".instagram.com"))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
