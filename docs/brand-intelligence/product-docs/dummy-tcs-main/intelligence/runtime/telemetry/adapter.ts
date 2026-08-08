import { randomUUID } from "node:crypto";
import type { CompilerRequest, ExecutionTask, TaskResult } from "../compiler/compiler";
import type { TelemetryPort } from "../integration/types";
import type { ExecutionTelemetryRecord, ProcessorTelemetryRecord, TelemetrySink } from "./types";

const now = () => new Date().toISOString();
const elapsed = (started:string) => Math.max(0, Date.now() - new Date(started).getTime());

export class IntelligenceTelemetryAdapter implements TelemetryPort {
  private executions = new Map<string,ExecutionTelemetryRecord>();
  private processors = new Map<string,ProcessorTelemetryRecord>();

  constructor(private readonly sink: TelemetrySink) {}

  async executionStarted({profileId,request}:{profileId:string;request:CompilerRequest}) {
    const id=randomUUID();
    const record:ExecutionTelemetryRecord={execution_id:id,profile_id:profileId,entity_type:request.entityType,entity_id:request.entityId,website_url:request.websiteUrl,persist_results:request.persistResults??false,started_at:now()};
    this.executions.set(id,record); await this.sink.writeExecution(record); return id;
  }

  async taskStarted(executionId:string,task:ExecutionTask) {
    const id=randomUUID();
    const record:ProcessorTelemetryRecord={processor_execution_id:id,execution_id:executionId,task_id:task.id,processor_id:task.processorId,processor_scope:task.processorScope,kind:task.kind,active_outputs:[...task.activeOutputs],started_at:now()};
    this.processors.set(id,record); await this.sink.writeProcessor(record); return id;
  }

  async taskFinished(processorExecutionId:string,result:TaskResult) {
    const current=this.processors.get(processorExecutionId); if(!current) return;
    const m:any=result.metadata??{}; const validation:any=m.validation??{};
    const record:ProcessorTelemetryRecord={...current,finished_at:now(),duration_ms:elapsed(current.started_at),state:result.state,
      model_profile:m.model_profile,model_id:m.model_id,provider:m.provider,prompt_build_id:m.prompt_build_id,
      evidence_refs:m.evidence_refs,artifact_versions:m.artifact_versions,provider_latency_ms:m.provider_latency_ms??m.latency_ms,
      input_tokens:m.input_tokens??m.usage?.input_tokens,output_tokens:m.output_tokens??m.usage?.output_tokens,
      validation_stage:validation.validation_stage??m.validation_stage,error_code:result.error?.code,error_message:result.error?.message,
      persistence_skipped:m.persistence_skipped};
    this.processors.set(processorExecutionId,record); await this.sink.writeProcessor(record);
  }

  async executionFinished(executionId:string,result:any) {
    const current=this.executions.get(executionId); if(!current) return;
    const record:ExecutionTelemetryRecord={...current,finished_at:now(),duration_ms:elapsed(current.started_at),state:result?.state};
    this.executions.set(executionId,record); await this.sink.writeExecution(record);
  }
}
