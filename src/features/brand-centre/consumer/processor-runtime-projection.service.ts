import { Injectable } from "@nestjs/common";
import type { IntelligenceProcessorExecutionStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { CurrentIntelligenceObjectProjection } from "../../brand-intelligence/projection/intelligence-current-projection.types";
import type { ConsumerRuntimeActivity } from "./brand-consumer.types";
import {
  BRAND_PROCESSOR_IDS,
  BRAND_PROCESSOR_OBJECT_OWNERSHIP,
  type BrandProcessorId,
  type BrandProcessorRuntimeProjection,
  type ProcessorExecutionReadiness,
  type ProcessorRuntimeActivity,
  type ProcessorRuntimeProjection,
} from "./processor-runtime-projection.types";

const executionSelect = {
  status: true,
  attemptCount: true,
  maxAttempts: true,
  lastErrorCategory: true,
  lastErrorCode: true,
  createdAt: true,
  id: true,
} as const;

type LatestExecution = Readonly<{
  status: IntelligenceProcessorExecutionStatus;
  attemptCount: number;
  maxAttempts: number;
  lastErrorCategory: string | null;
  lastErrorCode: string | null;
}>;

export function aggregateProcessorRuntime(
  projection: BrandProcessorRuntimeProjection,
): ConsumerRuntimeActivity {
  const states = BRAND_PROCESSOR_IDS.map(
    (processorId) => projection[processorId].activity,
  );
  if (states.includes("LEARNING")) return "LEARNING";
  if (states.includes("REFRESHING")) return "REFRESHING";
  return states.every((activity) => activity === "TEMPORARILY_UNAVAILABLE")
    ? "TEMPORARILY_UNAVAILABLE"
    : "NONE";
}

@Injectable()
export class ProcessorRuntimeProjectionService {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    brandId: string,
    objects: readonly CurrentIntelligenceObjectProjection[],
  ): Promise<BrandProcessorRuntimeProjection> {
    const currentObjects = new Set(
      objects
        .filter((object) => object.objectState !== "NO_CURRENT")
        .map((object) => object.objectSemanticId),
    );
    const latest = await Promise.all(
      BRAND_PROCESSOR_IDS.map((processorId) =>
        this.prisma.intelligenceProcessorExecution.findFirst({
          where: { brandId, processorId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: executionSelect,
        }),
      ),
    );
    return Object.fromEntries(
      BRAND_PROCESSOR_IDS.map((processorId, index) => {
        const hasCurrent = BRAND_PROCESSOR_OBJECT_OWNERSHIP[processorId].some(
          (objectSemanticId) => currentObjects.has(objectSemanticId),
        );
        return [
          processorId,
          this.project(processorId, latest[index], hasCurrent),
        ];
      }),
    ) as BrandProcessorRuntimeProjection;
  }

  private project(
    processorId: BrandProcessorId,
    execution: LatestExecution | null,
    hasCurrent: boolean,
  ): ProcessorRuntimeProjection {
    const activity = this.activity(execution, hasCurrent);
    const retryEligible =
      execution?.status === "QUEUED" &&
      execution.attemptCount > 0 &&
      execution.attemptCount < execution.maxAttempts;
    return {
      processorId,
      activity,
      readiness: this.readiness(execution),
      latestExecutionStatus: execution?.status ?? null,
      reasonCode: execution?.lastErrorCode ?? null,
      hasCurrent,
      refreshing: activity === "REFRESHING",
      failure:
        execution?.lastErrorCode &&
        (execution.status === "FAILED_TERMINAL" || retryEligible)
          ? {
              category: execution.lastErrorCategory,
              code: execution.lastErrorCode,
              currentPreserved: hasCurrent,
              retryEligible,
            }
          : null,
    };
  }

  private activity(
    execution: LatestExecution | null,
    hasCurrent: boolean,
  ): ProcessorRuntimeActivity {
    if (!execution) return "IDLE";
    switch (execution.status) {
      case "WAITING_FOR_DEPENDENCY":
        return execution.lastErrorCode === "WAITING_FOR_EVIDENCE"
          ? "WAITING_FOR_EVIDENCE"
          : "WAITING_FOR_DEPENDENCY";
      case "QUEUED":
        return execution.attemptCount === 0
          ? "READY_TO_RUN"
          : "RETRY_SCHEDULED";
      case "RUNNING":
        return hasCurrent ? "REFRESHING" : "LEARNING";
      case "FAILED_TERMINAL":
        return "TEMPORARILY_UNAVAILABLE";
      case "COMPLETED":
      case "CANCELLED":
        return "IDLE";
    }
  }

  private readiness(
    execution: LatestExecution | null,
  ): ProcessorExecutionReadiness {
    if (!execution) return "UNKNOWN";
    switch (execution.status) {
      case "WAITING_FOR_DEPENDENCY":
        return execution.lastErrorCode === "WAITING_FOR_EVIDENCE"
          ? "WAITING_FOR_EVIDENCE"
          : "WAITING_FOR_DEPENDENCY";
      case "QUEUED":
        return "READY_TO_RUN";
      case "RUNNING":
      case "COMPLETED":
      case "FAILED_TERMINAL":
      case "CANCELLED":
        return "UNKNOWN";
    }
  }
}
