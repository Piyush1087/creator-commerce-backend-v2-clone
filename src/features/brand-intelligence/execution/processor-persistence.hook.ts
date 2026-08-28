import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type {
  ClaimedProcessorWork,
  ProcessorExecutionResult,
} from "./domain/intelligence-execution.types";

export const PROCESSOR_SUCCESS_PERSISTENCE_HOOK = Symbol(
  "PROCESSOR_SUCCESS_PERSISTENCE_HOOK",
);

export interface ProcessorSuccessPersistenceHook {
  persistBeforeCompletion(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
  ): Promise<void>;
}

@Injectable()
export class NoopProcessorSuccessPersistenceHook implements ProcessorSuccessPersistenceHook {
  async persistBeforeCompletion(): Promise<void> {
    // W1.1/W1.2 will persist validated generations inside this transaction.
  }
}
