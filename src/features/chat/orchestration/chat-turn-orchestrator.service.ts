import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { AuthUser } from "../../auth/types/auth-user";
import type { ChatCapabilityExecutionResult } from "../capabilities/chat-capability-handler.contract";
import { ChatCapabilityExecutor } from "../capabilities/chat-capability.executor";
import { ChatCapabilityRegistry } from "../capabilities/chat-capability.registry";
import { ChatContextService } from "../context/chat-context.service";
import type { ChatContextRequest } from "../context/chat-context.schema";
import { ChatConversationService } from "../conversation/chat-conversation.service";
import { ChatModelGateway } from "../model/chat-model.gateway";
import type { ChatCapabilityPlan } from "../model/chat-model.schema";
import type {
  ChatEntityRef,
  ChatGroundedResponse,
} from "../response/chat-response.contract";
import { ChatResponseValidationService } from "../response/chat-response-validation.service";
import { ChatTelemetryService } from "../telemetry/chat-telemetry.service";

export const CHAT_HISTORY_MAX_MESSAGES = 12;
export const CHAT_HISTORY_MAX_MESSAGE_CHARS = 2_000;
export const CHAT_HISTORY_MAX_TOTAL_CHARS = 12_000;
export const CHAT_MAX_PLANNING_PASSES = 2;
export const CHAT_MAX_DISTINCT_EXECUTIONS = 10;

type CapabilityRequest = ChatCapabilityPlan["requests"][number];
type Candidate = ChatEntityRef & { label?: string };

@Injectable()
export class ChatTurnOrchestratorService {
  constructor(
    private readonly contexts: ChatContextService,
    private readonly conversations: ChatConversationService,
    private readonly capabilities: ChatCapabilityRegistry,
    private readonly executor: ChatCapabilityExecutor,
    private readonly model: ChatModelGateway,
    private readonly responses: ChatResponseValidationService,
    private readonly telemetry: ChatTelemetryService,
  ) {}

  async runTurn(
    actor: AuthUser,
    conversationId: string,
    input: Readonly<{
      message: string;
      surface?: ChatContextRequest["surface"];
      routePath?: string;
      selectedEntity?: { type: string; id: string };
    }>,
  ) {
    const requestId = randomUUID();
    const startedAt = Date.now();
    let context: Awaited<ReturnType<ChatContextService["assemble"]>> | null =
      null;
    const invoked: CapabilityRequest[] = [];
    try {
      context = await this.contexts.assemble(actor, {
        conversationId,
        surface: input.surface ?? "HOME",
        ...(input.routePath ? { routePath: input.routePath } : {}),
        ...(input.selectedEntity
          ? { selectedEntity: input.selectedEntity }
          : {}),
      });
      const userMessage = await this.conversations.appendUserMessage(
        actor,
        conversationId,
        input.message,
      );
      if (!userMessage) throw new NotFoundException("Conversation not found");

      const history = this.boundHistory(
        await this.conversations.listMessages(actor, conversationId),
      );
      const results: ChatCapabilityExecutionResult[] = [];
      const authorized = new Map<string, ChatEntityRef>();
      const candidates = new Map<string, Candidate>();
      const brandRef = {
        type: "BRAND" as const,
        id: context.workspace.brandProfileId,
      };
      authorized.set(this.refKey(brandRef), brandRef);
      candidates.set(this.refKey(brandRef), brandRef);
      const pendingNavigation: CapabilityRequest[] = [];
      const executionKeys = new Set<string>();
      const orchestrationLimitations: string[] = [];
      const allowedCapabilityIds = context.capabilities
        .filter((snapshot) => snapshot.availability === "AVAILABLE")
        .map((snapshot) => snapshot.capabilityId);

      const executeRequest = async (
        request: CapabilityRequest,
      ): Promise<void> => {
        const key = this.executionKey(request);
        if (executionKeys.has(key)) return;
        if (executionKeys.size >= CHAT_MAX_DISTINCT_EXECUTIONS) {
          if (!orchestrationLimitations.length) {
            orchestrationLimitations.push(
              "The bounded capability execution limit was reached for this turn.",
            );
          }
          return;
        }
        executionKeys.add(key);
        invoked.push(request);
        const result = await this.executor.execute(
          {
            actor,
            chatContext: context!,
            authorizedEntityRefs: [...authorized.values()],
          },
          request.capabilityId,
          request.input,
        );
        results.push(result);
        if (result.availability === "AVAILABLE") {
          for (const ref of result.authorizedEntityRefs) {
            authorized.set(this.refKey(ref), ref);
          }
          for (const candidate of this.candidatesFrom(result)) {
            candidates.set(this.refKey(candidate), candidate);
          }
        }
      };

      const plan = async (planningPass: 1 | 2) =>
        this.model.planCapabilities({
          userRequest: input.message,
          allowedCapabilityIds,
          clientContextHints: context!.requestHints,
          conversationExcerpt: history,
          serverContext: {
            planningPass,
            authorizedEntityCandidates:
              planningPass === 1 ? [] : [...candidates.values()],
            alreadyInvokedCapabilities: invoked,
          },
        });

      const executeReadsAndQueueNavigation = async (
        capabilityPlan: ChatCapabilityPlan,
      ) => {
        for (const request of capabilityPlan.requests) {
          const descriptor = this.capabilities.get(request.capabilityId);
          if (descriptor.class === "NAVIGATE") {
            pendingNavigation.push(request);
          } else {
            await executeRequest(request);
          }
        }
      };

      const initialCandidateCount = candidates.size;
      await executeReadsAndQueueNavigation(await plan(1));
      if (
        candidates.size > initialCandidateCount &&
        executionKeys.size < CHAT_MAX_DISTINCT_EXECUTIONS
      ) {
        await executeReadsAndQueueNavigation(await plan(2));
      }
      for (const navigation of pendingNavigation) {
        await executeRequest(navigation);
      }

      const usable = results.filter(
        (result) =>
          result.availability === "AVAILABLE" && result.data !== undefined,
      );
      const navigation = [...usable]
        .reverse()
        .find((result) => result.navigation)?.navigation;
      const hasAuthorizationDenial = results.some(
        (result) => result.availability === "NOT_AUTHORIZED",
      );
      const hasUnavailable = results.some((result) =>
        ["UNAVAILABLE", "UNAVAILABLE_RECOVERABLE"].includes(
          result.availability,
        ),
      );
      const freshnessNotes = this.unique(
        results.flatMap((result) => result.freshnessNotes ?? []),
      );
      const limitations = this.unique([
        ...results.flatMap((result) => result.limitations ?? []),
        ...orchestrationLimitations,
      ]);
      const status = navigation
        ? "NAVIGATION"
        : usable.length === 0 && hasAuthorizationDenial
          ? "NOT_AUTHORIZED"
          : usable.length === 0 && hasUnavailable
            ? "CAPABILITY_UNAVAILABLE"
            : freshnessNotes.length > 0
              ? "STALE"
              : limitations.length > 0 ||
                  hasUnavailable ||
                  hasAuthorizationDenial
                ? "PARTIAL"
                : "ANSWERED";

      const draft = navigation
        ? {
            answer: `Opening ${this.destinationLabel(navigation.destinationId)}.`,
            freshnessNotes: [],
            limitations: [],
          }
        : status === "NOT_AUTHORIZED"
          ? {
              answer: "The requested item is not available in this workspace.",
              freshnessNotes: [],
              limitations: [],
            }
          : status === "CAPABILITY_UNAVAILABLE"
            ? {
                answer:
                  "The requested capability is temporarily unavailable. Please try again later.",
                freshnessNotes: [],
                limitations: [],
              }
            : await this.model.synthesize({
                userRequest: input.message,
                authorizedCapabilityResults: usable
                  .filter((result) => !result.navigation)
                  .map((result) => ({
                    capabilityId: result.capabilityId,
                    data: result.data,
                  })),
                sanitizedConversationContext: { recentMessages: history },
                responseConstraints: {
                  maxAnswerCharacters: 20_000,
                  useOnlyAuthorizedResults: true,
                  discloseMissingCurrentValues: true,
                  discloseStaleIntelligence: freshnessNotes.length > 0,
                },
              });

      const response: ChatGroundedResponse = {
        contractVersion: "1.0",
        status,
        answer: draft.answer,
        grounding: this.uniqueObjects(
          usable.flatMap((result) => result.grounding),
        ),
        entityRefs: [...authorized.values()],
        freshnessNotes: this.unique([
          ...draft.freshnessNotes,
          ...freshnessNotes,
        ]),
        limitations: this.unique([...draft.limitations, ...limitations]),
        ...(navigation ? { navigation } : {}),
      };
      const validated = this.responses.validate(response, {
        invokedCapabilityIds: invoked.map((request) => request.capabilityId),
        authorizedEntityRefs: [...authorized.values()],
        allowedNavigationDestinationIds: navigation
          ? [navigation.destinationId]
          : [],
      });
      await this.conversations.appendAssistantResponse(
        actor,
        conversationId,
        validated,
      );
      this.telemetry.recordTurn({
        requestId,
        conversationId,
        brandProfileId: context.workspace.brandProfileId,
        capabilityIds: invoked.map((request) => request.capabilityId),
        responseStatus: validated.status,
        latencyMs: Date.now() - startedAt,
      });
      return validated;
    } catch (error) {
      if (context) {
        this.telemetry.recordTurn({
          requestId,
          conversationId,
          brandProfileId: context.workspace.brandProfileId,
          capabilityIds: invoked.map((request) => request.capabilityId),
          latencyMs: Date.now() - startedAt,
          errorCode:
            error instanceof Error
              ? error.name.slice(0, 128)
              : "CHAT_TURN_FAILURE",
        });
      }
      throw error;
    }
  }

  private boundHistory(
    messages:
      | readonly Readonly<{
          role: string;
          textContent: string | null;
        }>[]
      | null,
  ): readonly Readonly<{ role: "USER" | "ASSISTANT"; text: string }>[] {
    const selected: { role: "USER" | "ASSISTANT"; text: string }[] = [];
    let remaining = CHAT_HISTORY_MAX_TOTAL_CHARS;
    for (const message of [...(messages ?? [])].reverse()) {
      if (
        selected.length >= CHAT_HISTORY_MAX_MESSAGES ||
        remaining <= 0 ||
        !["USER", "ASSISTANT"].includes(message.role)
      ) {
        continue;
      }
      const text = (message.textContent ?? "").slice(
        0,
        Math.min(CHAT_HISTORY_MAX_MESSAGE_CHARS, remaining),
      );
      selected.push({ role: message.role as "USER" | "ASSISTANT", text });
      remaining -= text.length;
    }
    return selected.reverse();
  }

  private candidatesFrom(result: ChatCapabilityExecutionResult): Candidate[] {
    const labels = new Map<string, string>();
    if (result.capabilityId === "offering.list" && this.isRecord(result.data)) {
      const rows = Array.isArray(result.data.offerings)
        ? result.data.offerings
        : [];
      for (const row of rows) {
        if (this.isRecord(row) && typeof row.offeringId === "string") {
          if (typeof row.name === "string")
            labels.set(row.offeringId, row.name);
        }
      }
    }
    if (result.capabilityId === "campaign.list" && Array.isArray(result.data)) {
      for (const row of result.data) {
        if (this.isRecord(row) && typeof row.campaign_id === "string") {
          if (typeof row.campaign_name === "string") {
            labels.set(row.campaign_id, row.campaign_name);
          }
        }
      }
    }
    if (
      result.capabilityId === "collaboration.list" &&
      this.isRecord(result.data) &&
      Array.isArray(result.data.collaborations)
    ) {
      for (const row of result.data.collaborations) {
        if (!this.isRecord(row) || typeof row.collaborationId !== "string") {
          continue;
        }
        const campaign = this.isRecord(row.campaign) ? row.campaign : null;
        const creator = this.isRecord(row.creator) ? row.creator : null;
        const brief = this.isRecord(row.brief) ? row.brief : null;
        const campaignName =
          campaign && typeof campaign.name === "string"
            ? campaign.name
            : "Campaign";
        const displayName =
          creator && typeof creator.displayName === "string"
            ? creator.displayName
            : null;
        const instagramHandle =
          creator && typeof creator.instagramHandle === "string"
            ? creator.instagramHandle.replace(/^@/u, "")
            : null;
        const creatorLabel =
          displayName && displayName !== instagramHandle
            ? displayName
            : instagramHandle
              ? `@${instagramHandle}`
              : "Creator";
        const briefTitle =
          brief && typeof brief.title === "string" ? brief.title : "Brief";
        labels.set(
          row.collaborationId,
          `${campaignName} — ${creatorLabel} — ${briefTitle}`,
        );
      }
    }
    return result.authorizedEntityRefs.map((ref) => ({
      ...ref,
      ...(labels.has(ref.id) ? { label: labels.get(ref.id) } : {}),
    }));
  }

  private executionKey(request: CapabilityRequest): string {
    return `${request.capabilityId}:${JSON.stringify(this.canonicalize(request.input))}`;
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value))
      return value.map((item) => this.canonicalize(item));
    if (this.isRecord(value)) {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, this.canonicalize(value[key])]),
      );
    }
    return value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  private refKey(ref: ChatEntityRef): string {
    return `${ref.type}:${ref.id}`;
  }

  private unique(values: readonly string[]): string[] {
    return [...new Set(values)];
  }

  private uniqueObjects<T>(values: readonly T[]): T[] {
    const seen = new Set<string>();
    return values.filter((value) => {
      const key = JSON.stringify(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private destinationLabel(destinationId: string): string {
    return (
      {
        HOME: "Home",
        BRAND_CENTRE: "Brand Centre",
        OFFERINGS: "Offerings",
        CAMPAIGNS: "Campaigns",
        COLLABORATIONS: "Collaborations",
        SETTINGS: "Settings",
        SETTINGS_INTEGRATIONS: "Settings integrations",
        SETTINGS_BILLING: "Settings billing",
      }[destinationId] ?? "the requested destination"
    );
  }
}
