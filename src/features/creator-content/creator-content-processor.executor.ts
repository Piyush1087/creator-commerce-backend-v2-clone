import { Injectable } from "@nestjs/common";
import { IntelligenceReadiness } from "@prisma/client";
import type { ProcessorExecutionResult } from "../brand-intelligence/execution/domain/intelligence-execution.types";
import {
  ProcessorExecutorFailure,
  type ProcessorExecutor,
  type ProcessorExecutorContext,
} from "../brand-intelligence/execution/executor/processor-executor";
import {
  CREATOR_CONTENT_PROCESSOR_ID,
  CreatorContentEvidenceManifestSchema,
  CreatorContentPersistencePayloadSchema,
  CreatorContentProcessorInputSchema,
} from "./creator-content-runtime.contract";

@Injectable()
export class CreatorContentProcessorExecutor implements ProcessorExecutor {
  readonly processorId = CREATOR_CONTENT_PROCESSOR_ID;
  async execute(
    context: ProcessorExecutorContext,
  ): Promise<ProcessorExecutionResult> {
    const evidence = CreatorContentEvidenceManifestSchema.safeParse(
      context.processorExecution.evidenceManifest,
    );
    const input = CreatorContentProcessorInputSchema.safeParse(
      context.processorExecution.dependencyManifest,
    );
    if (!evidence.success || !input.success)
      throw new ProcessorExecutorFailure({
        category: "VALIDATION_FAILURE",
        code: "CREATOR_CONTENT_PROCESSOR_INPUT_INVALID",
      });
    await context.heartbeat();
    return {
      readiness:
        input.data.value.status === "READY"
          ? IntelligenceReadiness.READY
          : IntelligenceReadiness.PARTIAL,
      telemetry: {
        deterministic: true,
        evidenceCount: evidence.data.evidence.length,
        modelCalls: input.data.value.snapshot.media.filter(
          (item) => item.semanticState !== "UNKNOWN",
        ).length,
      },
      persistencePayload: CreatorContentPersistencePayloadSchema.parse({
        kind: "CREATOR_CONTENT_PERSISTENCE_V1",
        identity: evidence.data.identity,
        value: input.data.value,
        evidence: evidence.data.evidence,
      }),
    };
  }
}
