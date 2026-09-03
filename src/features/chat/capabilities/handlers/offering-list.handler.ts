import { Injectable } from "@nestjs/common";

import { CanonicalOfferingDiscoveryService } from "../../../brand-centre/consumer/canonical-offering-discovery.service";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";

@Injectable()
export class OfferingListHandler implements ChatCapabilityHandler {
  readonly capabilityId = "offering.list";

  constructor(private readonly offerings: CanonicalOfferingDiscoveryService) {}

  async execute(
    context: ChatCapabilityExecutionContext,
  ): Promise<ChatCapabilityExecutionResult> {
    const data = await this.offerings.listForWorkspace(context.actor);
    const refs = data.offerings.map((offering) => ({
      type: "OFFERING" as const,
      id: offering.offeringId,
    }));
    return {
      capabilityId: this.capabilityId,
      availability: "AVAILABLE",
      data,
      grounding: [
        {
          sourceType: "CANONICAL",
          capabilityId: this.capabilityId,
          entityRefs: refs,
        },
      ],
      authorizedEntityRefs: refs,
    };
  }
}
