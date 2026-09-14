import { Injectable } from "@nestjs/common";
import { IntelligenceReadiness } from "@prisma/client";

import type { ProcessorExecutionResult } from "../brand-intelligence/execution/domain/intelligence-execution.types";
import {
  ProcessorExecutorFailure,
  type ProcessorExecutor,
  type ProcessorExecutorContext,
} from "../brand-intelligence/execution/executor/processor-executor";
import {
  CREATOR_AUDIENCE_PROCESSOR_ID,
  CreatorAudienceEvidenceManifestSchema,
  CreatorAudiencePersistencePayloadSchema,
  CreatorAudienceProcessorInputSchema,
} from "./creator-audience-runtime.contract";

@Injectable()
export class CreatorAudienceProcessorExecutor implements ProcessorExecutor {
  readonly processorId = CREATOR_AUDIENCE_PROCESSOR_ID;

  async execute(
    context: ProcessorExecutorContext,
  ): Promise<ProcessorExecutionResult> {
    const evidence = CreatorAudienceEvidenceManifestSchema.safeParse(
      context.processorExecution.evidenceManifest,
    );
    const input = CreatorAudienceProcessorInputSchema.safeParse(
      context.processorExecution.dependencyManifest,
    );
    if (!evidence.success || !input.success) {
      throw new ProcessorExecutorFailure({
        category: "VALIDATION_FAILURE",
        code: "CREATOR_AUDIENCE_PROCESSOR_INPUT_INVALID",
      });
    }
    await context.heartbeat();
    return {
      readiness:
        input.data.value.status === "READY"
          ? IntelligenceReadiness.READY
          : IntelligenceReadiness.PARTIAL,
      telemetry: {
        deterministic: true,
        evidenceCount: evidence.data.evidence.length,
        modelCalls: 0,
      },
      persistencePayload: CreatorAudiencePersistencePayloadSchema.parse({
        kind: "CREATOR_AUDIENCE_PERSISTENCE_V1",
        identity: evidence.data.identity,
        value: input.data.value,
        evidence: evidence.data.evidence,
      }),
    };
  }
}
