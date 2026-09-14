import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { CreatorAudienceCredentialFenceService } from "../creator-audience/creator-audience-credential-fence.service";
import type { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { CreatorContentService } from "./creator-content.service";
import type { CreatorContentRepository } from "./creator-content.repository";

const now = new Date("2026-09-15T12:00:00.000Z");
describe("Creator Content authenticated consumer", () => {
  it.each(["OWNER", "MANAGER", "ASSISTANT"] as const)(
    "allows %s through explicit Content read authority",
    async (role) => {
      const actors = {
        resolveReadOnly: async () => ({
          actorRole: role,
          subjectCreatorProfileId: "creator",
          workspaceId: "workspace",
          allowedActions: ["INSIGHTS_CONTENT_READ"],
        }),
      };
      const fence = {
        project: async () => ({
          integrationId: null,
          providerAccountId: null,
          authorizationGeneration: null,
          sourceStatus: "DISCONNECTED",
          authorized: false,
        }),
      };
      const value = await new CreatorContentService(
        actors as unknown as CreatorWorkspaceActorService,
        fence as unknown as CreatorAudienceCredentialFenceService,
        {} as CreatorContentRepository,
      ).readAt({ id: "user" } as never, now);
      expect(value.context.role).toBe(role);
      expect(value.status).toBe("UNAVAILABLE");
      expect(value.sourceStatus).toBe("DISCONNECTED");
    },
  );

  it("denies an actor without Content authority before reading source or current", async () => {
    const actors = {
      resolveReadOnly: async () => ({
        actorRole: "ASSISTANT",
        allowedActions: [],
      }),
    };
    const service = new CreatorContentService(
      actors as unknown as CreatorWorkspaceActorService,
      {} as CreatorAudienceCredentialFenceService,
      {} as CreatorContentRepository,
    );
    await expect(
      service.readAt({ id: "user" } as never, now),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("projects a degraded source while preserving the last verified current", async () => {
    const actors = {
      resolveReadOnly: async () => ({
        actorRole: "MANAGER",
        subjectCreatorProfileId: "creator",
        workspaceId: "workspace",
        allowedActions: ["INSIGHTS_CONTENT_READ"],
      }),
    };
    const disconnectedFence = {
      project: async () => ({
        integrationId: null,
        providerAccountId: null,
        authorizationGeneration: null,
        sourceStatus: "DISCONNECTED",
        authorized: false,
      }),
    };
    const unavailable = await new CreatorContentService(
      actors as unknown as CreatorWorkspaceActorService,
      disconnectedFence as unknown as CreatorAudienceCredentialFenceService,
      {} as CreatorContentRepository,
    ).readAt({ id: "user" } as never, now);
    const current = {
      value: { ...unavailable, currentPreserved: false },
      generatedAt: new Date("2026-09-15T10:00:00.000Z"),
      authorizationGeneration: 7,
    };
    const repository = {
      readLatestCurrentSameAccount: async () => current,
      readProcessingTruth: async () => "IDLE",
    };
    const reauthFence = {
      project: async () => ({
        integrationId: "integration",
        providerAccountId: "account",
        authorizationGeneration: 7,
        sourceStatus: "REAUTH_REQUIRED",
        authorized: false,
      }),
    };
    const projected = await new CreatorContentService(
      actors as unknown as CreatorWorkspaceActorService,
      reauthFence as unknown as CreatorAudienceCredentialFenceService,
      repository as unknown as CreatorContentRepository,
    ).readAt({ id: "user" } as never, now);
    expect(projected.context.role).toBe("MANAGER");
    expect(projected.sourceStatus).toBe("REAUTH_REQUIRED");
    expect(projected.currentPreserved).toBe(true);
    expect(projected.generatedAt).toBe(unavailable.generatedAt);
  });
});
