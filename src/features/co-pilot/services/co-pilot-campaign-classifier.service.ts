import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { zodToGeminiResponseSchema } from "../../brand-centre/prompts/zod-to-gemini-response-schema.util";
import type { ReadQueryKind } from "../core/read-kind.types";
import type { CampaignMemoryRow } from "./co-pilot-conversation-memory.service";

const CampaignListIntentSchema = z.enum([
  "NONE",
  "LIST_CAMPAIGNS",
  "SEARCH_CAMPAIGNS",
  "FILTER_CAMPAIGNS",
  "SORT_CAMPAIGNS",
  "CAMPAIGN_SUMMARY",
  "CAMPAIGN_PERFORMANCE",
  "COMPARE_CAMPAIGNS",
  "CAMPAIGN_FINANCIALS",
  "PAUSE_CAMPAIGN",
  "RESUME_CAMPAIGN",
  "ARCHIVE_CAMPAIGN",
  "DUPLICATE_CAMPAIGN",
  "BULK_CAMPAIGN_ACTION",
]);

const CampaignClassifierOutputSchema = z.object({
  domain: z.enum(["CAMPAIGN_LIST", "OTHER"]),
  intent: CampaignListIntentSchema,
  campaignNameHint: z.string().nullable().optional(),
  campaignNameHintB: z.string().nullable().optional(),
  statusFilter: z
    .enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"])
    .nullable()
    .optional(),
  objectiveFilter: z
    .enum(["BRAND_AWARENESS", "TRAFFIC_CLICKS", "SALES_CONVERSIONS"])
    .nullable()
    .optional(),
  sortBy: z
    .enum(["updatedAt", "name", "budget", "spend"])
    .nullable()
    .optional(),
  searchTerm: z.string().nullable().optional(),
  productHint: z.string().nullable().optional(),
  newCampaignName: z.string().nullable().optional(),
  bulkAction: z.enum(["PAUSE", "RESUME", "ARCHIVE"]).nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export type CampaignClassifierOutput = z.infer<
  typeof CampaignClassifierOutputSchema
>;

export type CampaignWriteIntentKind = Extract<
  CampaignClassifierOutput["intent"],
  | "PAUSE_CAMPAIGN"
  | "RESUME_CAMPAIGN"
  | "ARCHIVE_CAMPAIGN"
  | "DUPLICATE_CAMPAIGN"
  | "BULK_CAMPAIGN_ACTION"
>;

export type CampaignReadIntentKind = Extract<
  CampaignClassifierOutput["intent"],
  ReadQueryKind
>;

const READ_INTENTS = new Set<string>([
  "LIST_CAMPAIGNS",
  "SEARCH_CAMPAIGNS",
  "FILTER_CAMPAIGNS",
  "SORT_CAMPAIGNS",
  "CAMPAIGN_SUMMARY",
  "CAMPAIGN_PERFORMANCE",
  "COMPARE_CAMPAIGNS",
  "CAMPAIGN_FINANCIALS",
]);

const WRITE_INTENTS = new Set<string>([
  "PAUSE_CAMPAIGN",
  "RESUME_CAMPAIGN",
  "ARCHIVE_CAMPAIGN",
  "DUPLICATE_CAMPAIGN",
  "BULK_CAMPAIGN_ACTION",
]);

const SYSTEM = `You are the intent classifier for The Creator Shop Brand Co-Pilot, Campaign List module only.

Return JSON only. Decide:
- domain=CAMPAIGN_LIST when the user is asking about listing/searching/filtering/sorting campaigns, campaign summary/performance/financials/compare, or lifecycle actions (pause/resume/archive/duplicate/bulk), including typos and paraphrases.
- domain=OTHER for Brand DNA, planner blueprints, escrow, collaborations, greetings, or unrelated chat.

Intent rules:
- "sort … by budget/name/spend" → SORT_CAMPAIGNS (never CAMPAIGN_FINANCIALS just because budget appears).
- "budget / spending / remaining / utilization for a campaign" → CAMPAIGN_FINANCIALS.
- "set/make … active" or "unpause/restart" → RESUME_CAMPAIGN.
- "campaigns with X product" → SEARCH_CAMPAIGNS or FILTER_CAMPAIGNS with productHint.
- "draft / active / paused / archived campaigns", "what about drafts" → FILTER_CAMPAIGNS with matching statusFilter (never invent empty results).
- "summarize my campaigns" (plural / no single name) → LIST_CAMPAIGNS (or FILTER if status given), not CAMPAIGN_SUMMARY.
- compare without two names still → COMPARE_CAMPAIGNS.
- If unsure between list variants, prefer LIST_CAMPAIGNS.
- Extract campaign name hints even with typos; do not invent campaigns not in CATALOG.
- confidence < 0.45 → intent NONE and domain OTHER unless clearly campaign lifecycle.`;

@Injectable()
export class CoPilotCampaignClassifierService {
  private readonly logger = new Logger(CoPilotCampaignClassifierService.name);

  constructor(private readonly gemini: GeminiJsonClient) {}

  isReadIntent(intent: string): intent is CampaignReadIntentKind {
    return READ_INTENTS.has(intent);
  }

  isWriteIntent(intent: string): intent is CampaignWriteIntentKind {
    return WRITE_INTENTS.has(intent);
  }

  async classify(args: {
    userText: string;
    history: Array<{ role: "USER" | "ASSISTANT"; text: string }>;
    catalog: CampaignMemoryRow[];
    selectedCampaignName?: string;
  }): Promise<CampaignClassifierOutput | null> {
    const historyBlock =
      args.history.length > 0
        ? args.history
            .slice(-6)
            .map((m) => `${m.role}: ${m.text}`)
            .join("\n")
        : "(none)";

    const catalogBlock =
      args.catalog.length > 0
        ? args.catalog
            .slice(0, 40)
            .map((c) => `- ${c.name} [${c.status}] (${c.id})`)
            .join("\n")
        : "(no campaigns loaded)";

    const userText = [
      `CATALOG:`,
      catalogBlock,
      ``,
      `SELECTED_CAMPAIGN: ${args.selectedCampaignName ?? "(none)"}`,
      ``,
      `RECENT_THREAD:`,
      historyBlock,
      ``,
      `USER_MESSAGE:`,
      args.userText,
    ].join("\n");

    try {
      const raw = await this.gemini.generateJson({
        systemInstruction: SYSTEM,
        userText,
        responseSchema: zodToGeminiResponseSchema(CampaignClassifierOutputSchema),
        temperature: 0.1,
      });
      return CampaignClassifierOutputSchema.parse(raw);
    } catch (err) {
      this.logger.warn(`campaign classifier failed: ${String(err)}`);
      return null;
    }
  }
}
