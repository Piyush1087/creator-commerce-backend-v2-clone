import { HttpException, Injectable } from "@nestjs/common";

import { CollaborationConsumerService } from "../../../collaboration/services/collaboration-consumer.service";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";

@Injectable()
export class CollaborationListHandler implements ChatCapabilityHandler {
  readonly capabilityId = "collaboration.list";

  constructor(private readonly collaborations: CollaborationConsumerService) {}

  async execute(
    context: ChatCapabilityExecutionContext,
  ): Promise<ChatCapabilityExecutionResult> {
    try {
      const data = await this.collaborations.list(context.actor);
      const refs = data.collaborations.flatMap((collaboration) => [
        { type: "COLLABORATION" as const, id: collaboration.collaborationId },
        { type: "CAMPAIGN" as const, id: collaboration.campaign.id },
      ]);
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
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) {
        throw error;
      }
      return this.unavailable();
    }
  }

  private unavailable(): ChatCapabilityExecutionResult {
    return {
      capabilityId: this.capabilityId,
      availability: "UNAVAILABLE_RECOVERABLE",
      grounding: [],
      authorizedEntityRefs: [],
      limitations: [
        "Collaboration state is temporarily unavailable. Please try again later.",
      ],
    };
  }
}
