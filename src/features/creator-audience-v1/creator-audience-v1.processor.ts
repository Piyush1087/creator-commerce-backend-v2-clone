import { Injectable } from "@nestjs/common";
import { IntelligenceReadiness } from "@prisma/client";

import type { ProcessorExecutionResult } from "../brand-intelligence/execution/domain/intelligence-execution.types";
import {
  ProcessorExecutorFailure,
  type ProcessorExecutor,
  type ProcessorExecutorContext,
} from "../brand-intelligence/execution/executor/processor-executor";
import {
  AUDIENCE_V1_PROCESSOR,
  AudienceV1ManifestSchema,
  AudienceV1PayloadSchema,
  AudienceV1InputSchema,
} from "./creator-audience-v1.contract";

@Injectable()
export class AudienceV1ProcessorExecutor implements ProcessorExecutor {
  readonly processorId = AUDIENCE_V1_PROCESSOR;

  async execute(
    context: ProcessorExecutorContext,
  ): Promise<ProcessorExecutionResult> {
    const evidence = AudienceV1ManifestSchema.safeParse(
      context.processorExecution.evidenceManifest,
    );
    const input = AudienceV1InputSchema.safeParse(
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
      persistencePayload: AudienceV1PayloadSchema.parse({
        kind: "CREATOR_AUDIENCE_V1_PERSISTENCE",
        identity: evidence.data.identity,
        value: input.data.value,
        evidence: evidence.data.evidence,
      }),
    };
  }
}
