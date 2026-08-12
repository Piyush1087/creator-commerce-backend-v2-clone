import type { CoPilotScopeContext } from "@prisma/client";

import type {
  CoPilotChatPayload,
  ExecutionWidgetData,
} from "../schemas/copilot-payload.schema";
import type { ReadQueryKind } from "./read-kind.types";
import type {
  DetectedWriteIntent,
  WriteIntentKind,
} from "./write-intent.types";

export type CoPilotModuleReadContext = {
  brandProfileId: string;
  userId: string;
  userText: string;
  scopeContext: CoPilotScopeContext;
  messageId: string;
  threadId: string;
  history: Array<{ role: "USER" | "ASSISTANT"; text: string }>;
  authUser?: unknown;
  /** Optional pre-resolved entity context from smart classifier. */
  resolvedCampaignId?: string;
  resolvedCampaignName?: string;
  resolvedCompareIds?: string[];
  classifierFilters?: {
    status?:
      | "DRAFT"
      | "PUBLISHED"
      | "LIVE"
      | "PAUSED"
      | "COMPLETED"
      | "ARCHIVED";
    objective?: "BRAND_AWARENESS" | "TRAFFIC_CLICKS" | "SALES_CONVERSIONS";
    sortBy?: "updatedAt" | "name" | "budget" | "spend";
    search?: string;
    product?: string;
  };
};

export type CoPilotModuleReadResult = Pick<
  CoPilotChatPayload,
  | "formatType"
  | "narrativeText"
  | "metricGridData"
  | "tableData"
  | "validationChecklistData"
> & {
  toolsInvoked?: string[];
};

/**
 * Pluggable AI domain module. Domain business logic stays in feature services;
 * modules only detect intents, call services, and map responses.
 */
export interface CoPilotAiModule {
  readonly id: string;
  readonly name: string;
  readonly supportedReadKinds: readonly ReadQueryKind[];
  readonly supportedWriteIntents: readonly WriteIntentKind[];
  /** Appended to core system prompt when this module may be in play. */
  readonly promptExtension?: string;
  detectRead(
    userText: string,
    scopeContext: CoPilotScopeContext,
  ): ReadQueryKind | null;
  detectWrite(
    userText: string,
    history: Array<{ role: "USER" | "ASSISTANT"; text: string }>,
  ): DetectedWriteIntent | null;
  executeRead(
    kind: ReadQueryKind,
    ctx: CoPilotModuleReadContext,
  ): Promise<CoPilotModuleReadResult | null>;
  enrichWriteIntent?(
    intent: Exclude<DetectedWriteIntent, { kind: "NONE" }>,
    brandProfileId: string,
    context?: {
      history: Array<{ role: "USER" | "ASSISTANT"; text: string }>;
      userText: string;
      authUser?: unknown;
      threadId?: string;
    },
  ): Promise<Exclude<DetectedWriteIntent, { kind: "NONE" }>>;
  buildExecutionWidget?(args: {
    intentKind: WriteIntentKind;
    stagedPayload: Record<string, unknown>;
    idempotencyKey: string;
  }): ExecutionWidgetData | null;
  writeSlotNarrative?(
    kind: WriteIntentKind,
    stagedPayload?: Record<string, unknown>,
  ): string | null;
  hitlReviewNarrative?(
    kind: WriteIntentKind,
    stagedPayload?: Record<string, unknown>,
  ): string | null;
}

export const CO_PILOT_AI_MODULES = Symbol("CO_PILOT_AI_MODULES");
