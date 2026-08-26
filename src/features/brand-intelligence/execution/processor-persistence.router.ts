import { Injectable, Optional } from "@nestjs/common";
import { BrandCharacterPersistenceHook } from "../processors/brand-character/brand-character-persistence.hook";
import { AudiencePersonaPersistenceHook } from "../processors/audience-persona/audience-persona-persistence.hook";
import type { Prisma } from "@prisma/client";
import { BrandCommunicationPersistenceHook } from "../processors/brand-communication/brand-communication-persistence.hook";
import { BrandMeaningPersistenceHook } from "../processors/brand-meaning/brand-meaning-persistence.hook";
import type {
  ClaimedProcessorWork,
  ProcessorExecutionResult,
} from "./domain/intelligence-execution.types";
import { SYNTHETIC_PROCESSOR_ID } from "./domain/intelligence-execution.types";
import { ProcessorExecutorFailure } from "./executor/processor-executor";
import type { ProcessorSuccessPersistenceHook } from "./processor-persistence.hook";

/** Bounded dispatch only; finalization still owns the transaction and live lease. */
@Injectable()
export class ProcessorPersistenceRouter implements ProcessorSuccessPersistenceHook {
  constructor(
    private readonly communication: BrandCommunicationPersistenceHook,
    private readonly meaning: BrandMeaningPersistenceHook,
    @Optional() private readonly character?: BrandCharacterPersistenceHook,
    @Optional() private readonly audience?: AudiencePersonaPersistenceHook,
  ) {}
  async persistBeforeCompletion(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
  ): Promise<void> {
    switch (claim.processorExecution.processorId) {
      case "audience_persona_synthesis":
        if (!this.audience)
          throw new ProcessorExecutorFailure({
            category: "CONFIGURATION_DRIFT",
            code: "PERSISTENCE_HOOK_REGISTRATION_MISSING",
          });
        return this.audience.persistBeforeCompletion(tx, claim, result);
      case "brand_character":
        if (!this.character)
          throw new ProcessorExecutorFailure({
            category: "CONFIGURATION_DRIFT",
            code: "PERSISTENCE_HOOK_REGISTRATION_MISSING",
          });
        return this.character.persistBeforeCompletion(tx, claim, result);
      case "brand_communication":
        return this.communication.persistBeforeCompletion(tx, claim, result);
      case "brand_meaning":
        return this.meaning.persistBeforeCompletion(tx, claim, result);
      case SYNTHETIC_PROCESSOR_ID:
        return;
      default:
        throw new ProcessorExecutorFailure({
          category: "CONFIGURATION_DRIFT",
          code: "PERSISTENCE_HOOK_REGISTRATION_MISSING",
        });
    }
  }
}
