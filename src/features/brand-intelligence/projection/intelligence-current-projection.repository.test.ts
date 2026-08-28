import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import { IntelligenceCurrentProjectionRepository } from "./intelligence-current-projection.repository";

describe("W1.0F projection query boundary", () => {
  it("uses one repeatable transaction and a bounded three-query Object read", async () => {
    const row = {
      id: "current:1",
      brandId: "brand:1",
      objectSemanticId: "brand_description",
      pathSchemeVersion: 1,
      componentSemanticPath: "$",
      nodeKind: "SCALAR",
      currentComponentGenerationId: "component:1",
      currentContractId: "objects",
      currentContractVersion: "1.0",
      currentAuthority: "CREATOR_SHOP_DERIVED",
      currentSourceClass: "MULTI_SOURCE",
      currentReadiness: "READY",
      currentFreshness: "CURRENT",
      protectionState: "UNPROTECTED",
      revision: 1n,
      staleReasonCode: null,
      currentComponentGeneration: {
        id: "component:1",
        brandId: "brand:1",
        objectGenerationId: "object:1",
        objectSemanticId: "brand_description",
        componentSemanticPath: "$",
        pathSchemeVersion: 1,
        nodeKind: "SCALAR",
        componentContractId: "objects",
        componentContractVersion: "1.0",
        valueState: "VALUE",
        valuePayload: "Description",
        authority: "CREATOR_SHOP_DERIVED",
        sourceClass: "MULTI_SOURCE",
        readiness: "READY",
        freshnessAtGeneration: "CURRENT",
        presentationOrder: null,
        createdAt: new Date("2026-08-25T10:00:00.000Z"),
        objectGeneration: {
          id: "object:1",
          brandId: "brand:1",
          objectSemanticId: "brand_description",
          objectContractId: "objects",
          objectContractVersion: "1.0",
          outputContractId: "brand_meaning_output_contract",
          outputContractVersion: "1.0",
          bundleId: "brand_meaning",
          bundleVersion: "1.0",
          bundleHash: "a".repeat(64),
        },
      },
      candidates: [],
    };
    const transaction = {
      intelligenceCurrentComponent: {
        findMany: vi.fn().mockResolvedValue([row]),
      },
      intelligenceEvidenceReference: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      intelligenceBusinessStateReference: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (
          callback: (client: typeof transaction) => Promise<unknown>,
          _options: unknown,
        ) => callback(transaction),
      ),
    };
    const repository = new IntelligenceCurrentProjectionRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repository.readObjectSnapshot("brand:1", "brand_description"),
    ).resolves.toMatchObject({ components: [{ componentSemanticPath: "$" }] });
    expect(
      transaction.intelligenceCurrentComponent.findMany,
    ).toHaveBeenCalledTimes(1);
    expect(
      transaction.intelligenceEvidenceReference.findMany,
    ).toHaveBeenCalledTimes(1);
    expect(
      transaction.intelligenceBusinessStateReference.findMany,
    ).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });
});
