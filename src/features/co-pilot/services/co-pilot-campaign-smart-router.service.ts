import { Injectable } from "@nestjs/common";

import type { CoPilotChatPayload } from "../schemas/copilot-payload.schema";
import { CoPilotChatPayloadSchema } from "../schemas/copilot-payload.schema";
import type { DetectedWriteIntent } from "../core/write-intent.types";
import {
  fuzzyMatchNamedEntities,
  fuzzyMatchNamedEntity,
} from "../utils/co-pilot-fuzzy-match.util";
import { CampaignListToolsService } from "../modules/uce-campaign-list/campaign-list.tools";
import { UceCampaignListAiModule } from "../modules/uce-campaign-list/uce-campaign-list.ai-module";
import {
  CoPilotCampaignClassifierService,
  type CampaignClassifierOutput,
  type CampaignReadIntentKind,
  type CampaignWriteIntentKind,
} from "./co-pilot-campaign-classifier.service";
import {
  CoPilotConversationMemoryService,
  type CampaignMemoryRow,
} from "./co-pilot-conversation-memory.service";
import type { CoPilotScopeContext } from "@prisma/client";

export type SmartCampaignRouteResult =
  | { handled: false }
  | {
      handled: true;
      kind: "read";
      payload: CoPilotChatPayload;
    }
  | {
      handled: true;
      kind: "write";
      intent: Exclude<DetectedWriteIntent, { kind: "NONE" }>;
    };

@Injectable()
export class CoPilotCampaignSmartRouterService {
  constructor(
    private readonly classifier: CoPilotCampaignClassifierService,
    private readonly memory: CoPilotConversationMemoryService,
    private readonly tools: CampaignListToolsService,
    private readonly campaignListModule: UceCampaignListAiModule,
  ) {}

  async tryRoute(args: {
    brandProfileId: string;
    userId: string;
    threadId: string;
    messageId: string;
    userText: string;
    scopeContext: CoPilotScopeContext;
    history: Array<{ role: "USER" | "ASSISTANT"; text: string }>;
    authUser?: unknown;
  }): Promise<SmartCampaignRouteResult> {
    const catalog = await this.loadCatalog(args.brandProfileId, args.threadId);
    const mem = this.memory.getCampaignMemory(args.threadId);

    const classified = await this.classifier.classify({
      userText: args.userText,
      history: args.history,
      catalog,
      selectedCampaignName: mem?.selectedCampaignName,
    });

    if (
      !classified ||
      classified.domain !== "CAMPAIGN_LIST" ||
      classified.intent === "NONE" ||
      classified.confidence < 0.45
    ) {
      return { handled: false };
    }

    if (this.classifier.isWriteIntent(classified.intent)) {
      const intent = this.buildWriteIntent(
        { ...classified, intent: classified.intent },
        catalog,
        mem,
      );
      return { handled: true, kind: "write", intent };
    }

    if (this.classifier.isReadIntent(classified.intent)) {
      const payload = await this.executeRead(
        { ...classified, intent: classified.intent },
        catalog,
        args,
      );
      return { handled: true, kind: "read", payload };
    }

    return { handled: false };
  }

  private async loadCatalog(
    brandProfileId: string,
    threadId: string,
  ): Promise<CampaignMemoryRow[]> {
    const rows = await this.tools.listCampaigns(brandProfileId, {});
    const catalog = rows.map((c) => ({
      id: c.campaign_id,
      name: c.campaign_name,
      status: c.current_status,
    }));
    this.memory.rememberListedCampaigns(threadId, catalog);
    return catalog;
  }

  private buildWriteIntent(
    classified: CampaignClassifierOutput & { intent: CampaignWriteIntentKind },
    catalog: CampaignMemoryRow[],
    mem: ReturnType<CoPilotConversationMemoryService["getCampaignMemory"]>,
  ): Exclude<DetectedWriteIntent, { kind: "NONE" }> {
    const entities = catalog.map((c) => ({ id: c.id, name: c.name }));
    const matched = fuzzyMatchNamedEntity(
      classified.campaignNameHint,
      entities,
    );
    const fallbackSelected =
      !matched && mem?.selectedCampaignId
        ? entities.find((e) => e.id === mem.selectedCampaignId) ?? null
        : null;
    const campaign = matched ?? fallbackSelected;

    const stagedPayload: Record<string, unknown> = {
      campaign_name_hint: classified.campaignNameHint ?? undefined,
      bulk_action: classified.bulkAction ?? undefined,
      new_campaign_name: classified.newCampaignName ?? undefined,
    };

    if (campaign) {
      stagedPayload.campaign_id = campaign.id;
      stagedPayload.campaign_name = campaign.name;
    }

    const missingSlots: Exclude<
      DetectedWriteIntent,
      { kind: "NONE" }
    >["missingSlots"] = [];

    if (
      classified.intent !== "BULK_CAMPAIGN_ACTION" &&
      !stagedPayload.campaign_id
    ) {
      missingSlots.push({
        fieldName: "campaign_id",
        uiLabel: "Campaign",
        inputType: "SINGLE_SELECT",
        selectOptions: [],
        placeholderText: "Choose a campaign",
      });
    }

    if (
      classified.intent === "DUPLICATE_CAMPAIGN" &&
      !stagedPayload.new_campaign_name
    ) {
      missingSlots.push({
        fieldName: "new_campaign_name",
        uiLabel: "New campaign name",
        inputType: "TEXT",
        placeholderText: "e.g. Summer Sale Copy",
      });
    }

    if (classified.intent === "BULK_CAMPAIGN_ACTION") {
      if (!stagedPayload.bulk_action) {
        missingSlots.push({
          fieldName: "bulk_action",
          uiLabel: "Bulk action",
          inputType: "SINGLE_SELECT",
          selectOptions: ["PAUSE", "RESUME", "ARCHIVE"],
          placeholderText: "Choose action",
        });
      }
      missingSlots.push({
        fieldName: "campaign_ids",
        uiLabel: "Campaigns",
        inputType: "SINGLE_SELECT",
        selectOptions: [],
        placeholderText: "Choose a campaign",
      });
    }

    return {
      kind: classified.intent,
      stagedPayload,
      missingSlots,
    };
  }

  private async executeRead(
    classified: CampaignClassifierOutput & { intent: CampaignReadIntentKind },
    catalog: CampaignMemoryRow[],
    args: {
      brandProfileId: string;
      userId: string;
      threadId: string;
      messageId: string;
      userText: string;
      scopeContext: CoPilotScopeContext;
      history: Array<{ role: "USER" | "ASSISTANT"; text: string }>;
      authUser?: unknown;
    },
  ): Promise<CoPilotChatPayload> {
    const kind = classified.intent;
    const entities = catalog.map((c) => ({ id: c.id, name: c.name }));
    const mem = this.memory.getCampaignMemory(args.threadId);

    const primary =
      fuzzyMatchNamedEntity(classified.campaignNameHint, entities) ??
      (mem?.selectedCampaignId
        ? entities.find((e) => e.id === mem.selectedCampaignId) ?? null
        : null);

    const compareHints = [
      classified.campaignNameHint,
      classified.campaignNameHintB,
    ].filter((v): v is string => !!v && v.trim().length > 0);
    const compareMatches = fuzzyMatchNamedEntities(compareHints, entities);

    // Prefer classifier entities over re-parsing user text inside the module.
    const syntheticText = this.buildSyntheticReadText(classified, primary);

    const result = await this.campaignListModule.executeRead(kind, {
      brandProfileId: args.brandProfileId,
      userId: args.userId,
      userText: syntheticText,
      scopeContext: args.scopeContext,
      messageId: args.messageId,
      threadId: args.threadId,
      history: args.history,
      authUser: args.authUser,
      resolvedCampaignId: primary?.id,
      resolvedCampaignName: primary?.name,
      resolvedCompareIds: compareMatches.map((m) => m.id),
      classifierFilters: {
        status: classified.statusFilter ?? undefined,
        objective: classified.objectiveFilter ?? undefined,
        sortBy: classified.sortBy ?? undefined,
        search: classified.searchTerm ?? undefined,
        product: classified.productHint ?? undefined,
      },
    });

    if (
      result &&
      (kind === "LIST_CAMPAIGNS" ||
        kind === "SEARCH_CAMPAIGNS" ||
        kind === "FILTER_CAMPAIGNS" ||
        kind === "SORT_CAMPAIGNS")
    ) {
      // Refresh memory from live list after read.
      const listed = await this.tools.listCampaigns(args.brandProfileId, {
        status: classified.statusFilter ?? undefined,
        objective: classified.objectiveFilter ?? undefined,
        search: classified.searchTerm ?? undefined,
        product: classified.productHint ?? undefined,
        sortBy: classified.sortBy ?? undefined,
      });
      this.memory.rememberListedCampaigns(
        args.threadId,
        listed.map((c) => ({
          id: c.campaign_id,
          name: c.campaign_name,
          status: c.current_status,
        })),
      );
    }

    if (primary && result) {
      this.memory.rememberSelectedCampaign(args.threadId, {
        id: primary.id,
        name: primary.name,
      });
    }

    if (!result) {
      return CoPilotChatPayloadSchema.parse({
        messageId: args.messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText:
          "I understood a campaign question, but couldn’t build a response. Try listing campaigns first.",
      });
    }

    return CoPilotChatPayloadSchema.parse({
      messageId: args.messageId,
      threadId: args.threadId,
      timestamp: new Date().toISOString(),
      formatType: result.formatType,
      narrativeText: result.narrativeText,
      metricGridData: result.metricGridData,
      tableData: result.tableData,
    });
  }

  private buildSyntheticReadText(
    classified: CampaignClassifierOutput,
    primary: { id: string; name: string } | null,
  ): string {
    const parts = [`intent:${classified.intent}`];
    if (primary) parts.push(`campaign ${primary.name}`);
    if (classified.statusFilter) parts.push(classified.statusFilter.toLowerCase());
    if (classified.objectiveFilter) {
      parts.push(classified.objectiveFilter.toLowerCase().replace(/_/g, " "));
    }
    if (classified.sortBy) parts.push(`sort by ${classified.sortBy}`);
    if (classified.searchTerm) parts.push(`search ${classified.searchTerm}`);
    if (classified.productHint) parts.push(`product ${classified.productHint}`);
    if (classified.campaignNameHintB) {
      parts.push(`compare ${classified.campaignNameHint} with ${classified.campaignNameHintB}`);
    }
    return parts.join(" ");
  }
}
