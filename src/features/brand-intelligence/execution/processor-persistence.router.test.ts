import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { ClaimedProcessorWork } from "./domain/intelligence-execution.types";
import { SYNTHETIC_PROCESSOR_ID } from "./domain/intelligence-execution.types";
import { ProcessorPersistenceRouter } from "./processor-persistence.router";
import type { BrandCommunicationPersistenceHook } from "../processors/brand-communication/brand-communication-persistence.hook";
import type { BrandMeaningPersistenceHook } from "../processors/brand-meaning/brand-meaning-persistence.hook";

describe("bounded processor persistence routing", () => {
  it("passes the same transaction/claim/result to exactly the matching hook", async () => {
    const communication = { persistBeforeCompletion: vi.fn(async () => {}) };
    const meaning = { persistBeforeCompletion: vi.fn(async () => {}) };
    const router = new ProcessorPersistenceRouter(
      communication as unknown as BrandCommunicationPersistenceHook,
      meaning as unknown as BrandMeaningPersistenceHook,
    );
    const tx = {} as Prisma.TransactionClient;
    for (const processorId of ["brand_communication", "brand_meaning"]) {
      const claim = {
        processorExecution: { processorId },
      } as ClaimedProcessorWork;
      const result = { readiness: "READY" as const };
      await router.persistBeforeCompletion(tx, claim, result);
      expect(
        (processorId === "brand_meaning" ? meaning : communication)
          .persistBeforeCompletion,
      ).toHaveBeenCalledWith(tx, claim, result);
    }
    expect(meaning.persistBeforeCompletion).toHaveBeenCalledTimes(1);
    expect(communication.persistBeforeCompletion).toHaveBeenCalledTimes(1);
    await router.persistBeforeCompletion(
      tx,
      {
        processorExecution: { processorId: SYNTHETIC_PROCESSOR_ID },
      } as ClaimedProcessorWork,
      { readiness: "READY" },
    );
    await expect(
      router.persistBeforeCompletion(
        tx,
        {
          processorExecution: { processorId: "unknown" },
        } as ClaimedProcessorWork,
        { readiness: "READY" },
      ),
    ).rejects.toMatchObject({
      failure: { code: "PERSISTENCE_HOOK_REGISTRATION_MISSING" },
    });
    expect(meaning.persistBeforeCompletion).toHaveBeenCalledTimes(1);
    expect(communication.persistBeforeCompletion).toHaveBeenCalledTimes(1);
  });
});
