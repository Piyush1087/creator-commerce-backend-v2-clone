import { Inject, Injectable } from "@nestjs/common";
import type { IntelligenceProcessorExecution } from "@prisma/client";

import { IntelligenceExecutionError } from "./domain/intelligence-execution.error";
import type {
  ClaimedProcessorWork,
  LeaseIdentity,
} from "./domain/intelligence-execution.types";
import {
  ProcessorExecutorFailure,
  type ProcessorExecutorContext,
} from "./executor/processor-executor";
import { ProcessorExecutorRegistry } from "./executor/processor-executor.registry";
import { ProcessorFinalizationService } from "./processor-finalization.service";
import {
  PROCESSOR_SUCCESS_PERSISTENCE_HOOK,
  type ProcessorSuccessPersistenceHook,
} from "./processor-persistence.hook";
import { ProcessorExecutionRepository } from "./processor-execution.repository";

export interface ProcessorWorkerRunResult {
  readonly claim: ClaimedProcessorWork;
  readonly processorExecution: IntelligenceProcessorExecution;
}

@Injectable()
export class ProcessorWorkerService {
  constructor(
    private readonly repository: ProcessorExecutionRepository,
    private readonly finalization: ProcessorFinalizationService,
    private readonly executors: ProcessorExecutorRegistry,
    @Inject(PROCESSOR_SUCCESS_PERSISTENCE_HOOK)
    private readonly persistenceHook: ProcessorSuccessPersistenceHook,
  ) {}

  async runOnce(
    workerIdentity: string,
    leaseDurationMs: number,
  ): Promise<ProcessorWorkerRunResult> {
    const claim = await this.repository.claimNext(
      workerIdentity,
      leaseDurationMs,
    );
    if (!claim) {
      throw new IntelligenceExecutionError(
        "NO_ELIGIBLE_WORK",
        "No queued ProcessorExecution is currently eligible",
      );
    }
    let executor;
    try {
      executor = this.executors.get(claim.processorExecution.processorId);
    } catch {
      const processorExecution = await this.finalization.fail(claim, {
        category: "CONFIGURATION_DRIFT",
        code: "EXECUTOR_REGISTRATION_MISSING",
      });
      return { claim, processorExecution };
    }

    const context: ProcessorExecutorContext = {
      processorExecution: claim.processorExecution,
      attempt: claim.attempt,
      heartbeat: async () => {
        await this.repository.heartbeat(
          this.leaseIdentity(claim),
          leaseDurationMs,
        );
      },
    };
    try {
      const result = await executor.execute(context);
      const processorExecution = await this.finalization.complete(
        claim,
        result,
        this.persistenceHook,
      );
      return { claim, processorExecution };
    } catch (error) {
      if (
        error instanceof IntelligenceExecutionError &&
        error.code === "LEASE_LOST"
      ) {
        throw error;
      }
      const failure =
        error instanceof ProcessorExecutorFailure
          ? error.failure
          : {
              category: "RETRYABLE_TECHNICAL" as const,
              code: "UNCLASSIFIED_EXECUTOR_FAILURE",
            };
      const processorExecution = await this.finalization.fail(claim, failure);
      return { claim, processorExecution };
    }
  }

  private leaseIdentity(claim: ClaimedProcessorWork): LeaseIdentity {
    return {
      processorExecutionId: claim.processorExecution.id,
      attemptId: claim.attempt.id,
      workerIdentity: claim.attempt.workerIdentityRef,
      leaseToken: claim.attempt.leaseToken,
    };
  }
}
