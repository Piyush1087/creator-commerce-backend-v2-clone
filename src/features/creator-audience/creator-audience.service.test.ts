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
        readCurrent: vi.fn().mockResolvedValue(current),
      } as unknown as CreatorAudienceRepository;
      const value = await new CreatorAudienceService(
        actors,
        fence,
        repository,
      ).read(user);
      expect(value.context.role).toBe(role);
      expect(JSON.stringify(value)).not.toMatch(
        /token|lease|mutation|evidenceRef/i,
      );
    },
  );

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
