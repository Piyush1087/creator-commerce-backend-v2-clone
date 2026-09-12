import { Injectable } from "@nestjs/common";
import { IntelligenceProcessorExecutionStatus } from "@prisma/client";
import { z } from "zod";

import { IntelligenceExecutionService } from "../../brand-intelligence/execution/intelligence-execution.service";
import { ProcessorWorkerService } from "../../brand-intelligence/execution/processor-worker.service";
import {
  INSTAGRAM_C4_PROCESSORS,
  InstagramC4EvidenceManifestSchema,
  instagramC4Paths,
  instagramC4RegistryKey,
} from "./instagram-c4.contract";

const inputSchema = InstagramC4EvidenceManifestSchema.extend({
  triggerIdempotencyKey: z.string().min(1).max(255),
  correlationRef: z.string().min(1).max(255),
}).strict();

@Injectable()
export class InstagramC4RuntimeService {
  constructor(
    private readonly executions: IntelligenceExecutionService,
    private readonly worker: ProcessorWorkerService,
  ) {}

  async execute(input: z.input<typeof inputSchema>) {
    const parsed = inputSchema.parse(input);
    const evidenceManifest = {
      kind: parsed.kind,
      brandProfileId: parsed.brandProfileId,
      integrationId: parsed.integrationId,
      providerAccountId: parsed.providerAccountId,
      authorizationGeneration: parsed.authorizationGeneration,
      windowEnd: parsed.windowEnd,
    };
    const outcomes: Array<{
      processorId: string;
      processorExecutionId: string;
      status: IntelligenceProcessorExecutionStatus;
      replayed: boolean;
    }> = [];
    for (const definition of INSTAGRAM_C4_PROCESSORS) {
      const paths = instagramC4Paths(definition.objectId);
      const created = await this.executions.createOrReturn({
        brandId: parsed.brandProfileId,
        subject: { type: "BRAND" },
        triggerType: "INSTAGRAM_C4_INTERNAL",
        triggerRef: `${parsed.correlationRef}:${definition.processorId}`,
        triggerIdempotencyKey: `${parsed.triggerIdempotencyKey}:${definition.processorId}`,
        correlationRef: parsed.correlationRef,
        requestedImpact: {
          sourceScope: "INSTAGRAM_OWNED",
          objectSemanticId: definition.objectId,
          componentSemanticPath: "$",
        },
        processors: [
          {
            registryKey: instagramC4RegistryKey(definition.processorId),
            activeScope: paths.map((componentSemanticPath) => ({
              brandId: parsed.brandProfileId,
              objectSemanticId: definition.objectId,
              pathSchemeVersion: 1,
              componentSemanticPath,
            })),
            dependencyManifest: {
              sourceScope: "INSTAGRAM_OWNED",
              integrationId: parsed.integrationId,
              providerAccountId: parsed.providerAccountId,
              authorizationGeneration: parsed.authorizationGeneration,
            },
            evidenceManifest,
            executionIntentKey: `${parsed.triggerIdempotencyKey}:${definition.processorId}`,
            maxAttempts: 1,
            dependencyEligible: true,
          },
        ],
      });
      const processor = created.processorExecutions[0];
      if (!processor) throw new Error("C4 processor execution was not created");
      if (
        processor.status === IntelligenceProcessorExecutionStatus.COMPLETED ||
        processor.status ===
          IntelligenceProcessorExecutionStatus.FAILED_TERMINAL
      ) {
        outcomes.push({
          processorId: definition.processorId,
          processorExecutionId: processor.id,
          status: processor.status,
          replayed: true,
        });
        continue;
      }
      const completed = await this.worker.runExact(
        processor.id,
        `instagram-c4:${definition.processorId}:${parsed.correlationRef}`,
        30_000,
      );
      outcomes.push({
        processorId: definition.processorId,
        processorExecutionId: completed.processorExecution.id,
        status: completed.processorExecution.status,
        replayed: created.replayed,
      });
    }
    return outcomes;
  }
}
