import { HttpException, Injectable } from "@nestjs/common";

import { BrandWorkspaceReadinessConsumerService } from "../../../brand-workspace-readiness/brand-workspace-readiness-consumer.service";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";

@Injectable()
export class WorkspaceReadinessReadHandler implements ChatCapabilityHandler {
  readonly capabilityId = "workspace.readiness.read";

  constructor(
    private readonly readiness: BrandWorkspaceReadinessConsumerService,
  ) {}

  async execute(
    context: ChatCapabilityExecutionContext,
  ): Promise<ChatCapabilityExecutionResult> {
    try {
      const data = await this.readiness.read(context.actor);
      const brandRef = { type: "BRAND" as const, id: data.brandId };
      return {
        capabilityId: this.capabilityId,
        availability: "AVAILABLE",
        data,
        grounding: [
          {
            sourceType: "CANONICAL",
            capabilityId: this.capabilityId,
            entityRefs: [brandRef],
          },
        ],
        authorizedEntityRefs: [brandRef],
      };
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) {
        throw error;
      }
      return {
        capabilityId: this.capabilityId,
        availability: "UNAVAILABLE_RECOVERABLE",
        grounding: [],
        authorizedEntityRefs: [],
        limitations: [
          "Workspace readiness is temporarily unavailable. Please try again later.",
        ],
      };
    }
  }
}
