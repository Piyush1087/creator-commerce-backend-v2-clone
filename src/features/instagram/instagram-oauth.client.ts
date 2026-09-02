import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  renderSafeInstagramError,
  safeInstagramErrorMetadata,
} from "./instagram-provider-error";

export type InstagramTokenExchangeResult = {
  accessToken: string;
  expiresInSeconds: number;
  /** Permission names when present on the short-lived token response. */
  permissions: string[];
};

const DEFAULT_INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
] as const;

@Injectable()
export class InstagramOAuthClient {
  private readonly logger = new Logger(InstagramOAuthClient.name);

  buildAuthorizeUrl(redirectUri: string, state: string): string {
    const clientId = process.env.INSTAGRAM_API_ID;
    if (!clientId) {
      throw new BadRequestException(
        "Instagram OAuth is not configured. Set INSTAGRAM_API_ID and INSTAGRAM_APP_SECRET.",
      );
    }

    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.set("enable_fb_login", "1");
    url.searchParams.set("force_authentication", "1");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("state", state);
    url.searchParams.set("scope", DEFAULT_INSTAGRAM_SCOPES.join(","));
    return url.toString();
  }

  async exchangeAuthorizationCode(
    code: string,
    redirectUri: string,
  ): Promise<InstagramTokenExchangeResult> {
    const clientId = process.env.INSTAGRAM_API_ID;
    const clientSecret = process.env.INSTAGRAM_APP_SECRET;
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        "Instagram OAuth is not configured. Set INSTAGRAM_API_ID and INSTAGRAM_APP_SECRET.",
      );
    }

    const shortToken = await this.fetchShortLivedToken(
      code,
      redirectUri,
      clientId,
      clientSecret,
    );
    const longToken = await this.fetchLongLivedToken(
      shortToken.accessToken,
      clientSecret,
    );
    return {
      accessToken: longToken.access_token,
      expiresInSeconds: longToken.expires_in,
      permissions: shortToken.permissions,
    };
  }

  async refreshLongLivedToken(
    accessToken: string,
  ): Promise<{ accessToken: string; expiresInSeconds: number }> {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url);
    if (!res.ok) {
      const metadata = await safeInstagramErrorMetadata(res);
      this.logger.warn(renderSafeInstagramError("refresh_token", metadata));
      throw new InstagramTokenRefreshError(metadata.classification);
    }
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token || !data.expires_in) {
      throw new InstagramTokenRefreshError("UNKNOWN");
    }
    return {
      accessToken: data.access_token,
      expiresInSeconds: data.expires_in,
    };
  }

  private async fetchShortLivedToken(
    code: string,
    redirectUri: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{ accessToken: string; permissions: string[] }> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const res = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const metadata = await safeInstagramErrorMetadata(res);
      this.logger.warn(renderSafeInstagramError("short_token", metadata));
      throw new BadRequestException(
        "Failed to exchange Instagram authorization code.",
      );
    }
    const data = (await res.json()) as {
      access_token?: string;
      permissions?: string | string[];
    };
    if (!data.access_token) {
      throw new BadRequestException(
        "Instagram authorization response missing access token.",
      );
    }
    const permissions = normalizePermissionList(data.permissions);
    return { accessToken: data.access_token, permissions };
  }

  private async fetchLongLivedToken(
    shortLivedToken: string,
    clientSecret: string,
  ): Promise<{ access_token: string; expires_in: number }> {
    const url = new URL("https://graph.instagram.com/access_token");
    url.searchParams.set("grant_type", "ig_exchange_token");
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("access_token", shortLivedToken);

    const res = await fetch(url);
    if (!res.ok) {
      const metadata = await safeInstagramErrorMetadata(res);
      this.logger.warn(renderSafeInstagramError("long_token", metadata));
      throw new BadRequestException(
        "Failed to obtain long-lived Instagram token.",
      );
    }
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token || !data.expires_in) {
      throw new BadRequestException(
        "Instagram long-lived token response incomplete.",
      );
    }
    return { access_token: data.access_token, expires_in: data.expires_in };
  }
}

export class InstagramTokenRefreshError extends Error {
  constructor(
    readonly classification:
      | "TRANSIENT"
      | "AUTHORIZATION_REVALIDATION_REQUIRED"
      | "PERMISSION_LOSS"
      | "PROVIDER_ACCESS_BLOCKED"
      | "CONTENT_OR_METRIC_UNAVAILABLE"
      | "UNKNOWN",
  ) {
    super("Instagram token refresh failed");
  }
}

function normalizePermissionList(raw: string | string[] | undefined): string[] {
  if (!raw) {
    return [];
  }
  const parts = Array.isArray(raw) ? raw : raw.split(",");
  return parts.map((p) => p.trim().toLowerCase()).filter((p) => p.length > 0);
}
