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
  "ACTIVE",
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
    /(?:pause|resume|archive|duplicate|clone|summarize|summary of|overview of|performance of|budget for|financials for|spending for)\s+(?:campaign\s+)?(.+)$/i,
    /(?:campaign)\s+["']?([^"']+?)["']?(?:\s+campaign)?$/i,
  ];
  for (const pattern of patterns) {
    const match = userText.match(pattern)?.[1]?.trim();
    if (match && match.length >= 2 && match.length <= 80) {
      const cleaned = match
        .replace(/\b(please|now|campaign)\b/gi, "")
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
  if (/\bactive\b/.test(normalized) || /\brunning\b/.test(normalized)) {
    return "ACTIVE";
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

  if (
    (n.includes("performance") ||
      n.includes("roi") ||
      n.includes("kpi") ||
      n.includes("which campaign performed")) &&
    (n.includes("campaign") || n.includes("performed best"))
  ) {
    return "CAMPAIGN_PERFORMANCE";
  }

  if (
    (n.includes("summarize") ||
      n.includes("summary") ||
      n.includes("overview of")) &&
    n.includes("campaign")
  ) {
    // Fleet overview ("summarize my campaigns") → list, not a single-campaign summary.
    const nameHint = extractCampaignNameHint(userText);
    const fleetAsk =
      /\bcampaigns\b/.test(n) ||
      !nameHint ||
      /^(my|all|the)?\s*campaigns?$/i.test(nameHint);
    if (fleetAsk) {
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
    // "show active campaigns" / "what about draft campaigns" → filtered list
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
    (n.includes("archive") || n.includes("close campaign")) &&
    n.includes("campaign")
  ) {
    return {
      kind: "ARCHIVE_CAMPAIGN",
      stagedPayload: { campaign_name_hint: nameHint },
      missingSlots: [campaignSelectSlot()],
    };
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
