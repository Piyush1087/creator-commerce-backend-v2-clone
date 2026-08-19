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
  "CAMPAIGN_STATUS",
  "CAMPAIGN_CHECKLIST",
  "CAMPAIGN_PRODUCTS",
  "CAMPAIGN_BRIEF",
  "CAMPAIGN_INVITES",
  "CAMPAIGN_VALIDATE",
  "CAMPAIGN_PERFORMANCE",
  "COMPARE_CAMPAIGNS",
  "CAMPAIGN_FINANCIALS",
  "PAUSE_CAMPAIGN",
  "RESUME_CAMPAIGN",
  "GO_LIVE_CAMPAIGN",
  "ARCHIVE_CAMPAIGN",
  "DUPLICATE_CAMPAIGN",
  "BULK_CAMPAIGN_ACTION",
  "CAMPAIGN_EDIT_DRAFT",
]);

const CampaignClassifierOutputSchema = z.object({
  domain: z.enum(["CAMPAIGN_LIST", "OTHER"]),
  intent: CampaignListIntentSchema,
  campaignNameHint: z.string().nullable().optional(),
  campaignNameHintB: z.string().nullable().optional(),
  statusFilter: z
    .enum([
      "DRAFT",
      "PUBLISHED",
      "LIVE",
      "PAUSED",
      "COMPLETED",
      "ARCHIVED",
    ])
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
  | "GO_LIVE_CAMPAIGN"
  | "ARCHIVE_CAMPAIGN"
  | "DUPLICATE_CAMPAIGN"
  | "BULK_CAMPAIGN_ACTION"
  | "CAMPAIGN_EDIT_DRAFT"
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
  "CAMPAIGN_STATUS",
  "CAMPAIGN_CHECKLIST",
  "CAMPAIGN_PRODUCTS",
  "CAMPAIGN_BRIEF",
  "CAMPAIGN_INVITES",
  "CAMPAIGN_VALIDATE",
  "CAMPAIGN_PERFORMANCE",
  "COMPARE_CAMPAIGNS",
  "CAMPAIGN_FINANCIALS",
]);

const WRITE_INTENTS = new Set<string>([
  "PAUSE_CAMPAIGN",
  "RESUME_CAMPAIGN",
  "GO_LIVE_CAMPAIGN",
  "ARCHIVE_CAMPAIGN",
  "DUPLICATE_CAMPAIGN",
  "BULK_CAMPAIGN_ACTION",
  "CAMPAIGN_EDIT_DRAFT",
]);

const SYSTEM = `You are the intent classifier for The Creator Shop Brand Co-Pilot, Campaign List module only.

Return JSON only. Decide:
- domain=CAMPAIGN_LIST when the user is asking about listing/searching/filtering/sorting campaigns, campaign summary/status/checklist/products/brief/invites/performance/financials/compare/validate, or lifecycle actions (pause/resume/go-live/publish/archive/duplicate/rename/bulk), including typos and paraphrases.
- domain=OTHER for Brand DNA, planner blueprints, escrow, collaborations, greetings, or unrelated chat.

Canonical Campaign lifecycle is DRAFT → PUBLISHED → LIVE → PAUSED → LIVE, with COMPLETED and ARCHIVED terminal/history states. Do not invent or output ACTIVE as a Campaign lifecycle state.

Intent rules:
- "sort … by budget/name/spend" → SORT_CAMPAIGNS (never CAMPAIGN_FINANCIALS just because budget appears).
- "budget / spending / remaining / utilization for a campaign" → CAMPAIGN_FINANCIALS.
- "is it live / published / draft / current status / which stage" → CAMPAIGN_STATUS.
- "what's missing / checklist / why can't I go live / what should I do next" (campaign) → CAMPAIGN_CHECKLIST.
- "can I go live / is it execution-ready / why is go-live blocked" → CAMPAIGN_VALIDATE.
- "can I delete / delete campaign" → CAMPAIGN_VALIDATE (delete unsupported; guide to archive).
- "show products / which products" → CAMPAIGN_PRODUCTS.
- "show brief / creator guidelines / instructions" → CAMPAIGN_BRIEF.
- "invited / accepted / joined creators" → CAMPAIGN_INVITES.
- "go live / make live / activate published campaign" → GO_LIVE_CAMPAIGN (PUBLISHED → LIVE after execution-readiness validation). Never confuse with creating a new campaign (CAMPAIGN_LAUNCH).
- "publish X" may be user shorthand for making an already-published Campaign live; classify as GO_LIVE_CAMPAIGN with campaignNameHint and let lifecycle validation reject invalid current states rather than inventing a transition.
- "rename campaign … to …" → CAMPAIGN_EDIT_DRAFT with newCampaignName.
- "resume / unpause / restart" a paused campaign → RESUME_CAMPAIGN.
- "set/make … active" is user shorthand: classify as GO_LIVE_CAMPAIGN unless the campaign is clearly paused, in which case use RESUME_CAMPAIGN. Never map ACTIVE to a persisted status.
- "campaigns with X product" → SEARCH_CAMPAIGNS or FILTER_CAMPAIGNS with productHint.
- "draft / published / active / live / paused / completed / archived campaigns", "what about drafts" → FILTER_CAMPAIGNS with the matching canonical statusFilter. User word ACTIVE maps to LIVE only as a language alias.
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
