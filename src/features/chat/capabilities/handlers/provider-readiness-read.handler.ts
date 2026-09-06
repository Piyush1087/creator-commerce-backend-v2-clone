import { HttpException, Injectable } from "@nestjs/common";

import { BrandProviderReadinessService } from "../../../brand-settings/services/brand-provider-readiness.service";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";

@Injectable()
export class ProviderReadinessReadHandler implements ChatCapabilityHandler {
  readonly capabilityId = "provider.readiness.read";

  constructor(private readonly readiness: BrandProviderReadinessService) {}

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
        limitations: data.limitations,
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
          "Provider readiness is temporarily unavailable. Please try again later.",
        ],
      };
    }
  }
}
