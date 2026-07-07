import { BadRequestException, Injectable, Logger } from "@nestjs/common";

export type InstagramTokenExchangeResult = {
  accessToken: string;
  expiresInSeconds: number;
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
    const longToken = await this.fetchLongLivedToken(shortToken, clientSecret);
    return {
      accessToken: longToken.access_token,
      expiresInSeconds: longToken.expires_in,
    };
  }

  private async fetchShortLivedToken(
    code: string,
    redirectUri: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
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
      const errText = await res.text();
      this.logger.warn(
        `Instagram short token failed: ${errText.slice(0, 200)}`,
      );
      throw new BadRequestException(
        "Failed to exchange Instagram authorization code.",
      );
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) {
      throw new BadRequestException(
        "Instagram authorization response missing access token.",
      );
    }
    return data.access_token;
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
      const errText = await res.text();
      this.logger.warn(`Instagram long token failed: ${errText.slice(0, 200)}`);
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
