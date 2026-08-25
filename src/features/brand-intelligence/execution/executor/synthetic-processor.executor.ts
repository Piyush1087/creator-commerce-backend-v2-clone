import { Injectable } from "@nestjs/common";
import { IntelligenceReadiness } from "@prisma/client";

import {
  SYNTHETIC_PROCESSOR_ID,
  type ProcessorExecutionResult,
  type SyntheticProcessorScenario,
} from "../domain/intelligence-execution.types";
import {
  ProcessorExecutorFailure,
  type ProcessorExecutor,
  type ProcessorExecutorContext,
} from "./processor-executor";

function scenarioFrom(intent: string): SyntheticProcessorScenario {
  const scenario = intent.split(":", 3)[1] as SyntheticProcessorScenario;
  const supported: readonly SyntheticProcessorScenario[] = [
    "SUCCEED_READY",
    "SUCCEED_PARTIAL",
    "SUCCEED_NOT_READY",
    "FAIL_RETRYABLE",
    "FAIL_TERMINAL",
    "WAIT_DEPENDENCY",
    "HANG_UNTIL_LEASE_EXPIRES",
    "INTERNAL_RETRY_THEN_SUCCESS",
  ];
  if (!supported.includes(scenario)) {
    throw new ProcessorExecutorFailure({
      category: "CONFIGURATION_DRIFT",
      code: "UNKNOWN_SYNTHETIC_SCENARIO",
    });
  }
  return scenario;
}

@Injectable()
export class SyntheticProcessorExecutor implements ProcessorExecutor {
  readonly processorId = SYNTHETIC_PROCESSOR_ID;

  async execute(
    context: ProcessorExecutorContext,
  ): Promise<ProcessorExecutionResult> {
    const scenario = scenarioFrom(context.processorExecution.triggerIntentKey);
    switch (scenario) {
      case "SUCCEED_READY":
        return { readiness: IntelligenceReadiness.READY };
      case "SUCCEED_PARTIAL":
        return { readiness: IntelligenceReadiness.PARTIAL };
      case "SUCCEED_NOT_READY":
        return { readiness: IntelligenceReadiness.NOT_READY };
      case "FAIL_RETRYABLE":
        throw new ProcessorExecutorFailure({
          category: "RETRYABLE_TECHNICAL",
          code: "SYNTHETIC_RETRYABLE",
        });
      case "FAIL_TERMINAL":
        throw new ProcessorExecutorFailure({
          category: "VALIDATION_FAILURE",
          code: "SYNTHETIC_TERMINAL",
        });
      case "WAIT_DEPENDENCY":
        throw new ProcessorExecutorFailure({
          category: "DEPENDENCY_UNAVAILABLE",
          code: "SYNTHETIC_DEPENDENCY_UNAVAILABLE",
        });
      case "INTERNAL_RETRY_THEN_SUCCESS": {
        let internalSubcallCount = 0;
        while (internalSubcallCount < 2) internalSubcallCount += 1;
        return {
          readiness: IntelligenceReadiness.READY,
          telemetry: { internalSubcallCount, internalRetries: 1 },
        };
      }
      case "HANG_UNTIL_LEASE_EXPIRES":
        return new Promise<never>(() => undefined);
    }
  }
}
