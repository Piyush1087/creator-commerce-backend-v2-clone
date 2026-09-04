import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  ChatCreateConversationSchema,
  ChatListConversationsQuerySchema,
  ChatPatchConversationSchema,
  ChatTurnRequestSchema,
  type ChatCreateConversationInput,
  type ChatListConversationsQuery,
  type ChatPatchConversationInput,
  type ChatTurnRequest,
} from "./chat-http.schema";
import { ChatZodValidationPipe } from "./chat-zod-validation.pipe";
import { ChatConversationService } from "./conversation/chat-conversation.service";
import { ChatTurnOrchestratorService } from "./orchestration/chat-turn-orchestrator.service";

@Controller("api/v1/chat/conversations")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class ChatController {
  constructor(
    @Inject(ChatConversationService)
    private readonly conversations: ChatConversationService,
    @Inject(ChatTurnOrchestratorService)
    private readonly turns: ChatTurnOrchestratorService,
  ) {}

  @Post()
  createConversation(
    @Req() req: RequestWithAuthUser,
    @Body(new ChatZodValidationPipe(ChatCreateConversationSchema))
    body: ChatCreateConversationInput,
  ) {
    return this.conversations.createConversation(req.user, body.title);
  }

  @Get()
  listConversations(
    @Req() req: RequestWithAuthUser,
    @Query(new ChatZodValidationPipe(ChatListConversationsQuerySchema))
    query: ChatListConversationsQuery,
  ) {
    return this.conversations.listConversations(req.user, query);
  }

  @Get(":conversationId")
  async getConversation(
    @Req() req: RequestWithAuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ) {
    const conversation = await this.conversations.getConversation(
      req.user,
      conversationId,
      { includeArchived: true },
    );
    if (!conversation) throw new NotFoundException("Conversation not found");
    const messages = await this.conversations.listMessages(
      req.user,
      conversationId,
    );
    return { conversation, messages: messages ?? [] };
  }

  @Patch(":conversationId")
  async patchConversation(
    @Req() req: RequestWithAuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body(new ChatZodValidationPipe(ChatPatchConversationSchema))
    body: ChatPatchConversationInput,
  ) {
    const conversation = await this.conversations.patchConversation(
      req.user,
      conversationId,
      body,
    );
    if (!conversation) throw new NotFoundException("Conversation not found");
    return conversation;
  }

  @Post(":conversationId/turns")
  runTurn(
    @Req() req: RequestWithAuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body(new ChatZodValidationPipe(ChatTurnRequestSchema))
    body: ChatTurnRequest,
  ) {
    return this.turns.runTurn(req.user, conversationId, body);
  }
}
