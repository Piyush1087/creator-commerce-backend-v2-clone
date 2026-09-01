import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import {
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { CreatorEntryStateService } from "./creator-entry-state.service";
import { CreatorPlatformAccessGuard } from "./creator-platform-access.guard";

const context = {
  switchToHttp: () => ({
    getRequest: () => ({ user: { id: "creator-user" } }),
  }),
} as unknown as ExecutionContext;

describe("C01-I3 CreatorPlatformAccessGuard", () => {
  it.each([
    ProviderCapabilityState.UNAVAILABLE,
    ProviderCapabilityState.UNKNOWN,
  ])("allows persisted entry with Insights %s", async (insightsCapability) => {
    const state = {
      read: vi.fn().mockResolvedValue({
        canEnterCreatorPlatform: true,
        instagram: {
          identityConnection: "CONNECTED",
          basicAuthorization: ProviderCapabilityState.AVAILABLE,
          insightsCapability,
          authorizationHealth: ProviderAuthorizationHealth.USABLE,
        },
      }),
    } as unknown as CreatorEntryStateService;
    await expect(
      new CreatorPlatformAccessGuard(state).canActivate(context),
    ).resolves.toBe(true);
    expect(state.read).toHaveBeenCalledOnce();
  });

  it.each([
    {
      label: "no Instagram identity",
      health: ProviderAuthorizationHealth.UNKNOWN,
    },
    {
      label: "reauthorization-required health",
      health: ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
    },
  ])("denies $label without mutating context", async ({ health }) => {
    const state = {
      read: vi.fn().mockResolvedValue({
        canEnterCreatorPlatform: false,
        instagram: { authorizationHealth: health },
      }),
    } as unknown as CreatorEntryStateService;
    await expect(
      new CreatorPlatformAccessGuard(state).canActivate(context),
    ).rejects.toMatchObject<ForbiddenException>({
      response: { code: "CREATOR_PLATFORM_ACCESS_REQUIRED" },
    });
    expect(state.read).toHaveBeenCalledOnce();
  });
});
