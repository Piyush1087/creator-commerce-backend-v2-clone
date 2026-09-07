import { HttpException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import type { ChatCapabilityExecutionContext } from "./chat-capability-handler.contract";
import type { ChatCapabilityExecutionResult } from "./chat-capability-handler.contract";
import { ChatCapabilityHandlerRegistry } from "./chat-capability-handler.registry";
import { ChatCapabilityRegistry } from "./chat-capability.registry";

const ENTITY_SCOPED_CAPABILITIES = new Set([
  "offering.read",
  "product_intelligence.current.read",
  "campaign.read",
  "collaboration.read",
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
      const validatedResult = {
        ...result,
        data: descriptor.outputSchema?.parse(result.data),
      };
      if (
        descriptor.class !== "READ" ||
        result.availability !== "AVAILABLE" ||
        validatedResult.grounding.some(
          (grounding) => (grounding.resultRefs?.length ?? 0) > 0,
        )
      ) {
        return validatedResult;
      }

      const resultRef = this.canonicalResultRef(
        capabilityId,
        validatedResult.data,
      );
      return {
        ...validatedResult,
        grounding: validatedResult.grounding.length
          ? validatedResult.grounding.map((grounding, index) =>
              index === 0
                ? { ...grounding, resultRefs: [resultRef] }
                : grounding,
            )
          : [
              {
                sourceType: "CANONICAL",
                capabilityId,
                entityRefs: validatedResult.authorizedEntityRefs,
                resultRefs: [resultRef],
              },
            ],
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

  private canonicalResultRef(capabilityId: string, data: unknown): string {
    const digest = createHash("sha256")
      .update(
        JSON.stringify({
          capabilityId,
          data: this.canonicalize(data),
        }),
      )
      .digest("hex");
    return `canonical:${capabilityId.slice(0, 48)}:${digest}`;
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.canonicalize(item));
    }
    if (value !== null && typeof value === "object") {
      const record = value as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((key) => [key, this.canonicalize(record[key])]),
      );
    }
    return value;
  }
}
