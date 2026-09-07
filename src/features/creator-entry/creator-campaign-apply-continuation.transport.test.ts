import {
  ConflictException,
  GoneException,
  NotFoundException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { CreatorEntryController } from "./creator-entry.controller";
import {
  CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME,
  CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
} from "./creator-campaign-apply-continuation-cookie.util";
import { CREATOR_CAMPAIGN_CONTINUATION_IDEMPOTENCY_GRACE_MS } from "./creator-campaign-apply-continuation.service";
import { PublicMarketplaceController } from "../creator-marketplace/public-marketplace.controller";

const token = "T".repeat(43);
const user = {
  id: "user-1",
  email: "creator@example.test",
  role: "CREATOR" as const,
};

const responseDouble = () =>
  ({ cookie: vi.fn(), clearCookie: vi.fn() }) as unknown as Response;
const cookieRequest = (value = token) =>
  ({
    headers: {
      cookie: `${CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME}=${value}`,
    },
    user,
  }) as unknown as RequestWithAuthUser;

const creatorController = (continuations: object) =>
  new CreatorEntryController(
    null as never,
    null as never,
    null as never,
    null as never,
    continuations as never,
  );

describe("Creator Campaign continuation HTTP transport", () => {
  it("sets the opaque cookie while keeping issuance JSON token-free", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const controller = new PublicMarketplaceController(
      null as never,
      null as never,
      {
        issue: vi.fn().mockResolvedValue({
          intent: "CAMPAIGN_APPLY",
          continuationToken: token,
          expiresAt,
        }),
      } as never,
    );
    const response = responseDouble();
    const result = await controller.issueApplyContinuation(
      "campaign-1",
      response,
    );
    expect(result).toEqual({
      intent: "CAMPAIGN_APPLY",
      expiresAt,
      continuationPresent: true,
    });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(result).not.toHaveProperty("continuationToken");
    expect(response.cookie).toHaveBeenCalledWith(
      CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME,
      token,
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: CREATOR_CAMPAIGN_CONTINUATION_COOKIE_PATH,
      }),
    );
  });

  it("returns only boolean presence and clears malformed or unknown cookies", async () => {
    const isPresent = vi.fn().mockResolvedValue(false);
    const controller = creatorController({ isPresent });
    const response = responseDouble();
    await expect(
      controller.campaignApplyContinuationStatus(
        cookieRequest("not-valid") as Request,
        response,
      ),
    ).resolves.toEqual({ present: false });
    expect(isPresent).toHaveBeenCalledWith("not-valid");
    expect(response.clearCookie).toHaveBeenCalledTimes(1);
  });

  it("discard clears only browser transport without invoking persistence", () => {
    const continuations = { isPresent: vi.fn(), resolve: vi.fn() };
    const controller = creatorController(continuations);
    const response = responseDouble();
    expect(controller.discardCampaignApplyContinuation(response)).toEqual({
      present: false,
    });
    expect(response.clearCookie).toHaveBeenCalledTimes(1);
    expect(continuations.isPresent).not.toHaveBeenCalled();
    expect(continuations.resolve).not.toHaveBeenCalled();
  });

  it("resolves from the cookie with no public transport metadata", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const resolve = vi.fn().mockResolvedValue({
      status: "PENDING_CREATOR_ENTRY",
      intent: "CAMPAIGN_APPLY",
      nextAction: "CONNECT_INSTAGRAM",
      continuationExpiresAt: expiresAt,
    });
    const controller = creatorController({ resolve });
    const response = responseDouble();
    await expect(
      controller.resolveCampaignApplyContinuation(cookieRequest(), response),
    ).resolves.toEqual({
      status: "PENDING_CREATOR_ENTRY",
      intent: "CAMPAIGN_APPLY",
      nextAction: "CONNECT_INSTAGRAM",
    });
    expect(resolve).toHaveBeenCalledWith(user, token);
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it("shortens READY transport to the bounded response-loss grace", async () => {
    const resolve = vi.fn().mockResolvedValue({
      status: "READY_TO_RETURN",
      intent: "CAMPAIGN_APPLY",
      nextAction: "RETURN_TO_ORIGINATING_CAMPAIGN",
      campaign: { campaignId: "campaign-1" },
      continuationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const controller = creatorController({ resolve });
    const response = responseDouble();
    const result = await controller.resolveCampaignApplyContinuation(
      cookieRequest(),
      response,
    );
    expect(result).not.toHaveProperty("continuationExpiresAt");
    expect(response.cookie).toHaveBeenCalledWith(
      CREATOR_CAMPAIGN_CONTINUATION_COOKIE_NAME,
      token,
      expect.objectContaining({
        maxAge: expect.any(Number),
      }),
    );
    const options = vi.mocked(response.cookie).mock.calls[0][2];
    expect(options?.maxAge).toBeGreaterThan(0);
    expect(options?.maxAge).toBeLessThanOrEqual(
      CREATOR_CAMPAIGN_CONTINUATION_IDEMPOTENCY_GRACE_MS,
    );
  });

  it.each([new NotFoundException(), new GoneException()])(
    "clears invalid or expired resolve transport",
    async (failure) => {
      const controller = creatorController({
        resolve: vi.fn().mockRejectedValue(failure),
      });
      const response = responseDouble();
      await expect(
        controller.resolveCampaignApplyContinuation(cookieRequest(), response),
      ).rejects.toBe(failure);
      expect(response.clearCookie).toHaveBeenCalledTimes(1);
    },
  );

  it("retains the cookie after identity conflict", async () => {
    const failure = new ConflictException();
    const controller = creatorController({
      resolve: vi.fn().mockRejectedValue(failure),
    });
    const response = responseDouble();
    await expect(
      controller.resolveCampaignApplyContinuation(cookieRequest(), response),
    ).rejects.toBe(failure);
    expect(response.clearCookie).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });
});
