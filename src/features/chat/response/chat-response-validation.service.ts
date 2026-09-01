import { BadRequestException, Injectable } from "@nestjs/common";

import type {
  ChatEntityRef,
  ChatGroundedResponse,
  ChatResponseExecutionEvidence,
  ValidatedChatGroundedResponse,
} from "./chat-response.contract";
import { ChatGroundedResponseSchema } from "./chat-response.schema";

@Injectable()
export class ChatResponseValidationService {
  validate(
    candidate: unknown,
    evidence: ChatResponseExecutionEvidence,
  ): ValidatedChatGroundedResponse {
    const response = ChatGroundedResponseSchema.parse(candidate);
    const invoked = new Set(evidence.invokedCapabilityIds);
    for (const grounding of response.grounding) {
      if (!invoked.has(grounding.capabilityId)) {
        throw new BadRequestException(
          `Grounding capability was not invoked: ${grounding.capabilityId}`,
        );
      }
    }

    const authorized = new Set(evidence.authorizedEntityRefs.map(this.refKey));
    const assertedRefs = [
      ...response.entityRefs,
      ...response.grounding.flatMap((grounding) => grounding.entityRefs),
      ...(response.navigation?.entityRef
        ? [response.navigation.entityRef]
        : []),
    ];
    for (const ref of assertedRefs) {
      if (!authorized.has(this.refKey(ref))) {
        throw new BadRequestException(
          `Response contains an unauthorized entity reference: ${this.refKey(ref)}`,
        );
      }
    }

    if (
      response.navigation &&
      !evidence.allowedNavigationDestinationIds.includes(
        response.navigation.destinationId,
      )
    ) {
      throw new BadRequestException(
        `Unregistered navigation destination: ${response.navigation.destinationId}`,
      );
    }
    return response as unknown as ValidatedChatGroundedResponse;
  }

  private readonly refKey = (ref: ChatEntityRef): string =>
    `${ref.type}:${ref.id}`;
}
