/**
 * Global domain typo / slang normalization for co-pilot routing.
 * Conservative: only rewrites high-confidence platform vocabulary.
 */

const WORD_CORRECTIONS: Array<{ pattern: RegExp; replace: string }> = [
  // Campaign
  { pattern: /\bcamp+aign?s?\b/gi, replace: "campaign" },
  { pattern: /\bcampigns?\b/gi, replace: "campaign" },
  { pattern: /\bcmapigns?\b/gi, replace: "campaign" },
  { pattern: /\bcampgins?\b/gi, replace: "campaign" },
  { pattern: /\bcampaings?\b/gi, replace: "campaign" },
  { pattern: /\bcampi[ae]?gns?\b/gi, replace: "campaign" },
  { pattern: /\bcampai?gns?\b/gi, replace: "campaign" },
  { pattern: /\bcampi[sz]gns?\b/gi, replace: "campaign" },
  { pattern: /\bbud+get\b/gi, replace: "budget" },
  { pattern: /\bbudgte\b/gi, replace: "budget" },
  { pattern: /\bbuf[=_\s-]*degt\b/gi, replace: "budget" },
  { pattern: /\bperfomance\b/gi, replace: "performance" },
  { pattern: /\bperformace\b/gi, replace: "performance" },
  { pattern: /\bsummari[sz]e\b/gi, replace: "summarize" },
  { pattern: /\bsummari[a-z]{0,3}e\b/gi, replace: "summarize" },
  { pattern: /\bsumary\b/gi, replace: "summary" },
  { pattern: /\bcomapre\b/gi, replace: "compare" },
  { pattern: /\bduplicte\b/gi, replace: "duplicate" },
  { pattern: /\bduplciate\b/gi, replace: "duplicate" },
  { pattern: /\barchvie\b/gi, replace: "archive" },
  { pattern: /\barchiv\b/gi, replace: "archive" },
  { pattern: /\bresum\b/gi, replace: "resume" },
  { pattern: /\bpaues\b/gi, replace: "pause" },
  { pattern: /\bpausse\b/gi, replace: "pause" },
  { pattern: /\bfinacials?\b/gi, replace: "financials" },
  { pattern: /\bobjectvie\b/gi, replace: "objective" },
  { pattern: /\bpublis[hj]\b/gi, replace: "publish" },
  { pattern: /\bpublsih\b/gi, replace: "publish" },
  { pattern: /\bpubish\b/gi, replace: "publish" },
  { pattern: /\bpubls?ih\b/gi, replace: "publish" },
  { pattern: /\bactviate\b/gi, replace: "activate" },
  { pattern: /\bactiavte\b/gi, replace: "activate" },
  { pattern: /\bgo[\s_-]*live\b/gi, replace: "go live" },
  { pattern: /\bgolive\b/gi, replace: "go live" },

  // Collaboration core
  { pattern: /\bcoll+abor+ations?\b/gi, replace: "collaboration" },
  { pattern: /\bcollaberations?\b/gi, replace: "collaboration" },
  { pattern: /\bcolaborations?\b/gi, replace: "collaboration" },
  { pattern: /\bcollaboraton?s?\b/gi, replace: "collaboration" },
  { pattern: /\bcollabortions?\b/gi, replace: "collaboration" },
  { pattern: /\bcollabs?\b/gi, replace: "collab" },
  { pattern: /\bcolabs?\b/gi, replace: "collab" },
  { pattern: /\bcollabration\b/gi, replace: "collaboration" },

  // Negotiation / commercials
  { pattern: /\bnegociat(?:e|ion|ing)?\b/gi, replace: "negotiate" },
  { pattern: /\bnegotiaton\b/gi, replace: "negotiation" },
  { pattern: /\bnegotiaiton\b/gi, replace: "negotiation" },
  { pattern: /\bnegotiaion\b/gi, replace: "negotiation" },
  { pattern: /\bcounter[\s_-]*offers?\b/gi, replace: "counter-offer" },
  { pattern: /\bcounterof+ers?\b/gi, replace: "counter-offer" },
  { pattern: /\bcounterofers?\b/gi, replace: "counter-offer" },
  { pattern: /\bcountr[\s_-]*offers?\b/gi, replace: "counter-offer" },
  { pattern: /\bcounte offer\b/gi, replace: "counter-offer" },
  { pattern: /\bcounter offfer\b/gi, replace: "counter-offer" },
  { pattern: /\bacept\b/gi, replace: "accept" },
  { pattern: /\baccpet\b/gi, replace: "accept" },
  { pattern: /\bcommericals?\b/gi, replace: "commercials" },
  { pattern: /\bcomercials?\b/gi, replace: "commercials" },

  // Securement / escrow
  { pattern: /\bescro+w\b/gi, replace: "escrow" },
  { pattern: /\bescorw\b/gi, replace: "escrow" },
  { pattern: /\bescrew\b/gi, replace: "escrow" },
  { pattern: /\bescro\b/gi, replace: "escrow" },
  { pattern: /\bsecuremnt\b/gi, replace: "securement" },
  { pattern: /\bsecurment\b/gi, replace: "securement" },
  { pattern: /\bsecuerment\b/gi, replace: "securement" },
  { pattern: /\bfudn\b/gi, replace: "fund" },
  { pattern: /\bfuding\b/gi, replace: "funding" },

  // Logistics / shipment
  { pattern: /\blogisitcs\b/gi, replace: "logistics" },
  { pattern: /\blogsitics\b/gi, replace: "logistics" },
  { pattern: /\blogisitc\b/gi, replace: "logistics" },
  { pattern: /\blogistcs\b/gi, replace: "logistics" },
  { pattern: /\bdipatch\b/gi, replace: "dispatch" },
  { pattern: /\bdespatch\b/gi, replace: "dispatch" },
  { pattern: /\bdisptach\b/gi, replace: "dispatch" },
  { pattern: /\bdisaptch\b/gi, replace: "dispatch" },
  { pattern: /\bship+ment\b/gi, replace: "shipment" },
  { pattern: /\bshiping\b/gi, replace: "shipping" },
  { pattern: /\btrackign\b/gi, replace: "tracking" },
  { pattern: /\btrakcing\b/gi, replace: "tracking" },
  { pattern: /\bful+fil+ments?\b/gi, replace: "fulfillment" },
  { pattern: /\bfulf[il]l?ment\b/gi, replace: "fulfillment" },
  { pattern: /\bfulfililment\b/gi, replace: "fulfillment" },
  { pattern: /\bcourrier\b/gi, replace: "courier" },

  // Content / review / compliance
  { pattern: /\brevison\b/gi, replace: "revision" },
  { pattern: /\brevisoin\b/gi, replace: "revision" },
  { pattern: /\brevsion\b/gi, replace: "revision" },
  { pattern: /\bapro+ve\b/gi, replace: "approve" },
  { pattern: /\baproove\b/gi, replace: "approve" },
  { pattern: /\bapporve\b/gi, replace: "approve" },
  { pattern: /\bdeliverables?\b/gi, replace: "deliverable" },
  { pattern: /\bdelivrables?\b/gi, replace: "deliverable" },
  { pattern: /\bcomplaince\b/gi, replace: "compliance" },
  { pattern: /\bcomplience\b/gi, replace: "compliance" },
  { pattern: /\bcompliane\b/gi, replace: "compliance" },
  { pattern: /\bcomppliance\b/gi, replace: "compliance" },
  { pattern: /\bverifiy\b/gi, replace: "verify" },
  { pattern: /\bverfiy\b/gi, replace: "verify" },
  { pattern: /\bverfy\b/gi, replace: "verify" },
];

const PLURAL_BASES = new Set([
  "campaign",
  "collaboration",
  "collab",
  "deliverable",
]);

export { looksLikeBrandSettingsUtterance } from "../modules/brand-settings/brand-settings.intents";

/** Soft gate: message may belong to Campaign List (broad, not exact intents). */
export function looksLikeCampaignUtterance(normalizedText: string): boolean {
  const n = normalizedText.toLowerCase();
  return (
    n.includes("campaign") ||
    n.includes("budget") ||
    n.includes("pause") ||
    n.includes("resume") ||
    n.includes("archive") ||
    n.includes("duplicate") ||
    n.includes("clone") ||
    n.includes("compare") ||
    n.includes("summarize") ||
    n.includes("summary") ||
    n.includes("performance") ||
    n.includes("financial") ||
    n.includes("spending") ||
    n.includes("publish") ||
    n.includes("go live") ||
    n.includes("go-live") ||
    n.includes("activate") ||
    /\b(draft|active|paused|completed|archived)\b/.test(n) ||
    /\bsort\b.*\b(by|budget|name|spend)/.test(n) ||
    /\bfilter\b/.test(n) ||
    /\b(set|make)\b.*\b(active|paused|live)\b/.test(n) ||
    /\bproduct\b/.test(n) ||
    /\b(checklist|what'?s missing|campaign brief|creator guidelines|invited creators?|can i publish|rename campaign|delete campaign)\b/.test(
      n,
    )
  );
}

/** Soft gate: message may belong to Collaboration workflow. */
export function looksLikeCollaborationUtterance(
  normalizedText: string,
): boolean {
  const n = normalizedText.toLowerCase();
  return (
    n.includes("collaboration") ||
    n.includes("collab") ||
    n.includes("counter-offer") ||
    n.includes("counter offer") ||
    n.includes("negotiation") ||
    n.includes("negotiate") ||
    n.includes("logistics") ||
    n.includes("dispatch") ||
    n.includes("shipment") ||
    n.includes("tracking") ||
    n.includes("fulfillment") ||
    n.includes("securement") ||
    n.includes("content review") ||
    n.includes("request revision") ||
    n.includes("approve content") ||
    n.includes("reject content") ||
    n.includes("verify compliance") ||
    n.includes("fund escrow") ||
    n.includes("lock escrow") ||
    n.includes("accept terms") ||
    n.includes("accept quote") ||
    n.includes("accept offer") ||
    n.includes("accept deal") ||
    n.includes("accept commercials") ||
    (n.includes("escrow") &&
      (n.includes("fund") || n.includes("collab") || n.includes("secure"))) ||
    (n.includes("pipeline") &&
      (n.includes("creator") || n.includes("collab") || n.includes("applicant"))) ||
    // Layer 2 detail inspect (quote/offer/tracking/submission) — not chat transcript
    /\bquot(?:e|ed|ing)\b/.test(n) ||
    (/\bhow much\b/.test(n) &&
      /\b(quot(?:e|ed)|offer|creator|they|collab|negotiation|amount)\b/.test(
        n,
      )) ||
    (/\b(offer|amount|price|commercials?)\b/.test(n) &&
      /\b(creator|they|them|sent|collab|negotiation|show|what|current)\b/.test(
        n,
      )) ||
    (/\b(tracking|courier|awb)\b/.test(n) &&
      /\b(show|what|collab|shipment|dispatch|logistics)\b/.test(n)) ||
    /\b(what did they submit|show (?:the )?submission|draft url|live post url)\b/.test(
      n,
    ) ||
    /\b(pending action|what should i do next|what'?s pending|timeline|activity history|deliverable|creator profile|who is the creator|conversation with|latest messages|collaboration (?:stats|statistics|summary)|summarize (?:this )?collab|can i (?:accept|approve|ship))\b/.test(
      n,
    )
  );
}

/** Follow-ups that only make sense after campaigns were listed in-thread. */
export function looksLikeCampaignFollowUp(normalizedText: string): boolean {
  const n = normalizedText.toLowerCase();
  return (
    looksLikeCampaignUtterance(n) ||
    /\b(it|that one|this one|the first|the second|pause it|resume it|archive it)\b/.test(
      n,
    ) ||
    /\b(its|their)\s+(budget|spend|performance|summary)\b/.test(n) ||
    /\bwhat about\b/.test(n) ||
    // "publish teat 222" / "go live era" after a list — no "campaign" word needed
    /\b(publish|go live|go-live|pause|resume|archive|duplicate|activate)\b/.test(
      n,
    )
  );
}

function fuzzyCorrectToken(token: string): string {
  const lower = token.toLowerCase();
  if (/^camp[a-z]{3,8}s?$/.test(lower) && !/^campaigns?$/.test(lower)) {
    return /s$/i.test(token) ? "campaigns" : "campaign";
  }
  if (
    /^coll+abor?[a-z]{0,8}s?$/.test(lower) &&
    !/^collaborations?$/.test(lower) &&
    !/^collabs?$/.test(lower)
  ) {
    return /s$/i.test(token) ? "collaborations" : "collaboration";
  }
  if (/^col+abs?$/.test(lower) && !/^collabs?$/.test(lower)) {
    return /s$/i.test(token) ? "collabs" : "collab";
  }
  if (/^sum+a?r[a-z]{0,6}$/.test(lower) && !/^(summarize|summary)$/.test(lower)) {
    return lower.endsWith("y") ? "summary" : "summarize";
  }
  if (/^budg[a-z]{0,4}$/.test(lower) && lower !== "budget") {
    return "budget";
  }
  if (/^com+pare?$/.test(lower) && lower !== "compare") {
    return "compare";
  }
  if (/^pub+l[a-z]{0,4}$/.test(lower) && lower !== "publish") {
    return "publish";
  }
  if (/^negociat[a-z]*$/.test(lower) || /^negotiat[a-z]*$/.test(lower)) {
    if (lower.includes("ion")) return "negotiation";
    if (lower.endsWith("ing")) return "negotiating";
    return "negotiate";
  }
  if (/^esc+r[a-z]{0,3}$/.test(lower) && lower !== "escrow") {
    return "escrow";
  }
  if (/^logis[a-z]{0,6}$/.test(lower) && lower !== "logistics") {
    return "logistics";
  }
  if (/^dis+p[a-z]{0,5}$/.test(lower) && !/^(dispatch|dispatched)$/.test(lower)) {
    return "dispatch";
  }
  if (/^compl[iy]?a?n[a-z]{0,4}$/.test(lower) && lower !== "compliance") {
    return "compliance";
  }
  if (/^revis[a-z]{0,4}$/.test(lower) && !/^(revision|revisions)$/.test(lower)) {
    return /s$/i.test(token) ? "revisions" : "revision";
  }
  if (/^aprov[a-z]{0,3}$/.test(lower) || /^apporve$/.test(lower)) {
    return "approve";
  }
  if (/^verif[a-z]{0,4}$/.test(lower) && lower !== "verify") {
    return "verify";
  }
  if (/^ful+fil?[a-z]{0,5}$/.test(lower) && lower !== "fulfillment") {
    return "fulfillment";
  }
  if (/^track[a-z]{0,4}$/.test(lower) && !/^(tracking|track)$/.test(lower)) {
    return "tracking";
  }
  return token;
}

export function normalizeCoPilotUserText(raw: string): string {
  let text = raw.normalize("NFKC").trim();
  text = text.replace(/\s+/g, " ");
  for (const { pattern, replace } of WORD_CORRECTIONS) {
    text = text.replace(pattern, (match) => {
      if (/s$/i.test(match) && PLURAL_BASES.has(replace)) {
        return `${replace}s`;
      }
      return replace;
    });
  }
  // Phrase glue after token fixes
  text = text.replace(/\bcounter\s+offer\b/gi, "counter-offer");
  text = text.replace(/\bgo\s+live\b/gi, "go live");
  text = text.replace(/\b([A-Za-z]+)\b/g, (token) => fuzzyCorrectToken(token));
  return text;
}
