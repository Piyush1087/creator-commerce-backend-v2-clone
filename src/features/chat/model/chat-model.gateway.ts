import { BadRequestException, Injectable } from "@nestjs/common";

import { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { ChatCapabilityRegistry } from "../capabilities/chat-capability.registry";
import {
  ChatCapabilityPlanSchema,
  ChatConversationExcerptSchema,
  ChatModelContextHintsSchema,
  ChatPlanningServerContextSchema,
  ChatSynthesisDraftSchema,
  type ChatCapabilityPlan,
  type ChatSynthesisDraft,
} from "./chat-model.schema";

@Injectable()
export class ChatModelGateway {
  constructor(
    private readonly model: GeminiJsonClient,
    private readonly capabilities: ChatCapabilityRegistry,
  ) {}

  async planCapabilities(args: {
    userRequest: string;
    allowedCapabilityIds: readonly string[];
    clientContextHints: Readonly<Record<string, unknown>>;
    conversationExcerpt: readonly Readonly<Record<string, unknown>>[];
    serverContext: Readonly<Record<string, unknown>>;
  }): Promise<ChatCapabilityPlan> {
    const allowed = new Set(
      args.allowedCapabilityIds.map((id) => this.capabilities.get(id).id),
    );
    const clientContextHints = ChatModelContextHintsSchema.parse(
      args.clientContextHints,
    );
    const conversationExcerpt = ChatConversationExcerptSchema.parse(
      args.conversationExcerpt,
    );
    const serverContext = ChatPlanningServerContextSchema.parse(
      args.serverContext,
    );
    const modelResult = await this.model.generateJson({
      systemInstruction:
        "Return only strict JSON requests with no rationale or reasoning. Select only supplied capability IDs and satisfy their strict input schemas. Server-authorized entity candidates are the only entity IDs you may select. Client route and entity hints are non-authoritative. Never request a business mutation, credentials, actor, workspace, or authorization fields.",
      userText: JSON.stringify({
        userRequest: args.userRequest,
        allowedCapabilityIds: [...allowed],
        clientContextHints,
        conversationExcerpt,
        serverContext,
      }),
      temperature: 0,
    });
    const plan = ChatCapabilityPlanSchema.parse(modelResult);
    return {
      requests: plan.requests.map((request) => {
        if (!allowed.has(request.capabilityId)) {
          throw new BadRequestException(
            `Model selected a disallowed capability: ${request.capabilityId}`,
          );
        }
        return {
          capabilityId: request.capabilityId,
          input: this.capabilities.validateInput(
            request.capabilityId,
            request.input,
          ),
        };
      }),
    };
  }

  async synthesize(args: {
    userRequest: string;
    authorizedCapabilityResults: readonly Readonly<Record<string, unknown>>[];
    sanitizedConversationContext: Readonly<Record<string, unknown>>;
    responseConstraints: Readonly<Record<string, unknown>>;
  }): Promise<ChatSynthesisDraft> {
    const modelResult = await this.model.generateJson({
      systemInstruction:
        "Synthesize only the supplied authorized results. Return answer, freshnessNotes, and limitations as strict JSON. Do not invent grounding, entities, navigation, actions, or authorization.",
      userText: JSON.stringify(args),
      temperature: 0.2,
    });
    return ChatSynthesisDraftSchema.parse(modelResult);
  }
}
