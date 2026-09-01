import { HttpException, Injectable } from "@nestjs/common";

import type { ChatCapabilityExecutionContext } from "./chat-capability-handler.contract";
import type { ChatCapabilityExecutionResult } from "./chat-capability-handler.contract";
import { ChatCapabilityHandlerRegistry } from "./chat-capability-handler.registry";
import { ChatCapabilityRegistry } from "./chat-capability.registry";

const ENTITY_SCOPED_CAPABILITIES = new Set([
  "offering.read",
  "product_intelligence.current.read",
  "campaign.read",
]);

@Injectable()
export class ChatCapabilityExecutor {
  constructor(
    private readonly capabilities: ChatCapabilityRegistry,
    private readonly handlers: ChatCapabilityHandlerRegistry,
  ) {}

  async execute(
    context: ChatCapabilityExecutionContext,
    capabilityId: string,
    input: unknown,
  ): Promise<ChatCapabilityExecutionResult> {
    const descriptor = this.capabilities.get(capabilityId);
    const validatedInput = this.capabilities.validateInput(capabilityId, input);
    try {
      const result = await this.handlers
        .get(capabilityId)
        .execute(context, validatedInput);
      if (result.capabilityId !== capabilityId) {
        throw new Error("Chat capability handler returned a mismatched ID");
      }
      if (result.data === undefined) {
        if (result.availability === "AVAILABLE") {
          throw new Error("Available Chat capability returned no output");
        }
        return result;
      }
      return {
        ...result,
        data: descriptor.outputSchema?.parse(result.data),
      };
    } catch (error) {
      if (
        ENTITY_SCOPED_CAPABILITIES.has(capabilityId) &&
        error instanceof HttpException &&
        [400, 403, 404].includes(error.getStatus())
      ) {
        return {
          capabilityId,
          availability: "NOT_AUTHORIZED",
          grounding: [],
          authorizedEntityRefs: [],
          limitations: [
            "The requested item is not available in this workspace.",
          ],
        };
      }
      throw error;
    }
  }
}
