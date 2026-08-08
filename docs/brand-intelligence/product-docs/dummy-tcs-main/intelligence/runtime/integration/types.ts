import type { ExecutionProfile, CompilerRequest, TaskResult, ExecutionTask } from "../compiler/compiler";

export interface ExecutionProfileLoader { load(profileId: string): Promise<ExecutionProfile>; }
export interface DefinitionLoader {
  loadProcessor(processorId: string, scope?: string): Promise<unknown>;
  loadGlobalArtifacts(): Promise<unknown>;
  loadProcessorArtifacts(processorId: string, scope?: string): Promise<unknown>;
  loadObjects(activeOutputs: string[]): Promise<unknown[]>;
}
export interface EvidenceRuntime {
  prepareIdentityEvidence(args: { websiteUrl: string; entityId: string }): Promise<void>;
  getEvidence(args: { task: ExecutionTask; websiteUrl: string; entityId: string }): Promise<{ refs?: string[]; content: unknown }>;
}
export interface ModelRuntimeResolver { resolve(processorId: string, scope?: string): Promise<any>; }
export interface PromptBuilderPort { build(input: any): Promise<any> | any; }
export interface AiProviderPort { execute(args: { promptPackage: any; resolvedModelRuntime: any; websiteUrl: string }): Promise<{ output: unknown; metadata?: Record<string, unknown> }>; }
export type RuntimeValidationError = { code: string; message: string; validation_stage?: "STRUCTURAL"|"SEMANTIC"|"CONFIGURATION"; issues?: Array<{ path:Array<string|number>; code:string; message:string }> };
export interface OutputValidatorPort { validate(args: { task: ExecutionTask; rawOutput: unknown }): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: RuntimeValidationError }>; }
export interface PersistencePort { persist(args: { task: ExecutionTask; entityId: string; values: Record<string, unknown>; persistResults: boolean }): Promise<void>; }
export interface TelemetryPort {
  executionStarted(args: { profileId: string; request: CompilerRequest }): Promise<string>;
  taskStarted(executionId: string, task: ExecutionTask): Promise<string>;
  taskFinished(processorExecutionId: string, result: TaskResult): Promise<void>;
  executionFinished(executionId: string, result: unknown): Promise<void>;
}

export type IdentityRuntimeDependencies = {
  profiles: ExecutionProfileLoader;
  definitions: DefinitionLoader;
  evidence: EvidenceRuntime;
  models: ModelRuntimeResolver;
  prompts: PromptBuilderPort;
  provider: AiProviderPort;
  validator: OutputValidatorPort;
  persistence: PersistencePort;
  telemetry: TelemetryPort;
};
