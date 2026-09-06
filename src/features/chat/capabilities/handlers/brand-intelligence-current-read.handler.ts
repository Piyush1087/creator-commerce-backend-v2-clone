import { Injectable } from "@nestjs/common";

import { IntelligenceConsumerService } from "../../../intelligence-consumer/intelligence-consumer.service";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";
import { intelligenceEvidence } from "./intelligence-result.util";

@Injectable()
export class BrandIntelligenceCurrentReadHandler implements ChatCapabilityHandler {
  readonly capabilityId = "brand_intelligence.current.read";

  constructor(private readonly intelligence: IntelligenceConsumerService) {}

  async execute(
    context: ChatCapabilityExecutionContext,
  ): Promise<ChatCapabilityExecutionResult> {
    const brandId = context.chatContext.workspace.brandProfileId;
    const subject = { type: "BRAND" as const, id: brandId };
    const availability = await this.intelligence.resolveAvailability(
      context.actor,
      "brand_intelligence",
      subject,
    );
    if (availability.status === "UNAVAILABLE") {
      return {
        capabilityId: this.capabilityId,
        availability: "UNAVAILABLE",
        grounding: [],
        authorizedEntityRefs: [],
        limitations: [
          `Brand Intelligence is currently unavailable${availability.reasonCode ? ` (${availability.reasonCode})` : ""}.`,
        ],
      };
    }

    const data = await this.intelligence.read(
      context.actor,
      "brand_intelligence",
      subject,
    );
    if (
      data.engineId !== "brand_intelligence" ||
      data.subject.type !== "BRAND" ||
      data.subject.id !== brandId
    ) {
      throw new Error("Brand Intelligence consumer returned the wrong subject");
    }
    if (data.capabilityAvailability.status === "UNAVAILABLE") {
      return {
        capabilityId: this.capabilityId,
        availability: "UNAVAILABLE",
        data,
        grounding: [],
        authorizedEntityRefs: [],
        limitations: ["Brand Intelligence is currently unavailable."],
      };
    }
    const entityRef = { type: "BRAND" as const, id: brandId };
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
}
