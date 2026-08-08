import type { CompilerRequest, ExecutionTask, TaskResult } from "../compiler/compiler";

export type ExecutionTelemetryRecord = {
  execution_id: string;
  profile_id: string;
  entity_type: string;
  entity_id: string;
  website_url: string;
  persist_results: boolean;
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  state?: string;
};

export type ProcessorTelemetryRecord = {
  processor_execution_id: string;
  execution_id: string;
  task_id: string;
  processor_id: string;
  processor_scope?: string;
  kind: ExecutionTask["kind"];
  active_outputs: string[];
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  state?: TaskResult["state"];
  model_profile?: string;
  model_id?: string;
  provider?: string;
  prompt_build_id?: string;
  evidence_refs?: string[];
  artifact_versions?: Record<string,string>;
  provider_latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  validation_stage?: string;
  error_code?: string;
  error_message?: string;
  persistence_skipped?: boolean;
};

export interface TelemetrySink {
  writeExecution(record: ExecutionTelemetryRecord): Promise<void>;
  writeProcessor(record: ProcessorTelemetryRecord): Promise<void>;
}

export type ExecutionStartArgs = { profileId:string; request:CompilerRequest };
