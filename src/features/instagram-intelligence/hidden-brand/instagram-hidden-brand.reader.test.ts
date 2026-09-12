import { describe, expect, it, vi } from "vitest";

import { InstagramHiddenBrandReader } from "./instagram-hidden-brand.reader";

function generation(input: {
  id: string;
  objectId?: string;
  processorId?: string;
  windowEnd: string;
  completedAt: string;
}) {
  return {
    id: input.id,
    objectSemanticId: input.objectId ?? "communication_profile",
    objectContractVersion: "1.0",
    outputContractVersion: "1.0",
    producerId: input.processorId ?? "brand_communication",
    readiness: "READY",
    freshnessAtGeneration: "CURRENT",
    objectMetadataPayload: {
      sourceScope: "INSTAGRAM_OWNED",
      sourceProfileVersion: "1.1",
      windowStart: "2026-08-01T00:00:00.000Z",
      windowEnd: input.windowEnd,
    },
    processorExecution: {
      processorId: input.processorId ?? "brand_communication",
      completedAt: new Date(input.completedAt),
    },
    evidenceReferences: [
      {
        evidenceRef: "evidence:1",
        capabilityId: "instagram.caption_context",
        sourceClass: "INSTAGRAM_OWNED",
      },
    ],
  };
}

describe("Instagram hidden Brand latest-successful reader", () => {
  it("uses cutoff, finalization and immutable ID ordering without cross-source fallback", async () => {
    const rows = [
      generation({
        id: "g-old",
        windowEnd: "2026-09-01T00:00:00.000Z",
        completedAt: "2026-09-03T00:00:00.000Z",
      }),
      generation({
        id: "g-tie-a",
        windowEnd: "2026-09-12T00:00:00.000Z",
        completedAt: "2026-09-12T01:00:00.000Z",
      }),
      generation({
        id: "g-tie-z",
        windowEnd: "2026-09-12T00:00:00.000Z",
        completedAt: "2026-09-12T01:00:00.000Z",
      }),
      generation({
        id: "g-values",
        objectId: "brand_values",
        processorId: "brand_character",
        windowEnd: "2026-09-12T00:00:00.000Z",
        completedAt: "2026-09-12T00:00:00.000Z",
      }),
      generation({
        id: "g-personality",
        objectId: "brand_personality",
        processorId: "brand_character",
        windowEnd: "2026-09-12T00:00:00.000Z",
        completedAt: "2026-09-12T00:00:00.000Z",
      }),
    ];
    const findMany = vi.fn(async () => rows);
    const reader = new InstagramHiddenBrandReader({
      intelligenceObjectGeneration: { findMany },
    } as never);
    const result = await reader.latestSuccessful("brand-1");
    expect(result.map((row) => row.generationId)).toEqual([
      "g-tie-z",
      "g-values",
      "g-personality",
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          brandId: "brand-1",
          processorExecution: { status: "COMPLETED" },
          objectMetadataPayload: {
            path: ["sourceScope"],
            equals: "INSTAGRAM_OWNED",
          },
        }),
      }),
    );
  });

  it("returns explicit no-result and rejects an absent server-owned scope", async () => {
    const reader = new InstagramHiddenBrandReader({
      intelligenceObjectGeneration: { findMany: vi.fn(async () => []) },
    } as never);
    await expect(reader.latestSuccessful("brand-1")).resolves.toEqual([]);
    await expect(reader.latestSuccessful(" ")).rejects.toThrow(
      "INSTAGRAM_HIDDEN_BRAND_SCOPE_REQUIRED",
    );
  });
});
