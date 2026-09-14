import { describe, expect, it, vi } from "vitest";

import { InstagramIntelligenceReadFenceError } from "../../brand-settings/services/instagram-intelligence-provider-read.service";
import type { InstagramSyncLease } from "./instagram-sync-coordinator.repository";
import { InstagramSyncDispatcherService } from "./instagram-sync-dispatcher.service";

const lease = {
  jobId: "f4e3c1e4-a567-4e8b-92fe-87ef173a9854",
  leaseToken: "b80426fb-d291-4683-99c9-539d61546b63",
  leaseOwnerRef: "worker",
  brandProfileId: "e404e021-2538-4d9d-a09c-71f4e7592b23",
  integrationId: "9824b96a-c1fb-469f-a14c-3c6e41408866",
  providerAccountId: "provider-1",
  authorizationGeneration: 2,
  capabilityClass: "INITIAL_30_DAY",
  trigger: "RECONNECT",
  requestIdentity: "request-1",
  attemptNumber: 1,
  windowEnd: new Date("2026-09-12T12:00:00.000Z"),
} satisfies InstagramSyncLease;

describe("InstagramSyncDispatcherService", () => {
  it("completes a claimed job with durable generation IDs", async () => {
    const repository = {
      claimNext: vi.fn().mockResolvedValue(lease),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn(),
    };
    const pipeline = {
      execute: vi.fn().mockResolvedValue({ generationIds: ["generation-1"] }),
    };
    const dispatcher = new InstagramSyncDispatcherService(
      repository as never,
      pipeline as never,
    );
    await expect(dispatcher.dispatch()).resolves.toEqual({ processed: true });
    expect(repository.complete).toHaveBeenCalledWith(lease, ["generation-1"]);
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it("classifies an authorization fence without exposing provider details", async () => {
    const repository = {
      claimNext: vi.fn().mockResolvedValue(lease),
      complete: vi.fn(),
      fail: vi.fn().mockResolvedValue(undefined),
    };
    const pipeline = {
      execute: vi
        .fn()
        .mockRejectedValue(
          new InstagramIntelligenceReadFenceError("GENERATION_MISMATCH"),
        ),
    };
    const dispatcher = new InstagramSyncDispatcherService(
      repository as never,
      pipeline as never,
    );
    await dispatcher.dispatch();
    expect(repository.fail).toHaveBeenCalledWith(
      lease,
      "AUTHORIZATION",
      "GENERATION_MISMATCH",
    );
  });

  it("uses the same hourly dispatcher for a due Creator Audience lease", async () => {
    const creatorLease = {
      ...lease,
      actor: {
        actorUserId: "owner-user",
        actorMembershipId: "system:scope",
        actorRole: "OWNER",
        workspaceId: "workspace",
        organizationId: "organization",
        subjectCreatorProfileId: "creator",
        subjectOwnerUserId: "owner-user",
        allowedActions: ["INSIGHTS_AUDIENCE_READ"],
      },
      capabilityClass: "AUDIENCE",
    } as const;
    const repository = {
      claimNext: vi.fn().mockResolvedValue(null),
      claimNextCreator: vi.fn().mockResolvedValue(creatorLease),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn(),
    };
    const creatorAudience = {
      execute: vi
        .fn()
        .mockResolvedValue({ generationIds: ["creator-generation"] }),
    };
    const dispatcher = new InstagramSyncDispatcherService(
      repository as never,
      { execute: vi.fn() } as never,
      creatorAudience as never,
    );
    await expect(dispatcher.dispatch()).resolves.toEqual({ processed: true });
    expect(creatorAudience.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: creatorLease.actor,
        integrationId: creatorLease.integrationId,
        requestIdentity: creatorLease.requestIdentity,
      }),
    );
    expect(repository.complete).toHaveBeenCalledWith(creatorLease, [
      "creator-generation",
    ]);
  });

  it("routes the existing Creator daily media lease to Content without a second scheduler", async () => {
    const creatorLease = {
      ...lease,
      actor: {
        actorUserId: "owner-user",
        actorMembershipId: "system:scope",
        actorRole: "OWNER",
        workspaceId: "workspace",
        organizationId: "organization",
        subjectCreatorProfileId: "creator",
        subjectOwnerUserId: "owner-user",
        allowedActions: ["INSIGHTS_CONTENT_READ"],
      },
      capabilityClass: "PROFILE_MEDIA_PERFORMANCE",
    } as const;
    const repository = {
      claimNext: vi.fn().mockResolvedValue(null),
      claimNextCreator: vi.fn().mockResolvedValue(creatorLease),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn(),
    };
    const content = {
      execute: vi
        .fn()
        .mockResolvedValue({ generationIds: ["content-generation"] }),
    };
    const dispatcher = new InstagramSyncDispatcherService(
      repository as never,
      { execute: vi.fn() } as never,
      undefined,
      content as never,
    );
    await expect(dispatcher.dispatch()).resolves.toEqual({ processed: true });
    expect(content.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: creatorLease.actor,
        requestIdentity: creatorLease.requestIdentity,
      }),
    );
    expect(repository.complete).toHaveBeenCalledWith(creatorLease, [
      "content-generation",
    ]);
  });
});
