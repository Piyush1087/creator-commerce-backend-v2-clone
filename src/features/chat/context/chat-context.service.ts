import { Injectable, NotFoundException } from "@nestjs/common";

import type { AuthUser } from "../../auth/types/auth-user";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";
import { ChatCapabilityRegistry } from "../capabilities/chat-capability.registry";
import { ChatConversationService } from "../conversation/chat-conversation.service";
import type { ChatContext } from "./chat-context.contract";
import {
  ChatContextRequestSchema,
  type ChatContextRequest,
} from "./chat-context.schema";

@Injectable()
export class ChatContextService {
  constructor(
    private readonly workspace: BrandWorkspaceAuthorizationService,
    private readonly conversations: ChatConversationService,
    private readonly capabilities: ChatCapabilityRegistry,
  ) {}

  async assemble(
    user: AuthUser,
    request: ChatContextRequest,
  ): Promise<ChatContext> {
    const input = ChatContextRequestSchema.parse(request);
    const workspace = await this.workspace.resolveBrandContext(user);
    const scope = { brandProfileId: workspace.brandProfileId, userId: user.id };

    if (input.conversationId) {
      const conversation = await this.conversations.getConversationForScope(
        scope,
        input.conversationId,
        { includeArchived: true },
      );
      if (!conversation) {
        throw new NotFoundException("Conversation not found");
      }
    }

    return {
      actor: { userId: user.id, role: user.role },
      workspace: {
        brandProfileId: workspace.brandProfileId,
        membershipRole: workspace.membership.role,
      },
      conversation: { id: input.conversationId ?? null },
      surface: { kind: input.surface },
      requestHints: {
        ...(input.routePath ? { routePath: input.routePath } : {}),
        ...(input.selectedEntity
          ? { selectedEntity: { ...input.selectedEntity } }
          : {}),
      },
      capabilities: this.capabilities.discover(),
      canonicalRefs: [{ type: "BRAND", id: workspace.brandProfileId }],
      intelligenceRefs: [],
      providerReadiness: [],
      turnStartedAt: new Date().toISOString(),
    };
  }
}
