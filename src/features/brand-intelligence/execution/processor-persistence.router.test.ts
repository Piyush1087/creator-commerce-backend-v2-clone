import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { ClaimedProcessorWork } from "./domain/intelligence-execution.types";
import { SYNTHETIC_PROCESSOR_ID } from "./domain/intelligence-execution.types";
import { ProcessorPersistenceRouter } from "./processor-persistence.router";
import type { BrandCommunicationPersistenceHook } from "../processors/brand-communication/brand-communication-persistence.hook";
import type { BrandMeaningPersistenceHook } from "../processors/brand-meaning/brand-meaning-persistence.hook";
import type { AudienceV1PersistenceHook } from "../../creator-audience-v1/creator-audience-v1.persistence";

describe("bounded processor persistence routing", () => {
  it("routes V1 only to its registered hook, retaining fail-closed missing registration", async () => {
    const communication = { persistBeforeCompletion: vi.fn(async () => {}) };
    const meaning = { persistBeforeCompletion: vi.fn(async () => {}) };
    const v1 = { persistBeforeCompletion: vi.fn(async () => {}) };
    const make = (hook?: AudienceV1PersistenceHook) =>
      new ProcessorPersistenceRouter(
        communication as unknown as BrandCommunicationPersistenceHook,
        meaning as unknown as BrandMeaningPersistenceHook,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        hook,
      );
    const tx = {} as Prisma.TransactionClient;
    const claim = {
      processorExecution: { processorId: "creator_audience_v1" },
    } as ClaimedProcessorWork;
    const result = { readiness: "READY" as const };
    await make(v1 as AudienceV1PersistenceHook).persistBeforeCompletion(
      tx,
      claim,
      result,
    );
    expect(v1.persistBeforeCompletion).toHaveBeenCalledTimes(1);
    expect(v1.persistBeforeCompletion).toHaveBeenCalledWith(tx, claim, result);
    expect(communication.persistBeforeCompletion).not.toHaveBeenCalled();
    expect(meaning.persistBeforeCompletion).not.toHaveBeenCalled();
    await expect(
      make().persistBeforeCompletion(tx, claim, result),
    ).rejects.toMatchObject({
      failure: { code: "CREATOR_AUDIENCE_V1_PERSISTENCE_MISSING" },
    });
  });
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
