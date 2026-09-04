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
    const executedResultRefs = new Map<string, Set<string>>();
    for (const grounding of evidence.executedGroundingResultRefs) {
      if (!invoked.has(grounding.capabilityId)) {
        throw new BadRequestException(
          `Result reference evidence capability was not invoked: ${grounding.capabilityId}`,
        );
      }
      const refs = executedResultRefs.get(grounding.capabilityId) ?? new Set();
      grounding.resultRefs.forEach((ref) => refs.add(ref));
      executedResultRefs.set(grounding.capabilityId, refs);
    }
    for (const grounding of response.grounding) {
      if (!invoked.has(grounding.capabilityId)) {
        throw new BadRequestException(
          `Grounding capability was not invoked: ${grounding.capabilityId}`,
        );
      }
      const authorizedRefs = executedResultRefs.get(grounding.capabilityId);
      for (const resultRef of grounding.resultRefs ?? []) {
        if (!authorizedRefs?.has(resultRef)) {
          throw new BadRequestException(
            `Grounding result reference was not produced by the executed capability: ${resultRef}`,
          );
        }
      }
    }

    const allExecutedResultRefs = new Set(
      [...executedResultRefs.values()].flatMap((refs) => [...refs]),
    );
    for (const basisRef of response.recommendation?.basisRefs ?? []) {
      if (!allExecutedResultRefs.has(basisRef)) {
        throw new BadRequestException(
          `Recommendation basis reference was not produced by executed grounding: ${basisRef}`,
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
    this.assertNonMutatingLanguage(response.answer);
    if (response.recommendation) {
      this.assertNonMutatingLanguage(response.recommendation.text);
    }
    return response as unknown as ValidatedChatGroundedResponse;
  }

  private assertNonMutatingLanguage(text: string): void {
    if (
      /\bI(?:'ve| have)?\s+(?:updated|approved|sent|connected|paid|changed|invited|completed)\b/iu.test(
        text,
      )
    ) {
      throw new BadRequestException(
        "Chat response must not claim that a non-mutating proposal was executed",
      );
    }
  }

  private readonly refKey = (ref: ChatEntityRef): string =>
    `${ref.type}:${ref.id}`;
}
