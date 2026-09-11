import { Injectable } from "@nestjs/common";
import { IntelligenceProcessorExecutionStatus } from "@prisma/client";
import { z } from "zod";

import { IntelligenceExecutionService } from "../../brand-intelligence/execution/intelligence-execution.service";
import { ProcessorWorkerService } from "../../brand-intelligence/execution/processor-worker.service";
import {
  INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
  INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY,
  InstagramContentBehaviorEvidenceManifestSchema,
} from "./instagram-content-behavior.contract";

const runtimeInputSchema =
  InstagramContentBehaviorEvidenceManifestSchema.extend({
    triggerIdempotencyKey: z.string().min(1).max(255),
    correlationRef: z.string().min(1).max(255),
  }).strict();

@Injectable()
export class InstagramContentBehaviorRuntimeService {
  constructor(
    private readonly executions: IntelligenceExecutionService,
    private readonly worker: ProcessorWorkerService,
  ) {}

  async execute(input: z.input<typeof runtimeInputSchema>) {
    const parsed = runtimeInputSchema.parse(input);
    const evidenceManifest = {
      kind: parsed.kind,
      brandProfileId: parsed.brandProfileId,
      integrationId: parsed.integrationId,
      providerAccountId: parsed.providerAccountId,
      authorizationGeneration: parsed.authorizationGeneration,
      evidenceRef: parsed.evidenceRef,
      windowEnd: parsed.windowEnd,
    };
    const created = await this.executions.createOrReturn({
      brandId: parsed.brandProfileId,
      subject: { type: "BRAND" },
      triggerType: "INSTAGRAM_B4_DIRECT_INTERNAL",
      triggerRef: parsed.evidenceRef,
      triggerIdempotencyKey: parsed.triggerIdempotencyKey,
      correlationRef: parsed.correlationRef,
      requestedImpact: {
        sourceScope: "INSTAGRAM_OWNED",
        objectSemanticId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
        componentSemanticPath: "$",
      },
      processors: [
        {
          registryKey: INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY,
          activeScope: [
            {
              brandId: parsed.brandProfileId,
              objectSemanticId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
              pathSchemeVersion: 1,
              componentSemanticPath: "$",
            },
          ],
          dependencyManifest: {
            sourceScope: "INSTAGRAM_OWNED",
            integrationId: parsed.integrationId,
            providerAccountId: parsed.providerAccountId,
            authorizationGeneration: parsed.authorizationGeneration,
          },
          evidenceManifest,
          executionIntentKey: parsed.triggerIdempotencyKey,
          maxAttempts: 1,
          dependencyEligible: true,
        },
      ],
    });
    const processor = created.processorExecutions[0];
    if (!processor) throw new Error("B4 processor execution was not created");
    if (
      processor.status === IntelligenceProcessorExecutionStatus.COMPLETED ||
      processor.status === IntelligenceProcessorExecutionStatus.FAILED_TERMINAL
    ) {
      return {
        executionId: created.execution.id,
        processorExecutionId: processor.id,
        processorStatus: processor.status,
        replayed: true,
      };
    }
    const completed = await this.worker.runExact(
      processor.id,
      `instagram-b4:${parsed.correlationRef}`,
      30_000,
    );
    return {
      executionId: created.execution.id,
      processorExecutionId: completed.processorExecution.id,
      processorStatus: completed.processorExecution.status,
      attemptId: completed.claim.attempt.id,
      replayed: created.replayed,
    };
  }
}
