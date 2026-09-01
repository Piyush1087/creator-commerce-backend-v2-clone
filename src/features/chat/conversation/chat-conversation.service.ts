import { Injectable, NotFoundException } from "@nestjs/common";
import { CoPilotScopeContext } from "@prisma/client";

import type { AuthUser } from "../../auth/types/auth-user";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";
import {
  CoPilotThreadService,
  type ConversationOwnerScope,
} from "../../co-pilot/services/co-pilot-thread.service";
import type { ValidatedChatGroundedResponse } from "../response/chat-response.contract";

@Injectable()
export class ChatConversationService {
  constructor(
    private readonly workspace: BrandWorkspaceAuthorizationService,
    private readonly threads: CoPilotThreadService,
  ) {}

  async createConversation(user: AuthUser, title?: string) {
    const scope = await this.resolveScope(user);
    return this.threads.createThread(scope, {
      title,
      scopeContext: CoPilotScopeContext.GLOBAL,
    });
  }

  async listConversations(
    user: AuthUser,
    options: { limit?: number; includeArchived?: boolean } = {},
  ) {
    return this.threads.listThreads(await this.resolveScope(user), options);
  }

  async getConversation(
    user: AuthUser,
    threadId: string,
    options?: { includeArchived?: boolean },
  ) {
    return this.getConversationForScope(
      await this.resolveScope(user),
      threadId,
      options,
    );
  }

  async getConversationForScope(
    scope: ConversationOwnerScope,
    threadId: string,
    options?: { includeArchived?: boolean },
  ) {
    return this.threads.getThread(scope, threadId, options);
  }

  async archiveConversation(
    user: AuthUser,
    threadId: string,
    archived: boolean,
  ) {
    return this.threads.patchThread(await this.resolveScope(user), threadId, {
      archived,
    });
  }

  async listMessages(user: AuthUser, threadId: string) {
    return this.threads.listMessages(await this.resolveScope(user), threadId);
  }

  async appendUserMessage(user: AuthUser, threadId: string, text: string) {
    return this.threads.appendUserMessage({
      scope: await this.resolveScope(user),
      threadId,
      text,
      scopeContext: CoPilotScopeContext.GLOBAL,
    });
  }

  async appendAssistantResponse(
    user: AuthUser,
    threadId: string,
    response: ValidatedChatGroundedResponse,
  ) {
    const row = await this.threads.appendAssistantMessage({
      scope: await this.resolveScope(user),
      threadId,
      payload: response,
      formatType: "CONVERSATIONAL_NARRATIVE",
      narrativeText: response.answer,
    });
    if (!row) {
      throw new NotFoundException("Conversation not found");
    }
    return row;
  }

  private async resolveScope(user: AuthUser): Promise<ConversationOwnerScope> {
    const context = await this.workspace.resolveBrandContext(user);
    return { brandProfileId: context.brandProfileId, userId: user.id };
  }
}
