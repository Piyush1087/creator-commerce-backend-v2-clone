import { randomUUID } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  executeProfile,
  type CompilerRuntime,
  type TaskResult,
} from "../../../../intelligence/runtime/compiler/compiler";
import {
  DataExtractionProviderError,
  type EvidenceProvenance,
  type ProviderTelemetry,
} from "../../../data-extraction/contracts/provider-execution.contract";
import {
  GATEKEEPER_CAPABILITY_PORT,
  type GatekeeperCapabilityPort,
} from "./gatekeeper-capability.port";
import { GatekeeperArtifactLoader } from "./gatekeeper-artifact.loader";
import { GatekeeperPromptService } from "./gatekeeper-prompt.service";
import {
  type GatekeeperTelemetryPort,
  GatekeeperTelemetryService,
} from "./gatekeeper-telemetry.service";
import { validateGatekeeperAssessmentSemantics } from "../gatekeeper-semantic-validation";
import {
  GatekeeperSiteAssessmentSchema,
  type GatekeeperSiteAssessmentPayload,
} from "../gatekeeper-site-assessment.schema";
import type {
  GatekeeperExecutionTrace,
  GatekeeperSiteAssessment,
  GatekeeperStageState,
} from "../gatekeeper-v1.types";

const CAPABILITIES = {
  primary: "gatekeeper_primary_web_assessment",
  parallel: "company_public_web_research",
  openai: "openai_structured_assessment",
} as const;

type StageResult = {
  assessment: GatekeeperSiteAssessment | null;
  state: Exclude<GatekeeperStageState, "NOT_RUN" | "FAILED_PRECHECK">;
  admissionCriticalUncertainty: boolean;
  evidenceRefs: string[];
  telemetry?: ProviderTelemetry;
  promptBuildId?: string;
  errorCode?: string;
  providerStatusCode?: number;
  providerMessage?: string;
};

export type GatekeeperAssessmentExecution = {
  assessment: GatekeeperSiteAssessment | null;
  exhaustedTechnicalFailure: boolean;
  unresolvedSemanticUncertainty: boolean;
  execution: GatekeeperExecutionTrace;
};

function evidenceRefs(provenance: EvidenceProvenance[]): string[] {
  return provenance.map(
    (item) => item.providerReference ?? item.sourceUrl ?? item.type,
  );
}

@Injectable()
export class GatekeeperRuntimeOrchestratorService {
  private readonly logger = new Logger(GatekeeperRuntimeOrchestratorService.name);
  private readonly telemetry: GatekeeperTelemetryPort;

  constructor(
    @Inject(GATEKEEPER_CAPABILITY_PORT)
    private readonly capabilities: GatekeeperCapabilityPort,
    private readonly artifacts: GatekeeperArtifactLoader,
    private readonly prompts: GatekeeperPromptService,
    private readonly config: ConfigService,
    telemetry: GatekeeperTelemetryService,
  ) {
    this.telemetry = telemetry;
  }

  async execute(args: {
    normalizedUrl: string;
    normalizedDomain: string;
  }): Promise<GatekeeperAssessmentExecution> {
    const executionId = randomUUID();
    const execution: GatekeeperExecutionTrace = {
      primary: "NOT_RUN",
      parallel: "NOT_RUN",
      reassessment: "NOT_RUN",
      openai: "NOT_RUN",
    };
    this.telemetry.record({
      event: "gatekeeper.execution",
      executionId,
      fallbackStage: "START",
    });

    await this.assertCanonicalProfile();
    const environment = this.runtimeEnvironment();
    const model = await this.artifacts.resolvePrimaryModel(environment);

    const primary = await this.runAssessment({
      executionId,
      stage: "primary",
      modelId: model.model_id,
      normalizedUrl: args.normalizedUrl,
      normalizedDomain: args.normalizedDomain,
      evidence: {
        normalized_url: args.normalizedUrl,
        normalized_domain: args.normalizedDomain,
        evidence_mode: "OWNED_DOMAIN_AND_PUBLIC_WEB_SEARCH",
      },
      evidenceRefs: [],
    });
    execution.primary = primary.state;
    if (!primary.admissionCriticalUncertainty && primary.assessment) {
      return this.finish(executionId, primary.assessment, execution);
    }

    const research = await this.runParallelResearch({
      executionId,
      normalizedUrl: args.normalizedUrl,
      normalizedDomain: args.normalizedDomain,
      priorAssessment: primary.assessment,
    });
    execution.parallel = research.state;

    let latest = primary;
    let approvedEvidence: unknown = {
      primary_assessment: primary.assessment,
      parallel_public_web_research: research.evidence,
    };
    let approvedRefs = [...primary.evidenceRefs, ...research.evidenceRefs];

    if (research.state === "SUCCEEDED") {
      const reassessment = await this.runAssessment({
        executionId,
        stage: "reassessment",
        modelId: model.model_id,
        normalizedUrl: args.normalizedUrl,
        normalizedDomain: args.normalizedDomain,
        evidence: approvedEvidence,
        evidenceRefs: approvedRefs,
        priorAssessment: primary.assessment,
      });
      execution.reassessment = reassessment.state;
      latest = reassessment.assessment ? reassessment : primary;
      approvedRefs = [...approvedRefs, ...reassessment.evidenceRefs];
      approvedEvidence = {
        ...((approvedEvidence as Record<string, unknown>) ?? {}),
        canonical_reassessment: reassessment.assessment,
      };
      if (
        !reassessment.admissionCriticalUncertainty &&
        reassessment.assessment
      ) {
        return this.finish(executionId, reassessment.assessment, execution);
      }
    }

    const approvedOpenAiModel = this.config
      .get<string>("GATEKEEPER_OPENAI_MODEL_ID", "")
      .trim();
    if (!approvedOpenAiModel) {
      execution.openai = "FAILED_PRECHECK";
      this.telemetry.record({
        event: "gatekeeper.processor_execution",
        executionId,
        processorId: "gatekeeper_site_assessment",
        capabilityId: CAPABILITIES.openai,
        fallbackStage: "openai",
        terminalState: "FAILED_PRECHECK",
        errorCode: "MODEL_ID_NOT_CONFIGURED",
      });
      return this.finishUnresolved(executionId, latest.assessment, execution);
    }

    const openai = await this.runOpenAi({
      executionId,
      modelId: approvedOpenAiModel,
      normalizedUrl: args.normalizedUrl,
      normalizedDomain: args.normalizedDomain,
      approvedEvidence,
      evidenceRefs: approvedRefs,
      priorAssessment: latest.assessment,
    });
    execution.openai = openai.state;
    if (!openai.admissionCriticalUncertainty && openai.assessment) {
      return this.finish(executionId, openai.assessment, execution);
    }
    return this.finishUnresolved(
      executionId,
      openai.assessment ?? latest.assessment,
      execution,
    );
  }

  private async runAssessment(args: {
    executionId: string;
    stage: "primary" | "reassessment";
    modelId: string;
    normalizedUrl: string;
    normalizedDomain: string;
    evidence: unknown;
    evidenceRefs: string[];
    priorAssessment?: GatekeeperSiteAssessment | null;
  }): Promise<StageResult> {
    const prompt = await this.prompts.build({
      executionId: args.executionId,
      stage: args.stage,
      normalizedUrl: args.normalizedUrl,
      normalizedDomain: args.normalizedDomain,
      evidence: args.evidence,
      evidenceRefs: args.evidenceRefs,
      priorAssessment: args.priorAssessment,
    });
    let captured: StageResult | undefined;
    const runtime: CompilerRuntime = {
      runAiTask: async ({ task }): Promise<TaskResult> => {
        try {
          const result =
            await this.capabilities.primary<GatekeeperSiteAssessmentPayload>({
              acquisitionRunId: randomUUID(),
              modelId: args.modelId,
              ownedUrl: args.normalizedUrl,
              instruction: prompt.instruction,
              outputSchema: GatekeeperSiteAssessmentSchema,
            });
          const structural = GatekeeperSiteAssessmentSchema.safeParse(
            result.payload,
          );
          if (!structural.success) {
            this.logger.warn({
              msg: "gatekeeper.orchestrator.structured_output_diagnostic",
              failureKind: "ORCHESTRATOR_SCHEMA_VALIDATION",
              stage: args.stage,
              executionId: args.executionId,
              modelId: args.modelId,
              issueCount: structural.error.issues.length,
              issues: structural.error.issues.slice(0, 20).map((issue) => ({
                path: issue.path.map(String).join(".") || "(root)",
                code: issue.code,
                message: issue.message.slice(0, 160),
              })),
            });
            captured = {
              assessment: null,
              state: "TECHNICAL_FAILURE",
              admissionCriticalUncertainty: false,
              evidenceRefs: evidenceRefs(result.provenance),
              telemetry: result.telemetry,
              promptBuildId: prompt.promptBuildId,
              errorCode: "STRUCTURED_OUTPUT_INVALID",
            };
            return {
              taskId: task.id,
              state: "FAILED_VALIDATION",
              error: {
                code: "STRUCTURED_OUTPUT_INVALID",
                message: "Gatekeeper assessment failed structural validation",
              },
            };
          }
          const semantic = validateGatekeeperAssessmentSemantics(
            structural.data,
            result.qualityFlags,
          );
          captured = {
            assessment: structural.data,
            state: semantic.admissionCriticalUncertainty
              ? "SEMANTIC_UNCERTAINTY"
              : "SUCCEEDED",
            admissionCriticalUncertainty: semantic.admissionCriticalUncertainty,
            evidenceRefs: evidenceRefs(result.provenance),
            telemetry: result.telemetry,
            promptBuildId: prompt.promptBuildId,
          };
          return {
            taskId: task.id,
            state: "SUCCEEDED",
            values: structural.data,
            metadata: {
              capabilityId: result.capabilityId,
              promptBuildId: prompt.promptBuildId,
            },
          };
        } catch (error) {
          const detail =
            error instanceof DataExtractionProviderError
              ? error.detail
              : { code: "PROVIDER_ERROR", message: String(error) };
          if (
            detail.code === "STRUCTURED_OUTPUT_INVALID" ||
            detail.code === "EMPTY_RESULT"
          ) {
            this.logger.warn({
              msg: "gatekeeper.orchestrator.structured_output_diagnostic",
              failureKind: "PROVIDER_THREW",
              stage: args.stage,
              executionId: args.executionId,
              modelId: args.modelId,
              providerCode: detail.code,
              providerMessage:
                typeof detail.message === "string"
                  ? detail.message.slice(0, 200)
                  : "unknown",
            });
          }
          captured = {
            assessment: null,
            state: "TECHNICAL_FAILURE",
            admissionCriticalUncertainty: false,
            evidenceRefs: [],
            promptBuildId: prompt.promptBuildId,
            errorCode: detail.code,
            providerStatusCode:
              "providerStatusCode" in detail
                ? detail.providerStatusCode
                : undefined,
            providerMessage:
              typeof detail.message === "string"
                ? detail.message.slice(0, 400)
                : undefined,
          };
          return {
            taskId: task.id,
            state: "FAILED_PROVIDER",
            error: { code: detail.code, message: detail.message },
          };
        }
      },
      runDeterministicTask: async ({ task }) => ({
        taskId: task.id,
        state: "FAILED_PRECHECK",
        error: {
          code: "GATEKEEPER_ADAPTER_AI_ONLY",
          message: "Gatekeeper assessment adapter accepts AI tasks only",
        },
      }),
    };
    await executeProfile(
      args.executionId,
      {
        id: `gatekeeper_scan:${args.stage}`,
        persistResultsDefault: false,
        tasks: [
          {
            id: args.stage,
            processorId: "gatekeeper_site_assessment",
            kind: "AI",
            activeOutputs: Object.keys(GatekeeperSiteAssessmentSchema.shape),
          },
        ],
      },
      {
        entityType: "discovery_lead",
        entityId: args.normalizedDomain,
        websiteUrl: args.normalizedUrl,
      },
      runtime,
    );
    const resolved =
      captured ??
      ({
        assessment: null,
        state: "TECHNICAL_FAILURE",
        admissionCriticalUncertainty: false,
        evidenceRefs: [],
        errorCode: "COMPILER_STAGE_FAILED",
      } satisfies StageResult);
    this.recordStage(
      args.executionId,
      args.stage,
      CAPABILITIES.primary,
      resolved,
    );
    return resolved;
  }

  private async runParallelResearch(args: {
    executionId: string;
    normalizedUrl: string;
    normalizedDomain: string;
    priorAssessment: GatekeeperSiteAssessment | null;
  }): Promise<{
    state: "SUCCEEDED" | "TECHNICAL_FAILURE";
    evidence: unknown;
    evidenceRefs: string[];
  }> {
    try {
      const result = await this.capabilities.publicWebResearch({
        acquisitionRunId: randomUUID(),
        objective:
          "Acquire public-web evidence only for unresolved Gatekeeper admission-critical dimensions. Do not decide admission.",
        searchQueries: [
          `${args.normalizedDomain} company business industry official`,
          `${args.normalizedDomain} products services app booking commercial`,
          `${args.normalizedDomain} English company profile`,
        ],
      });
      const refs = evidenceRefs(result.provenance);
      this.telemetry.record({
        event: "gatekeeper.processor_execution",
        executionId: args.executionId,
        processorId: "gatekeeper_site_assessment",
        capabilityId: result.capabilityId,
        provider: result.telemetry.provider,
        evidenceRefs: refs,
        providerLatencyMs: result.telemetry.durationMs,
        usage: result.telemetry.usage,
        fallbackStage: "parallel",
        terminalState: "SUCCEEDED",
      });
      return {
        state: "SUCCEEDED",
        evidence: {
          prior_assessment: args.priorAssessment,
          public_web_research: result.payload,
          provenance: result.provenance,
          quality_flags: result.qualityFlags,
        },
        evidenceRefs: refs,
      };
    } catch (error) {
      const code =
        error instanceof DataExtractionProviderError
          ? error.detail.code
          : "PROVIDER_ERROR";
      this.telemetry.record({
        event: "gatekeeper.processor_execution",
        executionId: args.executionId,
        processorId: "gatekeeper_site_assessment",
        capabilityId: CAPABILITIES.parallel,
        fallbackStage: "parallel",
        terminalState: "TECHNICAL_FAILURE",
        errorCode: code,
        providerStatusCode:
          error instanceof DataExtractionProviderError
            ? error.detail.providerStatusCode
            : undefined,
        providerMessage:
          error instanceof DataExtractionProviderError
            ? error.detail.message.slice(0, 400)
            : String(error).slice(0, 400),
      });
      return { state: "TECHNICAL_FAILURE", evidence: null, evidenceRefs: [] };
    }
  }

  private async runOpenAi(args: {
    executionId: string;
    modelId: string;
    normalizedUrl: string;
    normalizedDomain: string;
    approvedEvidence: unknown;
    evidenceRefs: string[];
    priorAssessment: GatekeeperSiteAssessment | null;
  }): Promise<StageResult> {
    const prompt = await this.prompts.build({
      executionId: args.executionId,
      stage: "openai",
      normalizedUrl: args.normalizedUrl,
      normalizedDomain: args.normalizedDomain,
      evidence: args.approvedEvidence,
      evidenceRefs: args.evidenceRefs,
      priorAssessment: args.priorAssessment,
    });
    try {
      const result =
        await this.capabilities.openAi<GatekeeperSiteAssessmentPayload>({
          acquisitionRunId: randomUUID(),
          modelId: args.modelId,
          instruction: prompt.instruction,
          approvedEvidenceContext: args.approvedEvidence,
          evidenceRefs: args.evidenceRefs,
          outputSchema: GatekeeperSiteAssessmentSchema,
        });
      const assessment = GatekeeperSiteAssessmentSchema.parse(result.payload);
      const semantic = validateGatekeeperAssessmentSemantics(
        assessment,
        result.qualityFlags,
      );
      const stage: StageResult = {
        assessment,
        state: semantic.admissionCriticalUncertainty
          ? "SEMANTIC_UNCERTAINTY"
          : "SUCCEEDED",
        admissionCriticalUncertainty: semantic.admissionCriticalUncertainty,
        evidenceRefs: evidenceRefs(result.provenance),
        telemetry: result.telemetry,
        promptBuildId: prompt.promptBuildId,
      };
      this.recordStage(args.executionId, "openai", result.capabilityId, stage);
      return stage;
    } catch (error) {
      const code =
        error instanceof DataExtractionProviderError
          ? error.detail.code
          : "PROVIDER_ERROR";
      const stage: StageResult = {
        assessment: null,
        state: "TECHNICAL_FAILURE",
        admissionCriticalUncertainty: false,
        evidenceRefs: [],
        promptBuildId: prompt.promptBuildId,
        errorCode: code,
        providerStatusCode:
          error instanceof DataExtractionProviderError
            ? error.detail.providerStatusCode
            : undefined,
        providerMessage:
          error instanceof DataExtractionProviderError
            ? error.detail.message.slice(0, 400)
            : String(error).slice(0, 400),
      };
      this.recordStage(args.executionId, "openai", CAPABILITIES.openai, stage);
      return stage;
    }
  }

  private async assertCanonicalProfile(): Promise<void> {
    const profile = await this.artifacts.loadExecutionProfile();
    const capabilityIds = new Set(
      profile.stages.map((stage) => stage.requested_capability).filter(Boolean),
    );
    if (profile.id !== "gatekeeper_scan") {
      throw new Error("GATEKEEPER_PROFILE_NOT_CANONICAL");
    }
    for (const capability of Object.values(CAPABILITIES)) {
      if (!capabilityIds.has(capability)) {
        throw new Error(`GATEKEEPER_CAPABILITY_NOT_IN_PROFILE:${capability}`);
      }
    }
  }

  private runtimeEnvironment(): "development" | "test" | "production" {
    const value = this.config.get<string>("NODE_ENV", "development");
    if (value === "test" || value === "production") return value;
    return "development";
  }

  private recordStage(
    executionId: string,
    stageName: string,
    capabilityId: string,
    stage: StageResult,
  ) {
    this.telemetry.record({
      event: "gatekeeper.processor_execution",
      executionId,
      processorId: "gatekeeper_site_assessment",
      capabilityId,
      provider: stage.telemetry?.provider,
      modelId: stage.telemetry?.modelId,
      promptBuildId: stage.promptBuildId,
      evidenceRefs: stage.evidenceRefs,
      validationStage:
        stage.state === "SEMANTIC_UNCERTAINTY" ? "SEMANTIC" : "STRUCTURAL",
      providerLatencyMs: stage.telemetry?.durationMs,
      usage: stage.telemetry?.usage,
      fallbackStage: stageName,
      terminalState: stage.state,
      errorCode: stage.errorCode,
      providerStatusCode: stage.providerStatusCode,
      providerMessage: stage.providerMessage,
    });
  }

  private finish(
    executionId: string,
    assessment: GatekeeperSiteAssessment,
    execution: GatekeeperExecutionTrace,
  ): GatekeeperAssessmentExecution {
    this.telemetry.record({
      event: "gatekeeper.execution",
      executionId,
      terminalState: "SUCCEEDED",
    });
    return {
      assessment,
      exhaustedTechnicalFailure: false,
      unresolvedSemanticUncertainty: false,
      execution,
    };
  }

  private finishUnresolved(
    executionId: string,
    assessment: GatekeeperSiteAssessment | null,
    execution: GatekeeperExecutionTrace,
  ): GatekeeperAssessmentExecution {
    const exhaustedTechnicalFailure = assessment == null;
    this.telemetry.record({
      event: "gatekeeper.execution",
      executionId,
      terminalState: exhaustedTechnicalFailure
        ? "TECHNICAL_FAILURE"
        : "SEMANTIC_UNCERTAINTY",
    });
    return {
      assessment,
      exhaustedTechnicalFailure,
      unresolvedSemanticUncertainty: !exhaustedTechnicalFailure,
      execution,
    };
  }
}
