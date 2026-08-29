import { BrandIntegrationScope, BrandIntegrationStatus } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyInstagramProviderError,
  renderSafeInstagramError,
} from "./instagram-provider-error";
import {
  DEFAULT_INSTAGRAM_GRAPH_VERSION,
  instagramGraphUrl,
} from "./instagram-provider.config";
import { resolveInstagramScopesFromPermissions } from "./instagram-scope.util";
import { InstagramOAuthClient } from "./instagram-oauth.client";
import { InstagramGraphClient } from "./instagram-graph.client";

describe("Instagram provider reconciliation primitives", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the centralized v26 default and supports one configuration override", () => {
    expect(DEFAULT_INSTAGRAM_GRAPH_VERSION).toBe("v26.0");
    expect(instagramGraphUrl("me").pathname).toBe("/v26.0/me");
    vi.stubEnv("INSTAGRAM_GRAPH_VERSION", "v27.0");
    expect(instagramGraphUrl("me/permissions").pathname).toBe(
      "/v27.0/me/permissions",
    );
  });

  it("never grants capabilities for absent or unrecognized permission evidence", () => {
    expect(resolveInstagramScopesFromPermissions([])).toEqual({
      scopes: [],
      status: BrandIntegrationStatus.PARTIALLY_CONNECTED,
    });
    expect(resolveInstagramScopesFromPermissions(["something_else"])).toEqual({
      scopes: [],
      status: BrandIntegrationStatus.PARTIALLY_CONNECTED,
    });
  });

  it("requires an explicit granted status from the provider permission surface", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              { permission: "instagram_business_basic" },
              {
                permission: "instagram_business_manage_insights",
                status: "declined",
              },
              {
                permission: "instagram_business_basic",
                status: "granted",
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      new InstagramGraphClient().fetchGrantedPermissions("provider-token"),
    ).resolves.toEqual(["instagram_business_basic"]);
  });

  it("maps only exact core permission names", () => {
    expect(
      resolveInstagramScopesFromPermissions([
        "instagram_business_basic",
        "instagram_business_manage_insights",
      ]),
    ).toEqual({
      scopes: [
        BrandIntegrationScope.BASIC_PROFILE,
        BrandIntegrationScope.ENGAGEMENT_INSIGHTS,
      ],
      status: BrandIntegrationStatus.CONNECTED,
    });
  });

  it("classifies bounded provider failures and renders no raw provider body", () => {
    const metadata = classifyInstagramProviderError(401, {
      error: {
        code: 190,
        error_subcode: 463,
        message: "secret-token and provider payload must not be logged",
      },
    });
    expect(metadata.classification).toBe("AUTHORIZATION_REVALIDATION_REQUIRED");
    const rendered = renderSafeInstagramError("me", metadata);
    expect(rendered).toContain("code=190");
    expect(rendered).not.toContain("secret-token");
    expect(rendered).not.toContain("provider payload");
  });

  it("keeps server errors and rate limits transient", () => {
    expect(classifyInstagramProviderError(503, null).classification).toBe(
      "TRANSIENT",
    );
    expect(classifyInstagramProviderError(429, null).classification).toBe(
      "TRANSIENT",
    );
  });

  it("classifies only the frozen code-25 blocked subcode as provider blocked", () => {
    expect(
      classifyInstagramProviderError(400, {
        error: { code: 25, error_subcode: 2207050 },
      }).classification,
    ).toBe("PROVIDER_ACCESS_BLOCKED");
    expect(
      classifyInstagramProviderError(400, {
        error: { code: 25, error_subcode: 2207051 },
      }).classification,
    ).toBe("UNKNOWN");
  });

  it.each([
    [503, null, "TRANSIENT"],
    [401, { error: { code: 190 } }, "AUTHORIZATION_REVALIDATION_REQUIRED"],
    [403, { error: { code: 10 } }, "PERMISSION_LOSS"],
    [
      400,
      { error: { code: 25, error_subcode: 2207050 } },
      "PROVIDER_ACCESS_BLOCKED",
    ],
    [400, { error: { code: 100 } }, "CONTENT_OR_METRIC_UNAVAILABLE"],
    [418, { error: { code: 999 } }, "UNKNOWN"],
  ] as const)(
    "keeps provider taxonomy member %s/%j distinct as %s",
    (status, body, classification) => {
      expect(classifyInstagramProviderError(status, body).classification).toBe(
        classification,
      );
    },
  );

  it.each([
    [
      "authorization",
      401,
      { error: { code: 190 } },
      "AUTHORIZATION_REVALIDATION_REQUIRED",
    ],
    ["permission", 403, { error: { code: 10 } }, "PERMISSION_LOSS"],
    [
      "provider blocked",
      400,
      { error: { code: 25, error_subcode: 2207050 } },
      "PROVIDER_ACCESS_BLOCKED",
    ],
    ["transient", 503, { error: { code: 2, is_transient: true } }, "TRANSIENT"],
    ["unknown", 418, { error: { code: 999 } }, "UNKNOWN"],
  ] as const)(
    "throws a typed %s media-insight failure instead of returning zero metrics",
    async (_label, status, body, classification) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify(body), { status })),
      );
      await expect(
        new InstagramGraphClient().fetchMediaInsights(
          "media-1",
          "provider-token",
          "IMAGE",
        ),
      ).rejects.toMatchObject({ classification });
    },
  );

  it.each([
    [
      "invalid_metric",
      "The following metric[likes] must be one of reach,saved,shares",
    ],
    [
      "pre_business_conversion",
      "Media posted before the most recent time this account was converted to a business account",
    ],
  ] as const)(
    "returns explicit %s metric unavailability",
    async (unavailableReason, message) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: { code: 100, message } }), {
            status: 400,
          }),
        ),
      );
      await expect(
        new InstagramGraphClient().fetchMediaInsights(
          "media-1",
          "provider-token",
          "IMAGE",
        ),
      ).resolves.toMatchObject({ unavailableReason });
    },
  );

  it("exchanges the authorization code for the authoritative long-lived token", async () => {
    vi.stubEnv("INSTAGRAM_API_ID", "1180027506417007");
    vi.stubEnv("INSTAGRAM_APP_SECRET", "test-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "short-lived",
            permissions: "instagram_business_basic",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "long-lived", expires_in: 5_184_000 }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      new InstagramOAuthClient().exchangeAuthorizationCode(
        "authorization-code",
        "https://app.example.test/callback",
      ),
    ).resolves.toEqual({
      accessToken: "long-lived",
      expiresInSeconds: 5_184_000,
      permissions: ["instagram_business_basic"],
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.instagram.com/oauth/access_token",
    );
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "https://graph.instagram.com/access_token?",
    );
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("/v26.0/");
  });

  it("refreshes through the unversioned provider endpoint and accepts token replacement", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "replacement",
          expires_in: 5_184_000,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      new InstagramOAuthClient().refreshLongLivedToken("current-token"),
    ).resolves.toEqual({
      accessToken: "replacement",
      expiresInSeconds: 5_184_000,
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe(
      "https://graph.instagram.com/refresh_access_token",
    );
    expect(url.searchParams.get("grant_type")).toBe("ig_refresh_token");
    expect(url.searchParams.get("access_token")).toBe("current-token");
  });
});
