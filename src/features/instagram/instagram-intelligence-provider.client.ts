import { Injectable, Logger } from "@nestjs/common";

import {
  classifyInstagramProviderError,
  renderSafeInstagramError,
  type InstagramProviderErrorClass,
} from "./instagram-provider-error";
import { instagramGraphUrl } from "./instagram-provider.config";
import {
  INSTAGRAM_CAROUSEL_MAX_CHILDREN,
  INSTAGRAM_MEDIA_INSIGHT_METRICS,
  INSTAGRAM_MEDIA_MAX_ITEMS,
  INSTAGRAM_MEDIA_WINDOW_DAYS,
  type InstagramAudienceBreakdown,
  type InstagramAudienceInsightsTruth,
  type InstagramAudiencePopulation,
  type InstagramAudienceTimeframe,
  type InstagramCarouselChildrenTruth,
  type InstagramField,
  type InstagramIntelligenceProviderReadClient,
  type InstagramMediaInsightsTruth,
  type InstagramMediaInsightMetric,
  type InstagramMediaInventoryTruth,
  type InstagramMediaTruth,
  type InstagramProfileTruth,
  type InstagramProviderCredential,
} from "./instagram-intelligence-provider.types";

type ProviderPage<T> = {
  data?: T[];
  paging?: { cursors?: { after?: string }; next?: string };
};

type ProviderFailure = {
  ok: false;
  classification: InstagramProviderErrorClass;
};
type ProviderSuccess<T> = { ok: true; body: T };

@Injectable()
export class InstagramIntelligenceProviderClient implements InstagramIntelligenceProviderReadClient {
  private readonly logger = new Logger(
    InstagramIntelligenceProviderClient.name,
  );

  async readProfile(
    credential: InstagramProviderCredential,
  ): Promise<InstagramProfileTruth> {
    const url = instagramGraphUrl("me");
    url.searchParams.set(
      "fields",
      "id,user_id,username,name,account_type,followers_count,follows_count,media_count",
    );
    const result = await this.request<Record<string, unknown>>(
      "intelligence_profile",
      url,
      credential.accessToken,
    );
    if (!result.ok) {
      return {
        availability: "UNAVAILABLE",
        providerAccountId: credential.providerAccountId,
        appScopedUserId: failure(result.classification),
        username: failure(result.classification),
        name: failure(result.classification),
        accountType: failure(result.classification),
        followersCount: failure(result.classification),
        followsCount: failure(result.classification),
        mediaCount: failure(result.classification),
      };
    }
    const row = result.body;
    const identityComplete =
      Boolean(nonEmptyString(row.id) ?? nonEmptyString(row.user_id)) &&
      Boolean(nonEmptyString(row.username));
    return {
      availability: identityComplete ? "AVAILABLE" : "UNAVAILABLE",
      providerAccountId: credential.providerAccountId,
      appScopedUserId: stringField(row.id),
      username: stringField(row.username),
      name: stringField(row.name),
      accountType: stringField(row.account_type),
      followersCount: numberField(row.followers_count),
      followsCount: numberField(row.follows_count),
      mediaCount: numberField(row.media_count),
    };
  }

  async readMediaInventory(
    credential: InstagramProviderCredential,
    windowEnd: Date,
  ): Promise<InstagramMediaInventoryTruth> {
    if (!Number.isFinite(windowEnd.getTime())) {
      throw new Error("Instagram media window end must be a valid date");
    }
    const windowStart = new Date(
      windowEnd.getTime() - INSTAGRAM_MEDIA_WINDOW_DAYS * 86_400_000,
    );
    const coverage: InstagramMediaInventoryTruth["coverage"] = {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      pagesAttempted: 0,
      pagesCompleted: 0,
      rowsReturned: 0,
      rowsEligible: 0,
      rowsMissingTimestamp: 0,
      duplicatesDiscarded: 0,
      oldestObservedTimestamp: null,
      newestObservedTimestamp: null,
      stopReason: "EXHAUSTED",
    };
    const items: InstagramMediaTruth[] = [];
    const seen = new Set<string>();
    const seenCursors = new Set<string>();
    let after: string | null = null;

    while (true) {
      const url = instagramGraphUrl("me/media");
      url.searchParams.set(
        "fields",
        "id,media_type,media_product_type,permalink,caption,timestamp",
      );
      url.searchParams.set("limit", "100");
      url.searchParams.set(
        "since",
        String(Math.floor(windowStart.getTime() / 1000)),
      );
      url.searchParams.set(
        "until",
        String(Math.floor(windowEnd.getTime() / 1000)),
      );
      if (after) url.searchParams.set("after", after);
      coverage.pagesAttempted += 1;
      const result = await this.request<ProviderPage<Record<string, unknown>>>(
        "intelligence_media",
        url,
        credential.accessToken,
      );
      if (!result.ok) {
        coverage.stopReason = "PROVIDER_FAILURE";
        return {
          availability:
            coverage.pagesCompleted === 0 ? "UNAVAILABLE" : "PARTIAL",
          items,
          coverage,
          failureClassification: result.classification,
        };
      }
      if (!Array.isArray(result.body.data)) {
        coverage.stopReason = "PROVIDER_FAILURE";
        return {
          availability:
            coverage.pagesCompleted === 0 ? "UNAVAILABLE" : "PARTIAL",
          items,
          coverage,
          failureClassification: "UNKNOWN",
        };
      }
      coverage.pagesCompleted += 1;
      coverage.rowsReturned += result.body.data.length;
      let retainedBeyondCap = false;
      for (const row of result.body.data) {
        const id = nonEmptyString(row.id);
        if (!id) continue;
        if (seen.has(id)) {
          coverage.duplicatesDiscarded += 1;
          continue;
        }
        seen.add(id);
        const timestamp = parseTimestamp(row.timestamp);
        if (!timestamp) {
          coverage.rowsMissingTimestamp += 1;
          if (items.length < INSTAGRAM_MEDIA_MAX_ITEMS) {
            items.push(mapMedia(row, id, null));
          } else {
            retainedBeyondCap = true;
          }
        } else if (timestamp >= windowStart && timestamp <= windowEnd) {
          coverage.rowsEligible += 1;
          updateTimestampCoverage(coverage, timestamp.toISOString());
          if (items.length < INSTAGRAM_MEDIA_MAX_ITEMS) {
            items.push(mapMedia(row, id, timestamp.toISOString()));
          } else {
            retainedBeyondCap = true;
          }
        }
      }
      const next = safeNextCursor(result.body.paging, url);
      if (
        next.kind === "invalid" ||
        (next.kind === "cursor" && seenCursors.has(next.value))
      ) {
        coverage.stopReason = "PROVIDER_FAILURE";
        return {
          availability: "PARTIAL",
          items,
          coverage,
          failureClassification: "UNKNOWN",
        };
      }
      if (items.length === INSTAGRAM_MEDIA_MAX_ITEMS) {
        if (retainedBeyondCap || next.kind === "cursor") {
          coverage.stopReason = "CAP_REACHED";
          return { availability: "PARTIAL", items, coverage };
        }
        coverage.stopReason = "EXHAUSTED";
        return { availability: "AVAILABLE", items, coverage };
      }
      if (next.kind === "none") {
        coverage.stopReason =
          coverage.pagesCompleted === 1 && result.body.data.length === 0
            ? "EMPTY_SUCCESS"
            : "EXHAUSTED";
        return { availability: "AVAILABLE", items, coverage };
      }
      seenCursors.add(next.value);
      after = next.value;
    }
  }

  async readMediaInsights(
    credential: InstagramProviderCredential,
    mediaId: string,
    mediaType: string,
  ): Promise<InstagramMediaInsightsTruth> {
    const supported = insightMetricsForFormat(mediaType);
    const metrics = Object.fromEntries(
      INSTAGRAM_MEDIA_INSIGHT_METRICS.map((metric) => [
        metric,
        supported.includes(metric)
          ? ({
              state: "UNAVAILABLE",
              reason: "PROVIDER_DID_NOT_RETURN_METRIC",
            } as const)
          : ({
              state: "UNSUPPORTED",
              reason: "METRIC_FORMAT_PAIR_UNSUPPORTED",
            } as const),
      ]),
    ) as InstagramMediaInsightsTruth["metrics"];
    const metadata = mediaMetricMetadata();
    if (supported.length === 0) {
      return {
        availability: "UNAVAILABLE",
        mediaType,
        metrics,
        ...metadata,
        unavailableReason: "CONTENT_OR_METRIC_UNAVAILABLE",
      };
    }
    const url = instagramGraphUrl(`${encodeURIComponent(mediaId)}/insights`);
    url.searchParams.set("metric", supported.join(","));
    const result = await this.request<ProviderPage<Record<string, unknown>>>(
      "intelligence_media_insights",
      url,
      credential.accessToken,
    );
    if (!result.ok) {
      for (const metric of supported)
        metrics[metric] = failure(result.classification);
      return {
        availability: "UNAVAILABLE",
        mediaType,
        metrics,
        ...metadata,
        unavailableReason:
          result.classification === "CONTENT_OR_METRIC_UNAVAILABLE"
            ? "CONTENT_OR_METRIC_UNAVAILABLE"
            : "PROVIDER_FAILURE",
        failureClassification: result.classification,
      };
    }
    if (!Array.isArray(result.body.data)) {
      return {
        availability: "UNAVAILABLE",
        mediaType,
        metrics,
        ...metadata,
        unavailableReason: "PROVIDER_FAILURE",
        failureClassification: "UNKNOWN",
      };
    }
    if (result.body.data.length === 0) {
      return {
        availability: "UNAVAILABLE",
        mediaType,
        metrics,
        ...metadata,
        unavailableReason: "EMPTY_DATA",
      };
    }
    for (const row of result.body.data) {
      const name = nonEmptyString(row.name);
      if (
        !name ||
        !(INSTAGRAM_MEDIA_INSIGHT_METRICS as readonly string[]).includes(name)
      ) {
        continue;
      }
      const values = Array.isArray(row.values) ? row.values : [];
      const first = isRecord(values[0]) ? values[0].value : undefined;
      metrics[name as keyof typeof metrics] = numberField(first);
    }
    return { availability: "AVAILABLE", mediaType, metrics, ...metadata };
  }

  async readAudienceInsights(
    credential: InstagramProviderCredential,
    population: InstagramAudiencePopulation,
    breakdown: InstagramAudienceBreakdown,
    timeframe: InstagramAudienceTimeframe,
  ): Promise<InstagramAudienceInsightsTruth> {
    const url = instagramGraphUrl(`${credential.providerAccountId}/insights`);
    url.searchParams.set(
      "metric",
      population === "FOLLOWERS"
        ? "follower_demographics"
        : "engaged_audience_demographics",
    );
    url.searchParams.set("period", "lifetime");
    url.searchParams.set("metric_type", "total_value");
    url.searchParams.set("breakdown", breakdown.toLowerCase());
    url.searchParams.set("timeframe", timeframe.toLowerCase());
    const result = await this.request<ProviderPage<Record<string, unknown>>>(
      "intelligence_audience_insights",
      url,
      credential.accessToken,
    );
    if (!result.ok) {
      return {
        availability: "UNAVAILABLE",
        population,
        breakdown,
        timeframe,
        values: [],
        limitation: null,
        failureClassification: result.classification,
      };
    }
    if (!Array.isArray(result.body.data) || result.body.data.length === 0) {
      return {
        availability: "UNAVAILABLE",
        population,
        breakdown,
        timeframe,
        values: [],
        limitation: "PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED",
      };
    }
    const values = extractAudienceValues(result.body.data).slice(0, 45);
    return {
      availability: values.length > 0 ? "AVAILABLE" : "UNAVAILABLE",
      population,
      breakdown,
      timeframe,
      values,
      limitation:
        values.length === 0
          ? "PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED"
          : values.length === 45
            ? "TOP_45_PROVIDER_LIMIT"
            : null,
    };
  }

  async readCarouselChildren(
    credential: InstagramProviderCredential,
    mediaId: string,
  ): Promise<InstagramCarouselChildrenTruth> {
    const children: InstagramCarouselChildrenTruth["children"] = [];
    let after: string | null = null;
    let completed = 0;
    const seenCursors = new Set<string>();
    const seenChildren = new Set<string>();
    while (true) {
      const url = instagramGraphUrl(`${encodeURIComponent(mediaId)}/children`);
      url.searchParams.set("fields", "id,media_type,media_product_type");
      url.searchParams.set("limit", String(INSTAGRAM_CAROUSEL_MAX_CHILDREN));
      if (after) url.searchParams.set("after", after);
      const result = await this.request<ProviderPage<Record<string, unknown>>>(
        "intelligence_carousel_children",
        url,
        credential.accessToken,
      );
      if (!result.ok) {
        return {
          availability: completed === 0 ? "UNAVAILABLE" : "PARTIAL",
          children,
          stopReason: "PROVIDER_FAILURE",
          failureClassification: result.classification,
        };
      }
      if (!Array.isArray(result.body.data)) {
        return {
          availability: completed === 0 ? "UNAVAILABLE" : "PARTIAL",
          children,
          stopReason: "PROVIDER_FAILURE",
          failureClassification: "UNKNOWN",
        };
      }
      completed += 1;
      let retainedBeyondCap = false;
      for (const row of result.body.data) {
        const id = nonEmptyString(row.id);
        if (!id || seenChildren.has(id)) continue;
        seenChildren.add(id);
        if (children.length < INSTAGRAM_CAROUSEL_MAX_CHILDREN) {
          children.push({
            providerMediaId: id,
            ordinal: children.length,
            mediaType: stringField(row.media_type),
            mediaProductType: stringField(row.media_product_type),
          });
        } else {
          retainedBeyondCap = true;
        }
      }
      const next = safeNextCursor(result.body.paging, url);
      if (
        next.kind === "invalid" ||
        (next.kind === "cursor" && seenCursors.has(next.value))
      ) {
        return {
          availability: "PARTIAL",
          children,
          stopReason: "PROVIDER_FAILURE",
          failureClassification: "UNKNOWN",
        };
      }
      if (children.length === INSTAGRAM_CAROUSEL_MAX_CHILDREN) {
        if (retainedBeyondCap || next.kind === "cursor") {
          return {
            availability: "PARTIAL",
            children,
            stopReason: "CAP_REACHED",
          };
        }
        return { availability: "AVAILABLE", children, stopReason: "EXHAUSTED" };
      }
      if (next.kind === "none") {
        return {
          availability: "AVAILABLE",
          children,
          stopReason:
            completed === 1 && result.body.data.length === 0
              ? "EMPTY_SUCCESS"
              : "EXHAUSTED",
        };
      }
      seenCursors.add(next.value);
      after = next.value;
    }
  }

  private async request<T>(
    operation: string,
    url: URL,
    accessToken: string,
  ): Promise<ProviderSuccess<T> | ProviderFailure> {
    url.searchParams.set("access_token", accessToken);
    try {
      const response = await fetch(url);
      const text = await response.text();
      let body: unknown = null;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
      if (!response.ok) {
        const metadata = classifyInstagramProviderError(response.status, body);
        this.logger.warn(renderSafeInstagramError(operation, metadata));
        return { ok: false, classification: metadata.classification };
      }
      if (!isRecord(body)) return { ok: false, classification: "UNKNOWN" };
      return { ok: true, body: body as T };
    } catch {
      this.logger.warn(`instagram.transport_error operation=${operation}`);
      return { ok: false, classification: "TRANSIENT" };
    }
  }
}

function failure<T>(
  classification: InstagramProviderErrorClass,
): InstagramField<T> {
  return { state: "PROVIDER_FAILURE", classification };
}

function stringField(value: unknown): InstagramField<string> {
  if (typeof value !== "string")
    return { state: "UNAVAILABLE", reason: "FIELD_ABSENT" };
  if (value.length === 0) return { state: "EXPLICIT_EMPTY", value: "" };
  return { state: "OBSERVED", value };
}

function numberField(value: unknown): InstagramField<number> {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { state: "UNAVAILABLE", reason: "FIELD_ABSENT_OR_INVALID" };
  }
  return value === 0
    ? { state: "OBSERVED_ZERO", value: 0 }
    : { state: "OBSERVED", value };
}

function mapMedia(
  row: Record<string, unknown>,
  providerMediaId: string,
  timestamp: string | null,
): InstagramMediaTruth {
  return {
    providerMediaId,
    mediaType: stringField(row.media_type),
    mediaProductType: stringField(row.media_product_type),
    permalink: stringField(row.permalink),
    caption:
      typeof row.caption === "undefined"
        ? { state: "EXPLICIT_EMPTY", value: "" }
        : stringField(row.caption),
    timestamp: timestamp
      ? { state: "OBSERVED", value: timestamp }
      : { state: "UNAVAILABLE", reason: "MISSING_OR_INVALID_TIMESTAMP" },
  };
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function safeNextCursor(
  paging: ProviderPage<unknown>["paging"],
  currentUrl: URL,
): { kind: "none" } | { kind: "cursor"; value: string } | { kind: "invalid" } {
  const direct = nonEmptyString(paging?.cursors?.after);
  if (direct) return { kind: "cursor", value: direct };
  const next = nonEmptyString(paging?.next);
  if (!next) return { kind: "none" };
  try {
    const parsed = new URL(next);
    if (
      parsed.protocol !== "https:" ||
      parsed.origin !== currentUrl.origin ||
      parsed.pathname !== currentUrl.pathname
    ) {
      return { kind: "invalid" };
    }
    const cursor = nonEmptyString(parsed.searchParams.get("after"));
    return cursor ? { kind: "cursor", value: cursor } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

function insightMetricsForFormat(
  mediaType: string,
): InstagramMediaInsightMetric[] {
  const normalized = mediaType.toUpperCase();
  if (
    ["IMAGE", "CAROUSEL_ALBUM", "VIDEO", "REEL", "REELS"].includes(normalized)
  ) {
    return [...INSTAGRAM_MEDIA_INSIGHT_METRICS];
  }
  if (normalized === "STORY") {
    return ["reach", "shares", "total_interactions", "views"];
  }
  return [];
}

function mediaMetricMetadata(): Pick<
  InstagramMediaInsightsTruth,
  "units" | "denominators" | "providerObservationTime" | "providerLagLimitHours"
> {
  return {
    units: Object.fromEntries(
      INSTAGRAM_MEDIA_INSIGHT_METRICS.map((metric) => [metric, "COUNT"]),
    ) as InstagramMediaInsightsTruth["units"],
    denominators: Object.fromEntries(
      INSTAGRAM_MEDIA_INSIGHT_METRICS.map((metric) => [
        metric,
        { state: "UNAVAILABLE", reason: "NO_PROVIDER_DENOMINATOR" },
      ]),
    ) as InstagramMediaInsightsTruth["denominators"],
    providerObservationTime: {
      state: "UNAVAILABLE",
      reason: "PROVIDER_DOES_NOT_RETURN_OBSERVATION_TIME",
    },
    providerLagLimitHours: 48,
  };
}

function updateTimestampCoverage(
  coverage: InstagramMediaInventoryTruth["coverage"],
  timestamp: string,
): void {
  if (
    !coverage.oldestObservedTimestamp ||
    timestamp < coverage.oldestObservedTimestamp
  ) {
    coverage.oldestObservedTimestamp = timestamp;
  }
  if (
    !coverage.newestObservedTimestamp ||
    timestamp > coverage.newestObservedTimestamp
  ) {
    coverage.newestObservedTimestamp = timestamp;
  }
}

function extractAudienceValues(rows: Array<Record<string, unknown>>) {
  const values: Array<{ dimension: string; value: number }> = [];
  for (const row of rows) {
    const totalValue = isRecord(row.total_value) ? row.total_value : null;
    const breakdowns =
      totalValue && Array.isArray(totalValue.breakdowns)
        ? totalValue.breakdowns
        : [];
    for (const breakdown of breakdowns) {
      if (!isRecord(breakdown) || !Array.isArray(breakdown.results)) continue;
      for (const result of breakdown.results) {
        if (!isRecord(result) || typeof result.value !== "number") continue;
        const dimensions = Array.isArray(result.dimension_values)
          ? result.dimension_values
          : [];
        const dimension = dimensions
          .filter((item): item is string => typeof item === "string")
          .join("|");
        if (dimension) values.push({ dimension, value: result.value });
      }
    }
  }
  return values;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
