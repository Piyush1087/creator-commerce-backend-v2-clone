import type { Request, Response } from "express";

import {
  CREATOR_CAMPAIGN_CONTINUATION_IDEMPOTENCY_GRACE_MS,
  CREATOR_CAMPAIGN_CONTINUATION_TTL_MS,
} from "./creator-campaign-apply-continuation.service";

export const CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME =
  "tcs_creator_apply_continuation";
export const CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH =
  "/api/v1/creator-entry/campaign-apply/continuation";

const secureCookie = (): boolean =>
  process.env.STAGE !== "local" && process.env.NODE_ENV !== "test";

export function readCreatorCampaignApplyContinuationCookie(
  request: Request,
): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (
      item.slice(0, separator).trim() ===
      CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME
    ) {
      const value = item.slice(separator + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return undefined;
}

export function setCreatorCampaignApplyContinuationCookie(
  response: Response,
  opaqueToken: string,
  continuationExpiresAt: Date,
  now = new Date(),
): void {
  const maxAge = Math.min(
    CREATOR_CAMPAIGN_CONTINUATION_TTL_MS,
    continuationExpiresAt.getTime() - now.getTime(),
  );
  if (maxAge <= 0) {
    clearCreatorCampaignApplyContinuationCookie(response);
    return;
  }
  response.cookie(CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME, opaqueToken, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    path: CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
    maxAge,
  });
}

export function shortenCreatorCampaignApplyContinuationCookie(
  response: Response,
  opaqueToken: string,
  continuationExpiresAt: Date,
  now = new Date(),
): void {
  setCreatorCampaignApplyContinuationCookie(
    response,
    opaqueToken,
    new Date(
      Math.min(
        continuationExpiresAt.getTime(),
        now.getTime() + CREATOR_CAMPAIGN_CONTINUATION_IDEMPOTENCY_GRACE_MS,
      ),
    ),
    now,
  );
}

export function clearCreatorCampaignApplyContinuationCookie(
  response: Response,
): void {
  response.clearCookie(CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    path: CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
  });
}
