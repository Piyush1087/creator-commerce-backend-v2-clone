import type { UceCampaignObjective, UceCampaignStatus } from "@prisma/client";

import type { ReadQueryKind } from "../../core/read-kind.types";
import type { DetectedWriteIntent } from "../../core/write-intent.types";
import type { SlotFillingData } from "../../schemas/copilot-payload.schema";

const OBJECTIVES: UceCampaignObjective[] = [
  "BRAND_AWARENESS",
  "TRAFFIC_CLICKS",
  "SALES_CONVERSIONS",
];

const STATUSES: UceCampaignStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "LIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
];

const SORT_OPTIONS = ["updatedAt", "name", "budget", "spend"] as const;

export function extractCampaignNameHint(userText: string): string | undefined {
  const quoted = userText.match(/["']([^"']+)["']/)?.[1]?.trim();
  if (quoted) {
    return quoted;
  }

  const patterns = [
    /(?:pause|resume|archive|duplicate|clone|summarize|summary of|overview of|performance of|budget for|financials for|spending for|publish|go live|go-live|activate|rename|delete|status of|products? (?:in|for)|brief for|invites? for|checklist for)\s+(?:campaign\s+)?(.+)$/i,
    /(?:campaign)\s+["']?([^"']+?)["']?(?:\s+campaign)?$/i,
  ];
  for (const pattern of patterns) {
    const match = userText.match(pattern)?.[1]?.trim();
    if (match && match.length >= 2 && match.length <= 80) {
      const cleaned = match
        .replace(/\b(please|now|campaign|can you|could you)\b/gi, "")
        .replace(/[?.!]+$/, "")
        .trim();
      if (
        !cleaned ||
        /^(my|all|the|a|an)$/i.test(cleaned) ||
        /^(my|all|the)\s+campaigns?$/i.test(match.trim())
      ) {
        continue;
      }
      return cleaned;
    }
  }
  return undefined;
}

export function extractStatusFilter(
  normalized: string,
): UceCampaignStatus | undefined {
  if (/\blive\b/.test(normalized) || /\brunning\b/.test(normalized)) {
    return "LIVE";
  }
  if (/\bpublished\b/.test(normalized)) {
    return "PUBLISHED";
  }
  if (/\bactive\b/.test(normalized)) {
    return "LIVE";
  }
  if (/\bpaused\b/.test(normalized)) {
    return "PAUSED";
  }
  if (/\bdraft\b/.test(normalized)) {
    return "DRAFT";
  }
  if (/\bcompleted\b/.test(normalized)) {
    return "COMPLETED";
  }
  if (/\barchived\b/.test(normalized)) {
    return "ARCHIVED";
  }
  return undefined;
}

export function extractObjectiveFilter(
  normalized: string,
): UceCampaignObjective | undefined {
  if (normalized.includes("awareness")) {
    return "BRAND_AWARENESS";
  }
  if (normalized.includes("traffic") || normalized.includes("clicks")) {
    return "TRAFFIC_CLICKS";
  }
  if (
    normalized.includes("sales") ||
    normalized.includes("conversion") ||
    normalized.includes("conversions")
  ) {
    return "SALES_CONVERSIONS";
  }
  return undefined;
}

export function extractSortBy(
  normalized: string,
): (typeof SORT_OPTIONS)[number] | undefined {
  if (normalized.includes("sort by name") || normalized.includes("by name")) {
    return "name";
  }
  if (normalized.includes("sort by budget") || normalized.includes("by budget")) {
    return "budget";
  }
  if (
    normalized.includes("sort by spend") ||
    normalized.includes("by spend") ||
    normalized.includes("by spending")
  ) {
    return "spend";
  }
  if (
    normalized.includes("sort by updated") ||
    normalized.includes("recently updated")
  ) {
    return "updatedAt";
  }
  return undefined;
}

export function extractSearchTerm(userText: string, normalized: string): string | undefined {
  const searchMatch = userText.match(
    /(?:search|find|show)\s+(.+?)\s+campaigns?/i,
  )?.[1]?.trim();
  if (searchMatch && !/^(my|all|the|active|paused|draft)$/i.test(searchMatch)) {
    return searchMatch;
  }
  if (normalized.includes("skincare")) {
    return "skincare";
  }
  return undefined;
}

export function detectCampaignListRead(userText: string): ReadQueryKind | null {
  const n = userText.toLowerCase().trim();
  const mentionsCampaign =
    n.includes("campaign") ||
    /\b(publish|go live|go-live|checklist|draft)\b/.test(n);

  // Validation / blockers first
  if (
    (/\b(can i|why can'?t i|why cannot i|is (?:this|it) ready|why is publishing blocked)\b/.test(
      n,
    ) &&
      (mentionsCampaign ||
        /\b(publish|delete|go live|activate)\b/.test(n))) ||
    (/\b(why can'?t i publish|what'?s missing|pending checklist|what do i need to complete|what'?s blocking this campaign|why can'?t i continue|show pending work)\b/.test(
      n,
    ) &&
      (mentionsCampaign ||
        /\b(publish|checklist|missing|blocking|pending)\b/.test(n)))
  ) {
    if (
      /\b(checklist|missing|complete|blocking|pending|ready|publish)\b/.test(n) ||
      /\bcan i (?:publish|go live|activate)\b/.test(n) ||
      /\bis this campaign ready\b/.test(n)
    ) {
      if (/\bcan i delete\b/.test(n) || /\bdelete this campaign\b/.test(n)) {
        return "CAMPAIGN_VALIDATE";
      }
      if (
        /\b(can i publish|can i go live|is (?:this|the)?\s*campaign ready|why is publishing blocked|why can'?t i publish)\b/.test(
          n,
        )
      ) {
        return "CAMPAIGN_VALIDATE";
      }
      return "CAMPAIGN_CHECKLIST";
    }
    if (/\bdelete\b/.test(n)) {
      return "CAMPAIGN_VALIDATE";
    }
  }

  if (
    /\b(what should i do next|what'?s pending|show pending checklist|pending checklist items)\b/.test(
      n,
    ) &&
    (mentionsCampaign || /\bchecklist\b/.test(n))
  ) {
    return "CAMPAIGN_CHECKLIST";
  }

  if (
    n.includes("compare") &&
    (n.includes("campaign") || n.includes(" vs ") || n.includes("versus"))
  ) {
    return "COMPARE_CAMPAIGNS";
  }

  if (
    (n.includes("budget") ||
      n.includes("spending") ||
      n.includes("financial") ||
      n.includes("remaining budget") ||
      n.includes("utilization")) &&
    n.includes("campaign")
  ) {
    return "CAMPAIGN_FINANCIALS";
  }

  // Invites before generic analytics ("how many creators accepted")
  if (
    /\b(invited creators?|creator invites?|accepted creators?|rejected creators?|who joined this campaign|how many creators (?:are )?invited|show (?:accepted|rejected|invited) creators)\b/.test(
      n,
    ) ||
    (/\bcreators?\b/.test(n) &&
      /\b(invited|invite|accepted|rejected|joined)\b/.test(n) &&
      mentionsCampaign)
  ) {
    return "CAMPAIGN_INVITES";
  }

  if (
    (n.includes("performance") ||
      n.includes("roi") ||
      n.includes("kpi") ||
      n.includes("campaign progress") ||
      n.includes("campaign statistics") ||
      n.includes("campaign stats") ||
      n.includes("which campaign performed")) &&
    (n.includes("campaign") || n.includes("performed best"))
  ) {
    return "CAMPAIGN_PERFORMANCE";
  }

  if (
    /\b(campaign products?|products? (?:in|for|added to) (?:this )?campaign|which products|how many products|show products)\b/.test(
      n,
    ) &&
    (mentionsCampaign || /\bproducts?\b/.test(n))
  ) {
    return "CAMPAIGN_PRODUCTS";
  }

  if (
    /\b(campaign brief|show brief|explain (?:the )?brief|creator guidelines|what instructions|brief for)\b/.test(
      n,
    ) &&
    (mentionsCampaign || /\bbrief\b/.test(n) || /\bguidelines\b/.test(n))
  ) {
    return "CAMPAIGN_BRIEF";
  }

  if (
    /\b(is (?:my|this|the)?\s*campaign (?:live|still a draft|active|paused)|current status|which stage is my campaign|campaign status|is .+ live)\b/.test(
      n,
    ) ||
    (/\bstatus\b/.test(n) && mentionsCampaign && !/\bsummary\b/.test(n))
  ) {
    return "CAMPAIGN_STATUS";
  }

  if (
    (n.includes("summarize") ||
      n.includes("summary") ||
      n.includes("overview") ||
      n.includes("tell me about") ||
      n.includes("explain this campaign") ||
      n.includes("what's happening in this campaign") ||
      n.includes("campaign details") ||
      n.includes("campaign information") ||
      n.includes("show campaign details")) &&
    n.includes("campaign")
  ) {
    const nameHint = extractCampaignNameHint(userText);
    const fleetAsk =
      /\bcampaigns\b/.test(n) ||
      !nameHint ||
      /^(my|all|the)?\s*campaigns?$/i.test(nameHint);
    // Single-campaign overview phrases should not fall back to fleet list
    const singleOverview =
      /\b(tell me about|campaign details|campaign information|explain this|what'?s happening in this|give me campaign summary|campaign overview)\b/.test(
        n,
      ) || Boolean(nameHint && !fleetAsk);
    if (fleetAsk && !singleOverview) {
      if (extractStatusFilter(n) || extractObjectiveFilter(n)) {
        return "FILTER_CAMPAIGNS";
      }
      return "LIST_CAMPAIGNS";
    }
    return "CAMPAIGN_SUMMARY";
  }

  if (n.includes("sort") && n.includes("campaign")) {
    return "SORT_CAMPAIGNS";
  }

  if (
    (n.includes("filter") || extractStatusFilter(n) || extractObjectiveFilter(n)) &&
    n.includes("campaign")
  ) {
    if (extractStatusFilter(n) || extractObjectiveFilter(n) || n.includes("filter")) {
      return "FILTER_CAMPAIGNS";
    }
  }

  if (
    (n.includes("search") || n.includes("find")) &&
    n.includes("campaign")
  ) {
    return "SEARCH_CAMPAIGNS";
  }

  if (
    n.includes("show my campaigns") ||
    n.includes("list campaigns") ||
    n.includes("list all campaigns") ||
    n.includes("open campaign list") ||
    n.includes("show campaigns") ||
    n.includes("what campaigns are running") ||
    n.includes("show running campaigns") ||
    n.includes("show active campaigns") ||
    n.includes("campaigns created this month") ||
    (n.includes("what about") && n.includes("campaign")) ||
    (n.includes("campaigns") &&
      (n.includes("show") ||
        n.includes("list") ||
        n.includes("open") ||
        n.includes("draft")))
  ) {
    if (extractStatusFilter(n) || extractObjectiveFilter(n)) {
      return "FILTER_CAMPAIGNS";
    }
    return "LIST_CAMPAIGNS";
  }

  if (/\bdelete\b/.test(n) && n.includes("campaign")) {
    return "CAMPAIGN_VALIDATE";
  }

  return null;
}

function campaignSelectSlot(
  fieldName = "campaign_id",
  uiLabel = "Campaign",
): SlotFillingData["missingSlots"][number] {
  return {
    fieldName,
    uiLabel,
    inputType: "SINGLE_SELECT",
    selectOptions: [],
    placeholderText: "Choose a campaign",
  };
}

export function detectCampaignListWrite(
  userText: string,
): DetectedWriteIntent | null {
  const n = userText.toLowerCase().trim();
  const nameHint = extractCampaignNameHint(userText);

  if (
    n.includes("pause all") ||
    n.includes("archive all") ||
    n.includes("resume all") ||
    n.includes("bulk") ||
    (n.includes("pause all expired") ||
      n.includes("archive completed") ||
      n.includes("resume paused campaigns"))
  ) {
    let action: "PAUSE" | "RESUME" | "ARCHIVE" | undefined;
    if (n.includes("pause")) action = "PAUSE";
    if (n.includes("resume")) action = "RESUME";
    if (n.includes("archive")) action = "ARCHIVE";

    return {
      kind: "BULK_CAMPAIGN_ACTION",
      stagedPayload: {
        bulk_action: action,
        status_filter: extractStatusFilter(n),
      },
      missingSlots: (
        [
          {
            fieldName: "bulk_action",
            uiLabel: "Bulk action",
            inputType: "SINGLE_SELECT" as const,
            selectOptions: ["PAUSE", "RESUME", "ARCHIVE"],
            placeholderText: "Choose action",
          },
          {
            fieldName: "campaign_ids",
            uiLabel: "Campaigns (comma-separated ids or pick from list)",
            inputType: "TEXT" as const,
            placeholderText:
              "Paste campaign ids or use the select list in a follow-up",
          },
        ] satisfies SlotFillingData["missingSlots"]
      ).filter((slot) => {
        if (slot.fieldName === "bulk_action" && action) {
          return false;
        }
        return true;
      }),
    };
  }

  if (
    (n.includes("duplicate") || n.includes("clone")) &&
    n.includes("campaign")
  ) {
    const newName = userText.match(
      /(?:as|named|name(?:d)?)\s+["']?([^"']+)["']?/i,
    )?.[1]?.trim();
    const missingSlots: SlotFillingData["missingSlots"] = [
      campaignSelectSlot(),
    ];
    if (!newName) {
      missingSlots.push({
        fieldName: "new_campaign_name",
        uiLabel: "New campaign name",
        inputType: "TEXT",
        placeholderText: "e.g. Summer Sale Copy",
      });
    }
    return {
      kind: "DUPLICATE_CAMPAIGN",
      stagedPayload: {
        campaign_name_hint: nameHint,
        new_campaign_name: newName,
      },
      missingSlots,
    };
  }

  if (n.includes("pause") && n.includes("campaign")) {
    return {
      kind: "PAUSE_CAMPAIGN",
      stagedPayload: { campaign_name_hint: nameHint },
      missingSlots: [campaignSelectSlot()],
    };
  }

  if (
    (n.includes("go live") ||
      n.includes("go-live") ||
      n.includes("publish") ||
      (n.includes("make") && n.includes("live")) ||
      (n.includes("activate") && (n.includes("campaign") || n.includes("draft")))) &&
    !n.includes("resume") &&
    !n.includes("launch a campaign") &&
    !n.includes("create a campaign") &&
    !n.includes("create campaign")
  ) {
    return {
      kind: "GO_LIVE_CAMPAIGN",
      stagedPayload: { campaign_name_hint: nameHint },
      missingSlots: [campaignSelectSlot()],
    };
  }

  if (
    (n.includes("resume") || n.includes("restart") || n.includes("unpause")) &&
    n.includes("campaign")
  ) {
    return {
      kind: "RESUME_CAMPAIGN",
      stagedPayload: { campaign_name_hint: nameHint },
      missingSlots: [campaignSelectSlot()],
    };
  }

  if (
    (/\b(set|make)\b/.test(n) && /\b(active|live)\b/.test(n) && n.includes("campaign")) ||
    (n.includes("set") && n.includes("active"))
  ) {
    // Ambiguous activate — prefer go-live wording handled above; default resume/go-live via enrich by status.
    return {
      kind: "GO_LIVE_CAMPAIGN",
      stagedPayload: { campaign_name_hint: nameHint },
      missingSlots: [campaignSelectSlot()],
    };
  }

  if (
    (n.includes("archive") || n.includes("close campaign")) &&
    n.includes("campaign")
  ) {
    return {
      kind: "ARCHIVE_CAMPAIGN",
      stagedPayload: { campaign_name_hint: nameHint },
      missingSlots: [campaignSelectSlot()],
    };
  }

  // Rename draft campaign name via CAMPAIGN_EDIT_DRAFT HITL
  if (/\brename\b/.test(n) && n.includes("campaign")) {
    const newName =
      userText.match(
        /(?:to|as|named|name(?:d)?)\s+["']?([^"']+)["']?/i,
      )?.[1]?.trim() ?? undefined;
    const missingSlots: SlotFillingData["missingSlots"] = [
      campaignSelectSlot(),
    ];
    if (!newName) {
      missingSlots.push({
        fieldName: "campaign_name",
        uiLabel: "New campaign name",
        inputType: "TEXT",
        placeholderText: "e.g. Summer Sale 2026",
      });
    }
    return {
      kind: "CAMPAIGN_EDIT_DRAFT",
      stagedPayload: {
        campaign_name_hint: nameHint,
        campaign_name: newName,
        rename_only: true,
      },
      missingSlots,
    };
  }

  // Delete is not supported — leave for CAMPAIGN_VALIDATE read path
  if (/\bdelete\b/.test(n) && n.includes("campaign")) {
    return null;
  }

  return null;
}

export function parseCompareCampaignHints(userText: string): string[] {
  const vs = userText.match(
    /compare\s+(.+?)\s+(?:with|vs\.?|versus|and)\s+(.+)$/i,
  );
  if (vs) {
    return [vs[1].trim(), vs[2].trim()].map((s) =>
      s.replace(/^campaign\s+/i, "").replace(/[?.!]+$/, "").trim(),
    );
  }
  return [];
}

export { OBJECTIVES, STATUSES, SORT_OPTIONS };
