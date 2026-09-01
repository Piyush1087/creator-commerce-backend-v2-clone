import { Injectable } from "@nestjs/common";

import { IntelligenceConsumerService } from "../../../intelligence-consumer/intelligence-consumer.service";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";
import { intelligenceEvidence } from "./intelligence-result.util";

@Injectable()
export class ProductIntelligenceCurrentReadHandler implements ChatCapabilityHandler {
  readonly capabilityId = "product_intelligence.current.read";

  constructor(private readonly intelligence: IntelligenceConsumerService) {}

  async execute(
    context: ChatCapabilityExecutionContext,
    input: Readonly<Record<string, unknown>>,
  ): Promise<ChatCapabilityExecutionResult> {
    const offeringId = String(input.offeringId);
    if (
      !context.authorizedEntityRefs.some(
        (ref) => ref.type === "OFFERING" && ref.id === offeringId,
      )
    ) {
      return this.denied();
    }
    const subject = { type: "OFFERING" as const, id: offeringId };
    const availability = await this.intelligence.resolveAvailability(
      context.actor,
      "product_intelligence",
      subject,
    );
    if (availability.status === "UNAVAILABLE") {
      return {
        capabilityId: this.capabilityId,
        availability: "UNAVAILABLE",
        grounding: [],
        authorizedEntityRefs: [],
        limitations: [
          `Product Intelligence is currently unavailable${availability.reasonCode ? ` (${availability.reasonCode})` : ""}.`,
        ],
      };
    }
    const data = await this.intelligence.read(
      context.actor,
      "product_intelligence",
      subject,
    );
    if (
      data.engineId !== "product_intelligence" ||
      data.subject.type !== "OFFERING" ||
      data.subject.id !== offeringId
    ) {
      throw new Error(
        "Product Intelligence consumer returned the wrong subject",
      );
    }
    if (data.capabilityAvailability.status === "UNAVAILABLE") {
      return {
        capabilityId: this.capabilityId,
        availability: "UNAVAILABLE",
        data,
        grounding: [],
        authorizedEntityRefs: [],
        limitations: ["Product Intelligence is currently unavailable."],
      };
    }
    const entityRef = { type: "OFFERING" as const, id: offeringId };
    const evidence = intelligenceEvidence(this.capabilityId, data, entityRef);
    return {
      capabilityId: this.capabilityId,
      availability: "AVAILABLE",
      data,
      grounding: evidence.grounding,
      authorizedEntityRefs: [entityRef],
      freshnessNotes: evidence.freshnessNotes,
      limitations: evidence.limitations,
    };
  }

  private denied(): ChatCapabilityExecutionResult {
    return {
      capabilityId: this.capabilityId,
      availability: "NOT_AUTHORIZED",
      grounding: [],
      authorizedEntityRefs: [],
      limitations: ["The requested item is not available in this workspace."],
    };
  }
}
