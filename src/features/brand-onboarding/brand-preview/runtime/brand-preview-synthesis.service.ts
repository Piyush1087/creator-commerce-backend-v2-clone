import { Injectable } from "@nestjs/common";

import {
  StructuredEvidenceExecutionError,
  StructuredEvidenceExecutionService,
} from "../../../data-extraction/services/structured-evidence-execution.service";
import {
  executeProfile,
  type CompilerRuntime,
  type TaskResult,
} from "../../../../intelligence/runtime/compiler/compiler";
import {
  BrandPreviewSynthesisSchema,
  type BrandPreviewSynthesis,
} from "../../../../intelligence/runtime/validation/brand-preview.validation";
import type {
  BrandPreviewEvidence,
  PublicWebEnrichment,
} from "../brand-preview.types";
import { BrandPreviewArtifactLoader } from "./brand-preview-artifact.loader";
import { BrandPreviewPromptService } from "./brand-preview-prompt.service";

type ResolvedRuntime = {
  model_profile: string;
  provider_adapter?: string;
  model_id: string;
  runtime: Record<string, unknown>;
};

export class BrandPreviewSynthesisTechnicalError extends Error {
  constructor(readonly metadata: Record<string, unknown>) {
    super("SYNTHESIS_TECHNICAL_EXHAUSTED");
    this.name = "BrandPreviewSynthesisTechnicalError";
  }
}

@Injectable()
export class BrandPreviewSynthesisService {
  constructor(
    private readonly artifacts: BrandPreviewArtifactLoader,
    private readonly prompts: BrandPreviewPromptService,
    private readonly structuredExecution: StructuredEvidenceExecutionService,
  ) {}

  async synthesize(args: {
    runId: string;
    brandName: string;
    websiteUrl: string;
    confirmedIndustry: string;
    evidence: BrandPreviewEvidence;
    enrichment?: PublicWebEnrichment;
  }): Promise<{
    output: BrandPreviewSynthesis;
    metadata: Record<string, unknown>;
  }> {
    const [prompt, frozenProfile] = await Promise.all([
      this.prompts.build({ executionId: args.runId, ...args }),
      this.artifacts.loadExecutionProfile(),
    ]);
    const synthesisStage = frozenProfile.stages.find(
      (stage) => stage.id === "synthesize_preview",
    );
    if (synthesisStage?.processor_id !== "brand_preview_synthesis") {
      throw new Error("BRAND_PREVIEW_EXECUTION_PROFILE_INVALID");
    }
    let executionMetadata: Record<string, unknown> = {};
    const runtime: CompilerRuntime = {
      runDeterministicTask: async ({ task }) => ({
        taskId: task.id,
        state: "FAILED_PRECHECK",
        error: { code: "UNSUPPORTED_TASK", message: "AI task required" },
      }),
      runAiTask: async ({ task }): Promise<TaskResult> => {
        const primary =
          (await this.artifacts.resolvePrimaryModel()) as ResolvedRuntime;
        let primaryAttempts = 0;
        try {
          const result = await this.executeProvider(
            primary,
            args.runId,
            prompt,
          );
          executionMetadata = this.metadata(
            primary,
            result.telemetry.attemptCount,
            false,
            prompt,
            frozenProfile.version,
            0,
          );
          return {
            taskId: task.id,
            state: "SUCCEEDED",
            values: { output: result.payload },
          };
        } catch (primaryError) {
          primaryAttempts =
            primaryError instanceof StructuredEvidenceExecutionError
              ? primaryError.attemptCount
              : 0;
          const fallback =
            (await this.artifacts.resolveFallbackModel()) as ResolvedRuntime;
          try {
            const result = await this.executeProvider(
              fallback,
              args.runId,
              prompt,
            );
            executionMetadata = this.metadata(
              fallback,
              result.telemetry.attemptCount,
              true,
              prompt,
              frozenProfile.version,
              primaryAttempts,
            );
            return {
              taskId: task.id,
              state: "SUCCEEDED",
              values: { output: result.payload },
            };
          } catch (fallbackError) {
            const fallbackAttempts =
              fallbackError instanceof StructuredEvidenceExecutionError
                ? fallbackError.attemptCount
                : 0;
            executionMetadata = {
              processor_id: "brand_preview_synthesis",
              execution_profile: `brand_preview_fast@${frozenProfile.version}`,
              primary_model_profile: primary.model_profile,
              fallback_model_profile: fallback.model_profile,
              primary_attempt_count: primaryAttempts,
              fallback_attempt_count: fallbackAttempts,
              technical_retry_count: Math.max(0, primaryAttempts - 1),
              technical_fallback_used: true,
              terminal: "TECHNICAL_EXHAUSTED",
              prompt_build_id: prompt.promptBuildId,
            };
            return {
              taskId: task.id,
              state: "FAILED_PROVIDER",
              error: {
                code: "SYNTHESIS_TECHNICAL_EXHAUSTED",
                message:
                  fallbackError instanceof Error
                    ? fallbackError.message
                    : primaryError instanceof Error
                      ? primaryError.message
                      : "Synthesis provider chain exhausted",
              },
            };
          }
        }
      },
    };
    const compiled = await executeProfile(
      args.runId,
      {
        id: frozenProfile.id,
        persistResultsDefault: false,
        tasks: [
          {
            id: "synthesize_preview",
            processorId: synthesisStage.processor_id,
            kind: "AI",
            activeOutputs: ["output"],
            required: true,
          },
        ],
      },
      {
        entityType: "DiscoveryLead",
        entityId: args.runId,
        websiteUrl: args.websiteUrl,
      },
      runtime,
    );
    const output = compiled.validatedOutputs.output;
    const validated = BrandPreviewSynthesisSchema.safeParse(output);
    if (compiled.state !== "SUCCEEDED" || !validated.success) {
      throw new BrandPreviewSynthesisTechnicalError(executionMetadata);
    }
    return { output: validated.data, metadata: executionMetadata };
  }

  private executeProvider(
    runtime: ResolvedRuntime,
    runId: string,
    prompt: Awaited<ReturnType<BrandPreviewPromptService["build"]>>,
  ) {
    const timeoutMs = Number(runtime.runtime.timeout_ms ?? 30_000);
    const maxAttempts = Number(runtime.runtime.max_attempts ?? 1);
    const common = {
      acquisitionRunId: runId,
      capabilityId: "brand_preview.synthesis",
      modelId: runtime.model_id,
      instruction: prompt.instruction,
      approvedEvidenceContext: { evidence_refs: prompt.evidenceRefs },
      evidenceRefs: prompt.evidenceRefs,
      outputSchema: BrandPreviewSynthesisSchema,
      timeoutMs,
      maxAttempts,
    };
    return this.structuredExecution.execute({
      ...common,
      providerAdapter: runtime.provider_adapter,
      schemaName: "brand_preview_synthesis",
    });
  }

  private metadata(
    runtime: ResolvedRuntime,
    attemptCount: number,
    fallbackUsed: boolean,
    prompt: Awaited<ReturnType<BrandPreviewPromptService["build"]>>,
    executionProfileVersion: string,
    primaryAttempts: number,
  ) {
    return {
      processor_id: "brand_preview_synthesis",
      execution_profile: `brand_preview_fast@${executionProfileVersion}`,
      model_profile: runtime.model_profile,
      resolved_model: runtime.model_id,
      provider_adapter: runtime.provider_adapter,
      attempt_count: attemptCount,
      primary_attempt_count: primaryAttempts || attemptCount,
      fallback_attempt_count: fallbackUsed ? attemptCount : 0,
      technical_retry_count: Math.max(0, (primaryAttempts || attemptCount) - 1),
      technical_fallback_used: fallbackUsed,
      prompt_build_id: prompt.promptBuildId,
      artifact_versions: prompt.artifactVersions,
    };
  }
}
