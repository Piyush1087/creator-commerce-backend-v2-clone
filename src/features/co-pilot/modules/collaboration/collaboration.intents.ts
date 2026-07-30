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
    /(?:counter(?:[- ]offer)?|accept(?: terms)?|fund escrow|dispatch|ship|approve content|request revision|reject content|verify compliance|status of|show|open|quote|offer|amount|price|tracking|summarize|summary|timeline|pending|creator|conversation|messages?)\s+(?:collab(?:oration)?\s+(?:with\s+)?)?(.+)$/i,
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
      /(?:tracking(?:\s*(?:id|number|#|url))?|awb)[:\s]+([A-Za-z0-9\-:/._]+)/i,
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

/** Soft gate helper for Part 6 inspect + analytics phrases. */
export function looksLikeCollabDetailUtterance(normalized: string): boolean {
  const n = normalized.toLowerCase().trim();
  if (
    /\b(counter(?:[- ]offer)?|accept (?:terms|quote|offer)|fund escrow|approve content|request revision|verify compliance|dispatch|mark shipped)\b/.test(
      n,
    )
  ) {
    return false;
  }
  return (
    /\bquot(?:e|ed|ing)\b/.test(n) ||
    /\b(offer|amount|price|commercials?)\b/.test(n) ||
    /\bhow much\b/.test(n) ||
    /\b(what (?:did|have) they (?:send|sent|offer|offered|quote|quoted))\b/.test(
      n,
    ) ||
    /\b(current (?:offer|quote|price)|show (?:the )?(?:quote|offer|amount|price))\b/.test(
      n,
    ) ||
    (/\bnegotiation\b/.test(n) &&
      /\b(sent|send|quot(?:e|ed)|offer|amount|price|user|creator)\b/.test(n)) ||
    /\b(tracking|courier|awb|shipment|shipped)\b/.test(n) ||
    /\b(submission|draft(?:\s+url)?|what did they submit|show (?:the )?media|creator content)\b/.test(
      n,
    ) ||
    /\b(live (?:post|url)|compliance (?:status|state|ready))\b/.test(n) ||
    /\bnegotiation (?:detail|details|quote|offer|amount)\b/.test(n) ||
    /\b(pending|next action|blocking|blocker|timeline|activity history|deliverable|conversation|messages?|who is the creator|creator profile|instagram)\b/.test(
      n,
    )
  );
}

export function detectCollaborationRead(userText: string): ReadQueryKind | null {
  const n = userText.toLowerCase().trim();
  const detailAsk = looksLikeCollabDetailUtterance(n);

  const mentionsCollab =
    n.includes("collaboration") ||
    n.includes("collab") ||
    n.includes("logistics") ||
    n.includes("fulfillment") ||
    n.includes("fullfilment") ||
    n.includes("content review") ||
    n.includes("negotiation") ||
    n.includes("securement") ||
    n.includes("shipment") ||
    n.includes("deliverable") ||
    (n.includes("pipeline") &&
      (n.includes("creator") || n.includes("collab"))) ||
    detailAsk ||
    /\b(quote|tracking|creator content|approve content|reject content)\b/.test(
      n,
    );

  if (!mentionsCollab) {
    return null;
  }

  // §13 Validation / blockers (before writes are staged elsewhere)
  if (
    /\breject (?:the )?quote\b/.test(n) ||
    /\bdecline (?:the )?(?:quote|offer)\b/.test(n)
  ) {
    return "COLLAB_VALIDATE";
  }
  if (
    /\b(can i|why can'?t i|why cannot i|am i able to|is it possible to)\b/.test(
      n,
    ) &&
    /\b(accept|approve|reject|ship|dispatch|fund|counter|proceed|quote|content|shipment)\b/.test(
      n,
    )
  ) {
    return "COLLAB_VALIDATE";
  }
  if (
    /\bwhy can'?t i\b/.test(n) ||
    /\bwhat'?s blocking\b/.test(n) ||
    /\bexplain (?:the )?blocker\b/.test(n)
  ) {
    return "COLLAB_VALIDATE";
  }

  // §12 Analytics
  if (
    /\b(how many|statistics|stats|analytics|kpi)\b/.test(n) &&
    /\b(collab|collaboration|creator|pending|waiting)\b/.test(n)
  ) {
    return "COLLAB_ANALYTICS";
  }

  // §8 Conversation
  if (
    /\b(conversation|chat (?:with|history)|latest messages?|what did the creator say|messages? with)\b/.test(
      n,
    )
  ) {
    return "COLLAB_CONVERSATION";
  }

  // §7 Creator
  if (
    /\b(who is the creator|creator profile|creator instagram|show creator)\b/.test(
      n,
    ) ||
    (/\bcreator\b/.test(n) &&
      /\b(who|profile|instagram|handle|info|information)\b/.test(n) &&
      !/\b(content|waiting|collab(?:oration)?s)\b/.test(n))
  ) {
    return "COLLAB_CREATOR";
  }

  // §6 Timeline
  if (
    /\b(timeline|activity history|what happened so far|history of (?:this )?collab)\b/.test(
      n,
    )
  ) {
    return "COLLAB_TIMELINE";
  }

  // §5 Deliverables
  if (/\bdeliverable/.test(n)) {
    return "COLLAB_DELIVERABLES";
  }

  // §9 / §1 Pending & next action
  if (
    /\b(what should i do next|what'?s pending|whats pending|pending (?:action|work|tasks?)|next action|who has the next action|where is (?:this )?collab(?:oration)? stuck)\b/.test(
      n,
    ) ||
    (/\bpending\b/.test(n) &&
      !/\b(show|list|all|filter)\b.*\bcollab/.test(n) &&
      !/\bcollab(?:oration)?s?\b.*\bpending\b/.test(n))
  ) {
    return "COLLAB_PENDING";
  }

  // §2 Quote inspect (before generic status)
  if (
    /\b(has (?:the )?creator sent a quote|quote status|quoted amount|what quote|show (?:me )?(?:the )?quote|view quote)\b/.test(
      n,
    ) ||
    (/\bquot(?:e|ed|ing)\b/.test(n) &&
      !/\b(accept|reject|counter|update|list|waiting)\b/.test(n))
  ) {
    return "COLLAB_QUOTE";
  }

  // §3 Shipment inspect
  if (
    /\b(has (?:the )?product been shipped|tracking (?:url|number|id)|show tracking|shipment status|view shipment)\b/.test(
      n,
    ) ||
    (/\b(shipment|shipped|tracking|courier|awb)\b/.test(n) &&
      !/\b(mark|update|dispatch|list|waiting|filter)\b/.test(n))
  ) {
    return "COLLAB_SHIPMENT";
  }

  // §4 Content inspect
  if (
    /\b(has (?:the )?creator uploaded content|content status|show content|open creator content|creator content|what did they submit|submission)\b/.test(
      n,
    ) ||
    (/\b(content|media|draft url)\b/.test(n) &&
      !/\b(approve|reject|revision|list|waiting|filter|review)\b/.test(n) &&
      /\b(show|open|view|uploaded|submit|status)\b/.test(n))
  ) {
    return "COLLAB_CONTENT";
  }

  // §10 Summary
  if (
    /\b(summarize|quick summary|explain what'?s happening|collaboration summary)\b/.test(
      n,
    ) ||
    (/\bsummary\b/.test(n) && /\b(collab|collaboration|this)\b/.test(n))
  ) {
    return "COLLAB_SUMMARY";
  }

  // Issues / stuck logistics-production (legacy ISSUES)
  if (
    n.includes("issue") ||
    n.includes("rejection") ||
    n.includes("fulfillment") ||
    (n.includes("stuck") &&
      (n.includes("logistics") || n.includes("content") || n.includes("issue")))
  ) {
    return "COLLAB_ISSUES";
  }

  // Generic detail shell
  if (
    detailAsk &&
    !/\b(list|show all|pipeline|waiting for|filter)\b/.test(n)
  ) {
    return "COLLAB_DETAIL";
  }

  // §1 Status
  if (
    (n.includes("status") ||
      n.includes("detail") ||
      n.includes("overview") ||
      n.includes("where is") ||
      n.includes("what's the stage") ||
      n.includes("what stage") ||
      n.includes("current stage")) &&
    (n.includes("collab") ||
      n.includes("collaboration") ||
      extractCreatorOrCampaignHint(userText))
  ) {
    return "COLLAB_STATUS";
  }

  // §11 Search & listing (incl. stage filters)
  if (extractStageFilter(n) && /\b(list|show|waiting|filter|all)\b/.test(n)) {
    return "COLLAB_PIPELINE";
  }

  if (
    n.includes("list") ||
    n.includes("show") ||
    n.includes("pipeline") ||
    n.includes("active collab") ||
    n.includes("my collab") ||
    n.includes("collaborations") ||
    n.includes("collabs") ||
    n.includes("waiting for") ||
    n.includes("rejected collab")
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

  // "Reject the quote" has no brand co-pilot mutation API — leave for validate/read.
  if (
    /\breject (?:the )?quote\b/.test(n) ||
    /\bdecline (?:the )?(?:quote|offer)\b/.test(n)
  ) {
    return null;
  }

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
    /\b(dispatch|mark as shipped|mark shipped|ship product|add tracking|update tracking)\b/.test(
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
