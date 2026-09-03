import { BadRequestException, Injectable } from "@nestjs/common";
import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";

import { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { zodToGeminiResponseSchema } from "../../brand-centre/prompts/zod-to-gemini-response-schema.util";
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

const ChatCapabilitySelectionSchema = z
  .object({
    capabilityIds: z.array(z.string().trim().min(1).max(128)).max(10),
  })
  .strict();

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

    const selectableCapabilityIds = [...allowed].filter((capabilityId) =>
      this.isMaterializable(
        capabilityId,
        serverContext.authorizedEntityCandidates,
      ),
    );
    if (selectableCapabilityIds.length === 0) {
      return { requests: [] };
    }

    const selectionResult = await this.model.generateJson({
      systemInstruction:
        "Return exactly one JSON object containing capabilityIds. Select only from the supplied selectable capability IDs. Do not return inputs. Do not return reasoning or rationale. Entity-scoped capabilities are supplied only when the server has already authorized suitable entity candidates. Select the minimum capabilities needed to answer the request. app.navigate may omit an entity only for a generic destination request. When the user names a specific entity and no matching authorized candidate is supplied, select the relevant list capability instead of app.navigate so the server can discover candidates.",
      userText: JSON.stringify({
        userRequest: args.userRequest,
        selectableCapabilityIds,
        clientContextHints,
        conversationExcerpt,
        serverContext,
      }),
      responseSchema: this.buildSelectionResponseSchema(
        selectableCapabilityIds,
      ),
      temperature: 0,
    });

    const selection = ChatCapabilitySelectionSchema.parse(selectionResult);
    const selectable = new Set(selectableCapabilityIds);
    for (const capabilityId of selection.capabilityIds) {
      if (!selectable.has(capabilityId)) {
        throw new BadRequestException(
          `Model selected a non-selectable capability: ${capabilityId}`,
        );
      }
    }

    const requests: ChatCapabilityPlan["requests"] = [];
    for (const capabilityId of selection.capabilityIds) {
      const descriptor = this.capabilities.get(capabilityId);
      const emptyInput = descriptor.inputSchema.safeParse({});
      const input = emptyInput.success
        ? emptyInput.data
        : await this.materializeCapabilityInput({
            userRequest: args.userRequest,
            capabilityId,
            clientContextHints,
            conversationExcerpt,
            serverContext,
            alreadyMaterializedRequests: requests,
          });
      requests.push({ capabilityId, input });
    }

    const plan = ChatCapabilityPlanSchema.parse({ requests });
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
        "Synthesize only the supplied authorized results. Return exactly one JSON object containing answer, freshnessNotes, limitations, and optionally a non-mutating recommendation. Recommendation basisRefs must be exact resultRefs supplied with executed authorized results. Never claim that you updated, approved, sent, connected, paid, changed, invited, completed, or otherwise executed an action. Do not invent grounding, entities, navigation, actions, authorization, or unsupported facts.",
      userText: JSON.stringify(args),
      responseSchema: zodToGeminiResponseSchema(ChatSynthesisDraftSchema),
      temperature: 0.2,
    });
    return ChatSynthesisDraftSchema.parse(modelResult);
  }

  private isMaterializable(
    capabilityId: string,
    authorizedEntityCandidates: readonly { type: string; id: string }[],
  ): boolean {
    const inputSchema = zodToGeminiResponseSchema(
      this.capabilities.get(capabilityId).inputSchema,
    );
    if (inputSchema.type !== SchemaType.OBJECT) {
      throw new Error(
        `Chat capability input provider schema must be OBJECT: ${capabilityId}`,
      );
    }

    const required = new Set(inputSchema.required ?? []);
    if (
      required.has("offeringId") &&
      !authorizedEntityCandidates.some(
        (candidate) => candidate.type === "OFFERING",
      )
    ) {
      return false;
    }
    if (
      required.has("campaignId") &&
      !authorizedEntityCandidates.some(
        (candidate) => candidate.type === "CAMPAIGN",
      )
    ) {
      return false;
    }
    if (
      required.has("collaborationId") &&
      !authorizedEntityCandidates.some(
        (candidate) => candidate.type === "COLLABORATION",
      )
    ) {
      return false;
    }
    return true;
  }

  private buildSelectionResponseSchema(
    selectableCapabilityIds: readonly string[],
  ): ResponseSchema {
    return {
      type: SchemaType.OBJECT,
      properties: {
        capabilityIds: {
          type: SchemaType.ARRAY,
          maxItems: 10,
          items: {
            type: SchemaType.STRING,
            enum: [...selectableCapabilityIds],
          },
        } as ResponseSchema,
      },
      required: ["capabilityIds"],
    };
  }

  private async materializeCapabilityInput(args: {
    userRequest: string;
    capabilityId: string;
    clientContextHints: Readonly<Record<string, unknown>>;
    conversationExcerpt: readonly Readonly<Record<string, unknown>>[];
    serverContext: {
      planningPass: 1 | 2;
      authorizedEntityCandidates: readonly {
        type: "BRAND" | "OFFERING" | "CAMPAIGN" | "COLLABORATION";
        id: string;
        label?: string;
      }[];
      alreadyInvokedCapabilities: readonly {
        capabilityId: string;
        input: Record<string, unknown>;
      }[];
    };
    alreadyMaterializedRequests: readonly {
      capabilityId: string;
      input: Record<string, unknown>;
    }[];
  }): Promise<Record<string, unknown>> {
    const responseSchema = JSON.parse(
      JSON.stringify(
        zodToGeminiResponseSchema(
          this.capabilities.get(args.capabilityId).inputSchema,
        ),
      ),
    ) as ResponseSchema;
    if (responseSchema.type !== SchemaType.OBJECT) {
      throw new Error(
        `Chat capability input provider schema must be OBJECT: ${args.capabilityId}`,
      );
    }

    this.constrainAuthorizedEntityIds(
      args.capabilityId,
      responseSchema,
      args.serverContext.authorizedEntityCandidates,
    );

    const providerInput = await this.model.generateJson({
      systemInstruction:
        "Return exactly the JSON input object required by the supplied capability. Use only server-authorized entity candidates. Do not invent entity IDs when an authorized matching candidate exists. For app.navigate, include its optional entity when the user names a specific entity and a matching authorized candidate is supplied. Do not include userId, role, workspace authority, provider credentials, reasoning, rationale, or extra fields.",
      userText: JSON.stringify({
        userRequest: args.userRequest,
        capabilityId: args.capabilityId,
        clientContextHints: args.clientContextHints,
        conversationExcerpt: args.conversationExcerpt,
        serverContext: args.serverContext,
        alreadyMaterializedRequests: args.alreadyMaterializedRequests,
      }),
      responseSchema,
      temperature: 0,
    });

    return this.capabilities.validateInput(args.capabilityId, providerInput);
  }

  private constrainAuthorizedEntityIds(
    capabilityId: string,
    responseSchema: ResponseSchema,
    authorizedEntityCandidates: readonly {
      type: "BRAND" | "OFFERING" | "CAMPAIGN" | "COLLABORATION";
      id: string;
    }[],
  ): void {
    const required = new Set(responseSchema.required ?? []);
    const offeringIds = this.candidateIds(
      authorizedEntityCandidates,
      "OFFERING",
    );
    const campaignIds = this.candidateIds(
      authorizedEntityCandidates,
      "CAMPAIGN",
    );
    const collaborationIds = this.candidateIds(
      authorizedEntityCandidates,
      "COLLABORATION",
    );

    if (required.has("offeringId")) {
      if (offeringIds.length === 0) {
        throw new Error(
          `INTERNAL_PLANNER_INVARIANT_FAILURE: ${capabilityId} requires an authorized offering`,
        );
      }
      this.requireProperty(responseSchema, capabilityId, "offeringId").enum =
        offeringIds;
    }
    if (required.has("campaignId")) {
      if (campaignIds.length === 0) {
        throw new Error(
          `INTERNAL_PLANNER_INVARIANT_FAILURE: ${capabilityId} requires an authorized campaign`,
        );
      }
      this.requireProperty(responseSchema, capabilityId, "campaignId").enum =
        campaignIds;
    }
    if (required.has("collaborationId")) {
      if (collaborationIds.length === 0) {
        throw new Error(
          `INTERNAL_PLANNER_INVARIANT_FAILURE: ${capabilityId} requires an authorized collaboration`,
        );
      }
      this.requireProperty(
        responseSchema,
        capabilityId,
        "collaborationId",
      ).enum = collaborationIds;
    }

    const entitySchema = responseSchema.properties?.entity;
    const entityIdSchema = entitySchema?.properties?.id;
    const authorizedIds = this.candidateIds(authorizedEntityCandidates);
    if (entityIdSchema && authorizedIds.length > 0) {
      entityIdSchema.enum = authorizedIds;
    }
  }

  private candidateIds(
    candidates: readonly {
      type: "BRAND" | "OFFERING" | "CAMPAIGN" | "COLLABORATION";
      id: string;
    }[],
    type?: "BRAND" | "OFFERING" | "CAMPAIGN" | "COLLABORATION",
  ): string[] {
    return [
      ...new Set(
        candidates
          .filter((candidate) => type === undefined || candidate.type === type)
          .map((candidate) => candidate.id),
      ),
    ];
  }

  private requireProperty(
    responseSchema: ResponseSchema,
    capabilityId: string,
    propertyName: string,
  ): ResponseSchema {
    const property = responseSchema.properties?.[propertyName];
    if (!property) {
      throw new Error(
        `INTERNAL_PLANNER_INVARIANT_FAILURE: ${capabilityId} is missing provider property ${propertyName}`,
      );
    }
    return property;
  }
}
