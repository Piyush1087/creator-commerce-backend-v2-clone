import type {
  IntelligenceProcessorAttempt,
  IntelligenceProcessorExecution,
} from "@prisma/client";

import type {
  ProcessorExecutionResult,
  ProcessorFailure,
} from "../domain/intelligence-execution.types";

export interface ProcessorExecutorContext {
  readonly processorExecution: IntelligenceProcessorExecution;
  readonly attempt: IntelligenceProcessorAttempt;
  readonly heartbeat: () => Promise<void>;
}

export interface ProcessorExecutor {
  readonly processorId: string;
  execute(context: ProcessorExecutorContext): Promise<ProcessorExecutionResult>;
}

export class ProcessorExecutorFailure extends Error {
  constructor(readonly failure: ProcessorFailure) {
    super(failure.code);
    this.name = "ProcessorExecutorFailure";
  }
}
