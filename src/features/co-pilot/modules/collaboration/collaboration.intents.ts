import type { ReadQueryKind } from "../../core/read-kind.types";
import type { DetectedWriteIntent } from "../../core/write-intent.types";
import type { SlotFillingData } from "../../schemas/copilot-payload.schema";
import { extractStageFilter } from "./collaboration.stages";

function collaborationSlot(
  fieldName: string,
  uiLabel: string,
  placeholderText: string,
): SlotFillingData["missingSlots"][number] {
  return {
    fieldName,
    uiLabel,
    inputType: "SINGLE_SELECT",
    selectOptions: [],
    placeholderText,
  };
}

export function extractCreatorOrCampaignHint(
  userText: string,
): string | undefined {
  const quoted = userText.match(/["']([^"']+)["']/)?.[1]?.trim();
  if (quoted) {
    return quoted;
  }

  const patterns = [
    /(?:counter(?:[- ]offer)?|accept(?: terms)?|fund escrow|dispatch|ship|approve content|request revision|reject content|verify compliance|status of|show|open)\s+(?:collab(?:oration)?\s+(?:with\s+)?)?(.+)$/i,
    /(?:with|for)\s+([A-Za-z0-9_\-.@ ]{2,60})$/i,
  ];
  for (const pattern of patterns) {
    const match = userText.match(pattern)?.[1]?.trim();
    if (!match || match.length < 2 || match.length > 80) {
      continue;
    }
    const cleaned = match
      .replace(
        /\b(please|now|collaboration|collab|campaign|can you|could you|the|a|an)\b/gi,
        "",
      )
      .replace(/[?.!]+$/, "")
      .trim();
    if (
      !cleaned ||
      /^(my|all|the|a|an|active|pending)$/i.test(cleaned) ||
      /^(all|my)\s+collabs?/i.test(match.trim())
    ) {
      continue;
    }
    return cleaned;
  }
  return undefined;
}

export function extractCounterOfferAmount(
  userText: string,
): number | undefined {
  const money = userText.match(
    /(?:₹|rs\.?\s*|inr\s*)?(\d{2,7}(?:\.\d{1,2})?)/i,
  )?.[1];
  if (!money) {
    return undefined;
  }
  const value = Number(money);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function extractTrackingHint(userText: string): {
  tracking_id?: string;
  courier_name?: string;
} {
  const tracking =
    userText.match(
      /(?:tracking(?:\s*(?:id|number|#))?|awb)[:\s]+([A-Za-z0-9\-]+)/i,
    )?.[1] ??
    userText.match(/\b([A-Z0-9]{8,})\b/)?.[1];
  const courier = userText.match(
    /(?:courier|via|with)\s+(bluedart|delhivery|fedex|dhl|dtdc|india post|shadowfax|[A-Za-z]{3,20})/i,
  )?.[1];
  return {
    tracking_id: tracking,
    courier_name: courier,
  };
}

export function detectCollaborationRead(userText: string): ReadQueryKind | null {
  const n = userText.toLowerCase().trim();

  const mentionsCollab =
    n.includes("collaboration") ||
    n.includes("collab") ||
    n.includes("logistics") ||
    n.includes("fulfillment") ||
    n.includes("fulfililment") ||
    n.includes("content review") ||
    n.includes("negotiation") ||
    (n.includes("pipeline") &&
      (n.includes("creator") || n.includes("collab")));

  if (!mentionsCollab) {
    return null;
  }

  if (
    n.includes("issue") ||
    n.includes("rejection") ||
    n.includes("fulfillment") ||
    n.includes("stuck") ||
    n.includes("blocked")
  ) {
    return "COLLAB_ISSUES";
  }

  if (
    (n.includes("status") ||
      n.includes("detail") ||
      n.includes("overview") ||
      n.includes("summary") ||
      n.includes("where is") ||
      n.includes("what's the stage") ||
      n.includes("what stage")) &&
    (n.includes("collab") ||
      n.includes("collaboration") ||
      extractCreatorOrCampaignHint(userText))
  ) {
    return "COLLAB_STATUS";
  }

  // Stage filter still uses pipeline table
  if (extractStageFilter(n)) {
    return "COLLAB_PIPELINE";
  }

  if (
    n.includes("list") ||
    n.includes("show") ||
    n.includes("pipeline") ||
    n.includes("active collab") ||
    n.includes("my collab") ||
    n.includes("collaborations") ||
    n.includes("collabs")
  ) {
    return "COLLAB_PIPELINE";
  }

  return "COLLAB_PIPELINE";
}

export function detectCollaborationWrite(
  userText: string,
): DetectedWriteIntent | null {
  const n = userText.toLowerCase().trim();
  const hint = extractCreatorOrCampaignHint(userText);

  if (
    /\b(counter(?:[- ]offer)?|counter offer)\b/.test(n) ||
    (n.includes("counter") && (n.includes("quote") || n.includes("offer")))
  ) {
    const amount = extractCounterOfferAmount(userText);
    const missingSlots: SlotFillingData["missingSlots"] = [
      collaborationSlot(
        "collaboration_id",
        "Collaboration",
        "Choose the collaboration",
      ),
    ];
    if (amount === undefined) {
      missingSlots.push({
        fieldName: "counter_offer",
        uiLabel: "Counter-offer amount (INR)",
        inputType: "TEXT",
        selectOptions: [],
        placeholderText: "e.g. 15000",
      });
    }
    return {
      kind: "COLLAB_COUNTER_OFFER",
      stagedPayload: {
        creator_or_campaign_hint: hint,
        ...(amount !== undefined ? { counter_offer: amount } : {}),
      },
      missingSlots,
    };
  }

  if (
    /\baccept (terms|quote|commercials|offer|deal)\b/.test(n) ||
    (n.includes("accept") &&
      (n.includes("collab") || n.includes("quote") || n.includes("offer")))
  ) {
    return {
      kind: "COLLAB_ACCEPT_TERMS",
      stagedPayload: { creator_or_campaign_hint: hint },
      missingSlots: [
        collaborationSlot(
          "collaboration_id",
          "Collaboration",
          "Choose the collaboration",
        ),
      ],
    };
  }

  if (
    /\bfund escrow\b/.test(n) ||
    /\block escrow\b/.test(n) ||
    (n.includes("fund") && n.includes("escrow")) ||
    (n.includes("secure") && n.includes("escrow"))
  ) {
    return {
      kind: "COLLAB_FUND_ESCROW",
      stagedPayload: { creator_or_campaign_hint: hint },
      missingSlots: [
        collaborationSlot(
          "collaboration_id",
          "Collaboration",
          "Choose the collaboration",
        ),
      ],
    };
  }

  if (
    /\b(dispatch|mark as shipped|mark shipped|ship product|add tracking)\b/.test(
      n,
    ) ||
    (n.includes("ship") && (n.includes("collab") || n.includes("product")))
  ) {
    const tracking = extractTrackingHint(userText);
    const missingSlots: SlotFillingData["missingSlots"] = [
      collaborationSlot(
        "collaboration_id",
        "Collaboration",
        "Choose the collaboration",
      ),
    ];
    if (!tracking.tracking_id) {
      missingSlots.push({
        fieldName: "tracking_id",
        uiLabel: "Tracking ID",
        inputType: "TEXT",
        selectOptions: [],
        placeholderText: "Carrier tracking / AWB",
      });
    }
    return {
      kind: "COLLAB_DISPATCH",
      stagedPayload: {
        creator_or_campaign_hint: hint,
        ...tracking,
      },
      missingSlots,
    };
  }

  if (
    /\bapprove content\b/.test(n) ||
    /\bapprove (media|deliverable|submission)\b/.test(n) ||
    (n.includes("approve") &&
      (n.includes("content") || n.includes("draft") || n.includes("media")))
  ) {
    return {
      kind: "COLLAB_APPROVE_CONTENT",
      stagedPayload: { creator_or_campaign_hint: hint },
      missingSlots: [
        collaborationSlot(
          "collaboration_id",
          "Collaboration",
          "Choose the collaboration",
        ),
      ],
    };
  }

  if (
    /\brequest revision\b/.test(n) ||
    /\breject content\b/.test(n) ||
    (n.includes("revision") &&
      (n.includes("request") || n.includes("ask") || n.includes("need")))
  ) {
    return {
      kind: "COLLAB_REQUEST_REVISION",
      stagedPayload: { creator_or_campaign_hint: hint },
      missingSlots: [
        collaborationSlot(
          "collaboration_id",
          "Collaboration",
          "Choose the collaboration",
        ),
        {
          fieldName: "brand_feedback",
          uiLabel: "Revision feedback",
          inputType: "TEXT",
          selectOptions: [],
          placeholderText: "What should the creator change?",
        },
      ],
    };
  }

  if (
    /\bverify compliance\b/.test(n) ||
    /\bverify (live|post)\b/.test(n) ||
    (n.includes("compliance") &&
      (n.includes("verify") || n.includes("approve") || n.includes("check")))
  ) {
    return {
      kind: "COLLAB_VERIFY_COMPLIANCE",
      stagedPayload: { creator_or_campaign_hint: hint },
      missingSlots: [
        collaborationSlot(
          "collaboration_id",
          "Collaboration",
          "Choose the collaboration",
        ),
      ],
    };
  }

  return null;
}
