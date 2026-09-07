import { BadRequestException, Injectable } from "@nestjs/common";

import { CanonicalOfferingStateService } from "../../../brand-centre/services/canonical-offering-state.service";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";

@Injectable()
export class OfferingReadHandler implements ChatCapabilityHandler {
  readonly capabilityId = "offering.read";

  constructor(private readonly offerings: CanonicalOfferingStateService) {}

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
    const offering = await this.offerings.read(
      context.chatContext.workspace.brandProfileId,
      offeringId,
    );
    if (
      !offering ||
      offering.id !== offeringId ||
      offering.brandProfileId !== context.chatContext.workspace.brandProfileId
    ) {
      throw new BadRequestException("Offering not found");
    }
    const entityRef = { type: "OFFERING" as const, id: offering.id };
    return {
      capabilityId: this.capabilityId,
      availability: "AVAILABLE",
      data: {
        offeringId: offering.id,
        name: offering.name,
        canonicalKind: offering.canonicalKind,
        canonicalSubtype: offering.canonicalSubtype,
        canonicalLifecycle: offering.canonicalLifecycle,
        description: offering.description,
        url: offering.url,
      },
      grounding: [
        {
          sourceType: "CANONICAL",
          capabilityId: this.capabilityId,
          entityRefs: [entityRef],
        },
      ],
      authorizedEntityRefs: [entityRef],
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
