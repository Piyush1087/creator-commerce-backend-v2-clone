import { Injectable } from "@nestjs/common";

import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";

@Injectable()
export class WorkspaceContextReadHandler implements ChatCapabilityHandler {
  readonly capabilityId = "workspace.context.read";

  async execute(
    context: ChatCapabilityExecutionContext,
  ): Promise<ChatCapabilityExecutionResult> {
    const brandRef = {
      type: "BRAND" as const,
      id: context.chatContext.workspace.brandProfileId,
    };
    return {
      capabilityId: this.capabilityId,
      availability: "AVAILABLE",
      data: {
        workspaceBrand: brandRef,
        membershipRole: context.chatContext.workspace.membershipRole,
        surface: context.chatContext.surface.kind,
        capabilities: context.chatContext.capabilities,
      },
      grounding: [
        {
          sourceType: "CANONICAL",
          capabilityId: this.capabilityId,
          entityRefs: [brandRef],
        },
      ],
      authorizedEntityRefs: [brandRef],
    };
  }
}
