import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InstagramProfessionalAccountType } from "@prisma/client";
import { instagramGraphUrl } from "./instagram-provider.config";
import {
  classifyInstagramProviderError,
  renderSafeInstagramError,
  safeInstagramErrorMetadata,
} from "./instagram-provider-error";

export type InstagramMeProfile = {
  userId: string;
  appScopedUserId: string | null;
  username: string;
  name: string | null;
  accountType: InstagramProfessionalAccountType;
  profilePictureUrl: string | null;
  followersCount: number;
  followsCount: number;
  mediaCount: number;
};

@Injectable()
export class InstagramGraphClient {
  private readonly logger = new Logger(InstagramGraphClient.name);

  /**
   * Returns granted Instagram Login permission names (e.g. instagram_business_basic).
   * Failures remain explicit so callers cannot infer permission from missing evidence.
   */
  async fetchGrantedPermissions(accessToken: string): Promise<string[]> {
    const url = instagramGraphUrl("me/permissions");
    url.searchParams.set("access_token", accessToken);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const metadata = await safeInstagramErrorMetadata(res);
        this.logger.warn(renderSafeInstagramError("permissions", metadata));
        throw new InstagramPermissionEvidenceError(metadata.classification);
      }
      const data = (await res.json()) as {
        data?: Array<{ permission?: string; status?: string }>;
      };
      return (data.data ?? [])
        .filter((row) => row.status?.toLowerCase() === "granted")
        .map((row) => (row.permission ?? "").trim().toLowerCase())
        .filter((name) => name.length > 0);
    } catch (err) {
      if (err instanceof InstagramPermissionEvidenceError) throw err;
      this.logger.warn("Instagram /me/permissions transport error");
      throw new InstagramPermissionEvidenceError("UNKNOWN");
    }
  }

  async fetchMe(accessToken: string): Promise<InstagramMeProfile> {
    const url = instagramGraphUrl("me");
    url.searchParams.set(
      "fields",
      "id,username,user_id,name,account_type,profile_picture_url,followers_count,follows_count,media_count",
    );
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url);
    if (!res.ok) {
      const metadata = await safeInstagramErrorMetadata(res);
      this.logger.warn(renderSafeInstagramError("me", metadata));
      throw new InstagramProviderRequestError(
        "Failed to read Instagram profile.",
        metadata.classification,
      );
    }

    const data = (await res.json()) as {
      id?: string;
      user_id?: string;
      username?: string;
      name?: string;
      account_type?: string;
      profile_picture_url?: string;
      followers_count?: number;
      follows_count?: number;
      media_count?: number;
    };

    if (!data.user_id || !data.username) {
      throw new BadRequestException("Instagram profile response incomplete.");
    }

    return {
      userId: data.user_id,
      appScopedUserId: data.id ?? null,
      username: data.username,
      name: data.name ?? null,
      accountType: mapAccountType(data.account_type),
      profilePictureUrl: data.profile_picture_url ?? null,
      followersCount: data.followers_count ?? 0,
      followsCount: data.follows_count ?? 0,
      mediaCount: data.media_count ?? 0,
    };
  }

  async fetchRecentMedia(
    accessToken: string,
    limit = 30,
  ): Promise<
    Array<{
      id: string;
      mediaType: string;
      mediaUrl: string | null;
      thumbnailUrl: string | null;
      caption: string | null;
      timestamp: string;
    }>
  > {
    const url = instagramGraphUrl("me/media");
    url.searchParams.set(
      "fields",
      "id,media_type,media_url,thumbnail_url,caption,timestamp",
    );
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url);
    if (!res.ok) {
      const metadata = await safeInstagramErrorMetadata(res);
      this.logger.warn(renderSafeInstagramError("media", metadata));
      throw new BadRequestException("Failed to read Instagram media.");
    }

    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        media_type?: string;
        media_url?: string;
        thumbnail_url?: string;
        caption?: string;
        timestamp?: string;
      }>;
    };

    return (data.data ?? []).map((row) => ({
      id: row.id,
      mediaType: row.media_type ?? "UNKNOWN",
      mediaUrl: row.media_url ?? null,
      thumbnailUrl: row.thumbnail_url ?? null,
      caption: row.caption ?? null,
      timestamp: row.timestamp ?? new Date().toISOString(),
    }));
  }

  async fetchMediaInsights(
    mediaId: string,
    accessToken: string,
    mediaType: string,
  ): Promise<MediaInsightsResult> {
    const metrics = pickInsightMetrics(mediaType);
    const url = instagramGraphUrl(`${mediaId}/insights`);
    url.searchParams.set("metric", metrics.join(","));
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(errText) as unknown;
      } catch {
        parsed = null;
      }
      const metadata = classifyInstagramProviderError(res.status, parsed);
      if (isPreBusinessConversionInsightError(errText)) {
        return {
          ...ZERO_MEDIA_INSIGHTS,
          unavailableReason: "pre_business_conversion",
        };
      }
      if (isInvalidInsightMetricError(errText)) {
        return {
          ...ZERO_MEDIA_INSIGHTS,
          unavailableReason: "invalid_metric",
        };
      }
      this.logger.warn(renderSafeInstagramError("media_insights", metadata));
      return { ...ZERO_MEDIA_INSIGHTS };
    }

    const data = (await res.json()) as {
      data?: Array<{ name: string; values: Array<{ value: number }> }>;
    };

    const values: Record<string, number> = {};
    for (const row of data.data ?? []) {
      values[row.name] = row.values?.[0]?.value ?? 0;
    }

    return {
      impressions: values.impressions ?? values.reach ?? 0,
      reach: values.reach ?? 0,
      saves: values.saved ?? values.saves ?? 0,
      shares: values.shares ?? 0,
      views: values.views ?? values.plays ?? values.video_views ?? 0,
    };
  }
}

export class InstagramPermissionEvidenceError extends Error {
  constructor(readonly classification: string) {
    super("Instagram permission evidence unavailable");
  }
}

export class InstagramProviderRequestError extends BadRequestException {
  constructor(
    message: string,
    readonly classification: ReturnType<
      typeof classifyInstagramProviderError
    >["classification"],
  ) {
    super(message);
  }
}

function pickInsightMetrics(mediaType: string): string[] {
  const type = mediaType.toUpperCase();
  // Instagram Login API — `plays` is not valid; use `views` for video/reels.
  if (type === "VIDEO" || type === "REEL") {
    return ["reach", "saved", "shares", "views"];
  }
  if (type === "CAROUSEL_ALBUM") {
    return ["reach", "saved", "shares", "likes"];
  }
  return ["reach", "saved", "shares"];
}

export type MediaInsightsResult = {
  impressions: number;
  reach: number;
  saves: number;
  shares: number;
  views: number;
  unavailableReason?: "pre_business_conversion" | "invalid_metric";
};

export const ZERO_MEDIA_INSIGHTS: MediaInsightsResult = {
  impressions: 0,
  reach: 0,
  saves: 0,
  shares: 0,
  views: 0,
};

function isPreBusinessConversionInsightError(errText: string): boolean {
  const lower = errText.toLowerCase();
  return (
    lower.includes("converted to a business account") ||
    lower.includes("posted before the most recent time")
  );
}

function isInvalidInsightMetricError(errText: string): boolean {
  return errText.includes("metric[") && errText.includes("must be one of");
}

function mapAccountType(
  raw: string | undefined,
): InstagramProfessionalAccountType {
  switch ((raw ?? "").toUpperCase()) {
    case "PERSONAL":
      return InstagramProfessionalAccountType.PERSONAL;
    case "BUSINESS":
      return InstagramProfessionalAccountType.BUSINESS;
    case "CREATOR":
    case "MEDIA_CREATOR":
      return InstagramProfessionalAccountType.CREATOR;
    default:
      return InstagramProfessionalAccountType.UNKNOWN;
  }
}
