import { describe, expect, it, vi } from "vitest";

import type { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import type { CreatorAudienceCredentialFenceService } from "./creator-audience-credential-fence.service";
import { normalizeCreatorAudience } from "./creator-audience-normalizer";
import type { CreatorAudienceRepository } from "./creator-audience.repository";
import { CreatorAudienceService } from "./creator-audience.service";

const user = {
  id: "actor",
  email: "actor@example.test",
  role: "CREATOR",
} as never;

describe("Creator Audience authenticated read", () => {
  it.each(["OWNER", "MANAGER", "ASSISTANT"] as const)(
    "allows %s read and projects no mutation controls",
    async (role) => {
      const current = normalizeCreatorAudience({
        acquisition: {
          capturedAt: "2026-09-14T10:00:00.000Z",
          followerCount: { state: "OBSERVED", value: 5 },
          results: [],
        },
        role: "OWNER",
      });
      const actors = {
        resolveReadOnly: vi.fn().mockResolvedValue({
          actorRole: role,
          subjectCreatorProfileId: "creator",
          workspaceId: "workspace",
          allowedActions: ["INSIGHTS_AUDIENCE_READ"],
        }),
      } as unknown as CreatorWorkspaceActorService;
      const fence = {
        project: vi.fn().mockResolvedValue({
          authorized: true,
          integrationId: "integration",
          providerAccountId: "account",
          authorizationGeneration: 1,
          sourceStatus: "CONNECTED",
        }),
      } as unknown as CreatorAudienceCredentialFenceService;
      const repository = {
        readLatestCurrentSameAccount: vi.fn().mockResolvedValue({
          value: current,
          generatedAt: new Date("2026-09-14T10:00:00.000Z"),
          authorizationGeneration: 1,
        }),
        readProcessingTruth: vi.fn().mockResolvedValue("IDLE"),
      } as unknown as CreatorAudienceRepository;
      const value = await new CreatorAudienceService(
        actors,
        fence,
        repository,
      ).readAt(user, new Date("2026-09-14T11:00:00.000Z"));
      expect(value.context.role).toBe(role);
      expect(JSON.stringify(value)).not.toMatch(
        /token|lease|mutation|evidenceRef/i,
      );
    },
  );

  it("derives freshness at read time and exposes preserved-current failure truth", async () => {
    const current = normalizeCreatorAudience({
      acquisition: {
        capturedAt: "2026-09-01T00:00:00.000Z",
        followerCount: { state: "OBSERVED", value: 5 },
        results: [],
      },
      role: "OWNER",
    });
    const actors = {
      resolveReadOnly: vi.fn().mockResolvedValue({
        actorRole: "OWNER",
        subjectCreatorProfileId: "creator",
        workspaceId: "workspace",
        allowedActions: ["INSIGHTS_AUDIENCE_READ"],
      }),
    } as unknown as CreatorWorkspaceActorService;
    const fence = {
      project: vi.fn().mockResolvedValue({
        authorized: true,
        integrationId: "integration",
        providerAccountId: "account",
        authorizationGeneration: 2,
        sourceStatus: "CONNECTED",
      }),
    } as unknown as CreatorAudienceCredentialFenceService;
    const repository = {
      readLatestCurrentSameAccount: vi.fn().mockResolvedValue({
        value: current,
        generatedAt: new Date("2026-09-01T00:00:00.000Z"),
        authorizationGeneration: 1,
      }),
      readProcessingTruth: vi.fn().mockResolvedValue("FAILED"),
    } as unknown as CreatorAudienceRepository;
    const service = new CreatorAudienceService(actors, fence, repository);
    const before = await service.readAt(
      user,
      new Date("2026-09-08T23:59:59.000Z"),
    );
    const boundary = await service.readAt(
      user,
      new Date("2026-09-09T00:00:00.000Z"),
    );
    const after = await service.readAt(
      user,
      new Date("2026-09-09T00:00:01.000Z"),
    );
    expect(before.freshness.state).toBe("CURRENT");
    expect(boundary.freshness.state).toBe("STALE");
    expect(after.freshness.state).toBe("STALE");
    expect(boundary.processingState).toBe("FAILED");
    expect(boundary.sourceStatus).toBe("PROVIDER_FAILURE");
    expect(boundary.currentPreserved).toBe(true);
  });

  it("does not relabel a different provider account as preserved current", async () => {
    const actors = {
      resolveReadOnly: vi.fn().mockResolvedValue({
        actorRole: "OWNER",
        subjectCreatorProfileId: "creator",
        workspaceId: "workspace",
        allowedActions: ["INSIGHTS_AUDIENCE_READ"],
      }),
    } as unknown as CreatorWorkspaceActorService;
    const fence = {
      project: vi.fn().mockResolvedValue({
        authorized: true,
        integrationId: "integration-new",
        providerAccountId: "different-account",
        authorizationGeneration: 1,
        sourceStatus: "CONNECTED",
      }),
    } as unknown as CreatorAudienceCredentialFenceService;
    const readLatestCurrentSameAccount = vi.fn().mockResolvedValue(null);
    const repository = {
      readLatestCurrentSameAccount,
      readProcessingTruth: vi.fn().mockResolvedValue("IDLE"),
    } as unknown as CreatorAudienceRepository;
    const value = await new CreatorAudienceService(
      actors,
      fence,
      repository,
    ).readAt(user, new Date("2026-09-14T11:00:00.000Z"));
    expect(value.status).toBe("UNAVAILABLE");
    expect(value.currentPreserved).toBe(false);
    expect(readLatestCurrentSameAccount).toHaveBeenCalledWith(
      expect.objectContaining({ providerAccountId: "different-account" }),
    );
  });

  it("denies an actor without the explicit Audience read action", async () => {
    const actors = {
      resolveReadOnly: vi
        .fn()
        .mockResolvedValue({ actorRole: "ASSISTANT", allowedActions: [] }),
    } as unknown as CreatorWorkspaceActorService;
    const service = new CreatorAudienceService(
      actors,
      {} as CreatorAudienceCredentialFenceService,
      {} as CreatorAudienceRepository,
    );
    await expect(service.read(user)).rejects.toThrow(
      "Creator Audience read access required",
    );
  });
});
