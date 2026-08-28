import { Injectable, Optional } from "@nestjs/common";
import { VisualStyleProcessorExecutor } from "../../processors/visual-style/visual-style-processor.executor";
import { ServiceabilityProcessorExecutor } from "../../processors/serviceability/serviceability-processor.executor";
import { BrandDifferentiationProcessorExecutor } from "../../processors/brand-differentiation/brand-differentiation-processor.executor";

import { IntelligenceExecutionError } from "../domain/intelligence-execution.error";
import { SYNTHETIC_PROCESSOR_ID } from "../domain/intelligence-execution.types";
import type { ProcessorExecutor } from "./processor-executor";
import { SyntheticProcessorExecutor } from "./synthetic-processor.executor";
import { BrandCommunicationProcessorExecutor } from "../../processors/brand-communication/brand-communication-processor.executor";
import { BrandMeaningProcessorExecutor } from "../../processors/brand-meaning/brand-meaning-processor.executor";
import { BrandCharacterProcessorExecutor } from "../../processors/brand-character/brand-character-processor.executor";
import { AudiencePersonaProcessorExecutor } from "../../processors/audience-persona/audience-persona-processor.executor";
import { OfferingFactualProcessorExecutor } from "../../processors/offering-factual/offering-factual-processor.executor";
import {
  OfferingActionabilityProcessorExecutor,
  OfferingCreatorCommunicationProcessorExecutor,
} from "../../processors/offering-derived/offering-derived-processor.executor";

@Injectable()
export class ProcessorExecutorRegistry {
  private readonly executors: ReadonlyMap<string, ProcessorExecutor>;

  constructor(
    syntheticExecutor: SyntheticProcessorExecutor,
    @Optional()
    brandCommunicationExecutor?: BrandCommunicationProcessorExecutor,
    @Optional()
    brandMeaningExecutor?: BrandMeaningProcessorExecutor,
    @Optional()
    brandCharacterExecutor?: BrandCharacterProcessorExecutor,
    @Optional()
    audiencePersonaExecutor?: AudiencePersonaProcessorExecutor,
    @Optional()
    brandDifferentiationExecutor?: BrandDifferentiationProcessorExecutor,
    @Optional()
    visualStyleExecutor?: VisualStyleProcessorExecutor,
    @Optional()
    serviceabilityExecutor?: ServiceabilityProcessorExecutor,
    @Optional()
    offeringFactualExecutor?: OfferingFactualProcessorExecutor,
    @Optional()
    offeringCreatorExecutor?: OfferingCreatorCommunicationProcessorExecutor,
    @Optional()
    offeringActionabilityExecutor?: OfferingActionabilityProcessorExecutor,
  ) {
    const executors: [string, ProcessorExecutor][] = [
      [SYNTHETIC_PROCESSOR_ID, syntheticExecutor],
    ];
    if (brandCommunicationExecutor) {
      executors.push([
        brandCommunicationExecutor.processorId,
        brandCommunicationExecutor,
      ]);
    }
    if (brandMeaningExecutor)
      executors.push([brandMeaningExecutor.processorId, brandMeaningExecutor]);
    if (brandCharacterExecutor)
      executors.push([
        brandCharacterExecutor.processorId,
        brandCharacterExecutor,
      ]);
    if (audiencePersonaExecutor)
      executors.push([
        audiencePersonaExecutor.processorId,
        audiencePersonaExecutor,
      ]);
    if (brandDifferentiationExecutor)
      executors.push([
        brandDifferentiationExecutor.processorId,
        brandDifferentiationExecutor,
      ]);
    if (visualStyleExecutor)
      executors.push([visualStyleExecutor.processorId, visualStyleExecutor]);
    if (serviceabilityExecutor)
      executors.push([
        serviceabilityExecutor.processorId,
        serviceabilityExecutor,
      ]);
    if (offeringFactualExecutor)
      executors.push([
        offeringFactualExecutor.processorId,
        offeringFactualExecutor,
      ]);
    if (offeringCreatorExecutor)
      executors.push([
        offeringCreatorExecutor.processorId,
        offeringCreatorExecutor,
      ]);
    if (offeringActionabilityExecutor)
      executors.push([
        offeringActionabilityExecutor.processorId,
        offeringActionabilityExecutor,
      ]);
    this.executors = new Map(executors);
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
