import { describe, expect, it, vi } from "vitest";

import { InstagramProviderRequestError } from "../../instagram/instagram-graph.client";
import { CreatorAiSyncService } from "./creator-ai-sync.service";

describe("CreatorAiSyncService Instagram insight failures", () => {
  it("does not persist synthetic zero engagement when provider insight access fails", async () => {
    const prisma = {
      creatorOnboardingTrack: {
        findUnique: vi.fn().mockResolvedValue({ userId: "creator-1" }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      $transaction: vi.fn(),
    };
    const graph = {
      fetchMe: vi.fn().mockResolvedValue({ username: "creator" }),
      fetchRecentMedia: vi.fn().mockResolvedValue([
        {
          id: "media-1",
          mediaType: "IMAGE",
          mediaUrl: null,
          thumbnailUrl: null,
          caption: null,
          timestamp: "2026-08-29T00:00:00.000Z",
        },
      ]),
      fetchMediaInsights: vi
        .fn()
        .mockRejectedValue(
          new InstagramProviderRequestError(
            "Provider authorization failed",
            "AUTHORIZATION_REVALIDATION_REQUIRED",
          ),
        ),
    };
    const instagram = {
      getActiveAccessTokenForUser: vi.fn().mockResolvedValue("token"),
    };
    const service = new CreatorAiSyncService(
      prisma as never,
      graph as never,
      instagram as never,
      {} as never,
    );

    await service.runActivationSync("creator-1", "track-1");

    expect(graph.fetchMediaInsights).toHaveBeenCalledOnce();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
