import { Injectable } from "@nestjs/common";

import { IntelligenceExecutionError } from "../domain/intelligence-execution.error";
import { SYNTHETIC_PROCESSOR_ID } from "../domain/intelligence-execution.types";
import type { ProcessorExecutor } from "./processor-executor";
import { SyntheticProcessorExecutor } from "./synthetic-processor.executor";

@Injectable()
export class ProcessorExecutorRegistry {
  private readonly executors: ReadonlyMap<string, ProcessorExecutor>;

  constructor(syntheticExecutor: SyntheticProcessorExecutor) {
    this.executors = new Map([[SYNTHETIC_PROCESSOR_ID, syntheticExecutor]]);
  }

  has(processorId: string): boolean {
    return this.executors.has(processorId);
  }

  get(processorId: string): ProcessorExecutor {
    const executor = this.executors.get(processorId);
    if (!executor) {
      throw new IntelligenceExecutionError(
        "CONFIGURATION_DRIFT",
        "No compiled executor is registered for this processor",
      );
    }
    return executor;
  }

  registeredProcessorIds(): readonly string[] {
    return [...this.executors.keys()];
  }
}
