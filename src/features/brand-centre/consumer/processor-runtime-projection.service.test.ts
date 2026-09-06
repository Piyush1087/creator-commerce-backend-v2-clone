import type { IntelligenceProcessorExecutionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { CurrentIntelligenceObjectProjection } from "../../brand-intelligence/projection/intelligence-current-projection.types";
import {
  aggregateProcessorRuntime,
  ProcessorRuntimeProjectionService,
} from "./processor-runtime-projection.service";
import { BRAND_PROCESSOR_IDS } from "./processor-runtime-projection.types";

interface Row {
  status: IntelligenceProcessorExecutionStatus;
  attemptCount: number;
  maxAttempts: number;
  lastErrorCategory: string | null;
  lastErrorCode: string | null;
  createdAt: Date;
  id: string;
}

const row = (
  status: IntelligenceProcessorExecutionStatus,
  options: Partial<Row> = {},
): Row => ({
  status,
  attemptCount: 0,
  maxAttempts: 3,
  lastErrorCategory: null,
  lastErrorCode: null,
  createdAt: new Date("2026-08-27T00:00:00.000Z"),
  id: crypto.randomUUID(),
  ...options,
});

const current = (
  objectSemanticId: string,
): CurrentIntelligenceObjectProjection =>
  ({
    objectSemanticId,
    objectState: "CURRENT",
  }) as CurrentIntelligenceObjectProjection;

describe("processor-scoped Brand runtime projection", () => {
  it("returns idle no-current runtime without creating a missing subject", async () => {
    const create = vi.fn();
    const findFirst = vi.fn();
    const service = new ProcessorRuntimeProjectionService({
      intelligenceSubject: {
        findUnique: async () => null,
        create,
      },
      intelligenceProcessorExecution: { findFirst },
    } as unknown as PrismaService);

    const projection = await service.read("brand", []);

    expect(create).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(Object.keys(projection)).toEqual(BRAND_PROCESSOR_IDS);
    expect(
      Object.values(projection).every(
        (entry) =>
          entry.activity === "IDLE" &&
          entry.readiness === "UNKNOWN" &&
          !entry.hasCurrent,
      ),
    ).toBe(true);
  });

  it("projects all seven independently without fabricating a dependency cause", async () => {
    const rows = new Map<string, Row | null>([
      ["brand_communication", row("COMPLETED")],
      ["brand_meaning", row("QUEUED")],
      ["brand_character", row("RUNNING")],
      ["audience_persona_synthesis", row("WAITING_FOR_DEPENDENCY")],
      ["brand_differentiation", row("RUNNING")],
      [
        "visual_style_synthesis",
        row("WAITING_FOR_DEPENDENCY", {
          lastErrorCategory: "DEPENDENCY_UNAVAILABLE",
          lastErrorCode: "WAITING_FOR_EVIDENCE",
        }),
      ],
      [
        "serviceability_synthesis",
        row("FAILED_TERMINAL", {
          attemptCount: 3,
          lastErrorCategory: "RETRYABLE_TECHNICAL",
          lastErrorCode: "ATTEMPT_EXHAUSTED",
        }),
      ],
    ]);
    const findFirst = vi.fn(
      async ({ where }: { where: { processorId: string } }) =>
        rows.get(where.processorId) ?? null,
    );
    const service = new ProcessorRuntimeProjectionService({
      intelligenceSubject: {
        findUnique: async () => ({ id: "brand-subject" }),
      },
      intelligenceProcessorExecution: { findFirst },
    } as unknown as PrismaService);
    const projection = await service.read("brand", [
      current("communication_profile"),
      current("differentiation_and_proof"),
      current("serviceability_profile"),
    ]);

    expect(Object.keys(projection)).toEqual(BRAND_PROCESSOR_IDS);
    expect(findFirst).toHaveBeenCalledTimes(7);
    expect(
      findFirst.mock.calls.map(([query]) => query.where.processorId),
    ).not.toContain("synthetic_test_processor");
    expect(projection.brand_communication).toMatchObject({
      activity: "IDLE",
      hasCurrent: true,
    });
    expect(projection.brand_meaning.activity).toBe("READY_TO_RUN");
    expect(projection.brand_character.activity).toBe("LEARNING");
    expect(projection.brand_character.readiness).toBe("UNKNOWN");
    expect(projection.audience_persona_synthesis).toMatchObject({
      activity: "WAITING_FOR_DEPENDENCY",
      readiness: "WAITING_FOR_DEPENDENCY",
    });
    expect(projection.brand_differentiation).toMatchObject({
      activity: "REFRESHING",
      refreshing: true,
      hasCurrent: true,
    });
    expect(projection.visual_style_synthesis).toMatchObject({
      activity: "WAITING_FOR_EVIDENCE",
      readiness: "WAITING_FOR_EVIDENCE",
    });
    expect(projection.serviceability_synthesis.failure).toEqual({
      category: "RETRYABLE_TECHNICAL",
      code: "ATTEMPT_EXHAUSTED",
      currentPreserved: true,
      retryEligible: false,
    });
    expect(projection.serviceability_synthesis.readiness).toBe("UNKNOWN");
    expect(aggregateProcessorRuntime(projection)).toBe("LEARNING");
  });

  it("keeps one terminal failure non-catastrophic and identifies a scheduled retry", async () => {
    const rows = new Map<string, Row | null>([
      [
        "brand_communication",
        row("FAILED_TERMINAL", {
          lastErrorCategory: "VALIDATION_FAILURE",
          lastErrorCode: "STRUCTURED_OUTPUT_INVALID",
        }),
      ],
      [
        "brand_meaning",
        row("QUEUED", {
          attemptCount: 1,
          lastErrorCategory: "RETRYABLE_TECHNICAL",
          lastErrorCode: "RATE_LIMITED",
        }),
      ],
    ]);
    const service = new ProcessorRuntimeProjectionService({
      intelligenceSubject: {
        findUnique: async () => ({ id: "brand-subject" }),
      },
      intelligenceProcessorExecution: {
        findFirst: async ({ where }: { where: { processorId: string } }) =>
          rows.get(where.processorId) ?? null,
      },
    } as unknown as PrismaService);
    const projection = await service.read("brand", [
      current("brand_description"),
    ]);

    expect(projection.brand_communication.activity).toBe(
      "TEMPORARILY_UNAVAILABLE",
    );
    expect(projection.brand_meaning).toMatchObject({
      activity: "RETRY_SCHEDULED",
      failure: { retryEligible: true, currentPreserved: true },
    });
    expect(aggregateProcessorRuntime(projection)).toBe("NONE");
  });
});
