import { HttpException, Injectable } from "@nestjs/common";

import { CollaborationConsumerService } from "../../../collaboration/services/collaboration-consumer.service";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";

@Injectable()
export class CollaborationReadHandler implements ChatCapabilityHandler {
  readonly capabilityId = "collaboration.read";

  constructor(private readonly collaborations: CollaborationConsumerService) {}

  async execute(
    context: ChatCapabilityExecutionContext,
    input: Readonly<Record<string, unknown>>,
  ): Promise<ChatCapabilityExecutionResult> {
    const collaborationId = String(input.collaborationId);
    if (
      !context.authorizedEntityRefs.some(
        (ref) => ref.type === "COLLABORATION" && ref.id === collaborationId,
      )
    ) {
      return this.denied();
    }

    try {
      const data = await this.collaborations.read(
        context.actor,
        collaborationId,
      );
      const refs = [
        { type: "COLLABORATION" as const, id: data.collaborationId },
        { type: "CAMPAIGN" as const, id: data.campaign.id },
      ];
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

  private denied(): ChatCapabilityExecutionResult {
    return {
      capabilityId: this.capabilityId,
      availability: "NOT_AUTHORIZED",
      grounding: [],
      authorizedEntityRefs: [],
      limitations: ["The requested item is not available in this workspace."],
    };
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
