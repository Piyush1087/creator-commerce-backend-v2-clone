import { describe, expect, it, vi } from "vitest";

import type { InstagramSyncLease } from "./instagram-sync-coordinator.repository";
import { InstagramSyncPipelineAdapter } from "./instagram-sync-pipeline.adapter";

const lease = {
  jobId: "f4e3c1e4-a567-4e8b-92fe-87ef173a9854",
  leaseToken: "b80426fb-d291-4683-99c9-539d61546b63",
  leaseOwnerRef: "worker",
  brandProfileId: "e404e021-2538-4d9d-a09c-71f4e7592b23",
  integrationId: "9824b96a-c1fb-469f-a14c-3c6e41408866",
  providerAccountId: "provider-1",
  authorizationGeneration: 2,
  capabilityClass: "INITIAL_30_DAY",
  trigger: "INITIAL_CONNECT",
  requestIdentity: "request-1",
  attemptNumber: 1,
  windowEnd: new Date("2026-09-12T12:00:00.000Z"),
} satisfies InstagramSyncLease;

describe("InstagramSyncPipelineAdapter", () => {
  it("runs the accepted B2/B3B/C2/C3/C4 chain and returns persisted generations", async () => {
    const prisma = {
      brandIntegration: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          firstPartyInsightsCapability: "YES",
        }),
      },
      dataExtractionEvidenceItem: {
        findFirst: vi.fn().mockResolvedValue({ evidenceRef: "evidence:c2" }),
      },
      intelligenceObjectGeneration: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "generation-a" }, { id: "generation-b" }]),
      },
    };
    const reads = {
      execute: vi.fn(
        async (input: { command: { kind: string; breakdown?: string } }) => {
          if (input.command.kind === "PROFILE") {
            return {
              result: {
                availability: "AVAILABLE",
                providerAccountId: "provider-1",
                appScopedUserId: { state: "OBSERVED", value: "app-user" },
                username: { state: "OBSERVED", value: "brand" },
                name: { state: "OBSERVED", value: "Brand" },
                accountType: { state: "OBSERVED", value: "BUSINESS" },
                followersCount: { state: "OBSERVED", value: 10 },
                followsCount: { state: "OBSERVED", value: 2 },
                mediaCount: { state: "OBSERVED_ZERO", value: 0 },
              },
            };
          }
          return {
            result: {
              availability: "AVAILABLE",
              population: "FOLLOWERS",
              breakdown: input.command.breakdown,
              timeframe: "THIS_MONTH",
              values: [{ dimension: "synthetic", value: 1 }],
              limitation: null,
            },
          };
        },
      ),
    };
    const writer = { write: vi.fn().mockResolvedValue({}) };
    const media = { execute: vi.fn().mockResolvedValue({}) };
    const foundations = { execute: vi.fn().mockResolvedValue({}) };
    const semantics = { execute: vi.fn().mockResolvedValue({}) };
    const c4 = {
      execute: vi.fn().mockResolvedValue([
        { status: "COMPLETED", processorExecutionId: "processor-a" },
        { status: "COMPLETED", processorExecutionId: "processor-b" },
        { status: "COMPLETED", processorExecutionId: "processor-c" },
      ]),
    };
    const adapter = new InstagramSyncPipelineAdapter(
      prisma as never,
      reads as never,
      writer as never,
      media as never,
      foundations as never,
      semantics as never,
      c4 as never,
      { execute: vi.fn().mockResolvedValue(["generation-hidden"]) } as never,
    );

    await expect(adapter.execute(lease)).resolves.toEqual({
      generationIds: ["generation-a", "generation-b", "generation-hidden"],
    });
    expect(media.execute).toHaveBeenCalledTimes(1);
    expect(reads.execute).toHaveBeenCalledTimes(9);
    expect(writer.write).toHaveBeenCalledTimes(3);
    expect(foundations.execute).toHaveBeenCalledTimes(1);
    expect(semantics.execute).toHaveBeenCalledWith(
      expect.objectContaining({ c2EvidenceRef: "evidence:c2" }),
    );
    expect(c4.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerIdempotencyKey: "request-1",
      }),
    );
  });

  it("does not mark a partially failed C4 chain complete", async () => {
    const prisma = {
      brandIntegration: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          firstPartyInsightsCapability: "NO",
        }),
      },
      dataExtractionEvidenceItem: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const adapter = new InstagramSyncPipelineAdapter(
      prisma as never,
      {
        execute: vi.fn().mockResolvedValue({
          result: { availability: "UNAVAILABLE" },
        }),
      } as never,
      { write: vi.fn().mockResolvedValue({}) } as never,
      { execute: vi.fn().mockResolvedValue({}) } as never,
      { execute: vi.fn().mockResolvedValue({}) } as never,
      { execute: vi.fn() } as never,
      {
        execute: vi
          .fn()
          .mockResolvedValue([
            { status: "FAILED_TERMINAL", processorExecutionId: "processor-a" },
          ]),
      } as never,
      { execute: vi.fn() } as never,
    );
    await expect(adapter.execute(lease)).rejects.toThrow(
      "INSTAGRAM_C4_PIPELINE_INCOMPLETE",
    );
  });
});
