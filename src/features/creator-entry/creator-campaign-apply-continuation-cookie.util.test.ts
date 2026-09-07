import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearCreatorCampaignApplyContinuationCookie,
  CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME,
  CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
  readCreatorCampaignApplyContinuationCookie,
  setCreatorCampaignApplyContinuationCookie,
  shortenCreatorCampaignApplyContinuationCookie,
} from "./creator-campaign-apply-continuation-cookie.util";
import {
  CREATOR_CAMPAIGN_CONTINUATION_IDEMPOTENCY_GRACE_MS,
  CREATOR_CAMPAIGN_CONTINUATION_TTL_MS,
} from "./creator-campaign-apply-continuation.service";

const originalStage = process.env.STAGE;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.STAGE = originalStage;
  process.env.NODE_ENV = originalNodeEnv;
});

const responseDouble = () =>
  ({ cookie: vi.fn(), clearCookie: vi.fn() }) as unknown as Response;

describe("Creator Campaign continuation cookie transport", () => {
  it("reads only the host cookie and tolerates malformed encoding", () => {
    const token = "A".repeat(43);
    expect(
      readCreatorCampaignApplyContinuationCookie({
        headers: {
          cookie: `unrelated=value; ${CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME}=${token}`,
        },
      } as Request),
    ).toBe(token);
    expect(
      readCreatorCampaignApplyContinuationCookie({
        headers: {
          cookie: `${CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME}=%broken`,
        },
      } as Request),
    ).toBe("%broken");
  });

  it("sets HttpOnly host-only Lax transport with bounded remaining TTL", () => {
    process.env.STAGE = "local";
    process.env.NODE_ENV = "development";
    const response = responseDouble();
    const token = "B".repeat(43);
    const now = new Date("2026-09-01T00:00:00.000Z");
    setCreatorCampaignApplyContinuationCookie(
      response,
      token,
      new Date(now.getTime() + 48 * 60 * 60 * 1000),
      now,
    );
    expect(response.cookie).toHaveBeenCalledWith(
      CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME,
      token,
      {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
        maxAge: CREATOR_CAMPAIGN_CONTINUATION_TTL_MS,
      },
    );
    expect(response.cookie).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ domain: expect.anything() }),
    );
  });

  it("uses Secure outside local/test and shortens consumed transport to ten minutes", () => {
    process.env.STAGE = "production";
    process.env.NODE_ENV = "production";
    const response = responseDouble();
    const now = new Date("2026-09-01T00:00:00.000Z");
    shortenCreatorCampaignApplyContinuationCookie(
      response,
      "C".repeat(43),
      new Date(now.getTime() + 24 * 60 * 60 * 1000),
      now,
    );
    expect(response.cookie).toHaveBeenCalledWith(
      CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME,
      "C".repeat(43),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
        maxAge: CREATOR_CAMPAIGN_CONTINUATION_IDEMPOTENCY_GRACE_MS,
      }),
    );
  });

  it("clears with the exact cookie security scope", () => {
    process.env.NODE_ENV = "test";
    const response = responseDouble();
    clearCreatorCampaignApplyContinuationCookie(response);
    expect(response.clearCookie).toHaveBeenCalledWith(
      CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME,
      {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
      },
    );
  });
});
