/**
 * Global domain typo / slang normalization for co-pilot routing.
 * Conservative: only rewrites high-confidence platform vocabulary.
 */

const WORD_CORRECTIONS: Array<{ pattern: RegExp; replace: string }> = [
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
  { pattern: /\barchvie\b/gi, replace: "archive" },
  { pattern: /\bresum\b/gi, replace: "resume" },
  { pattern: /\bpaues\b/gi, replace: "pause" },
  { pattern: /\bfinacials?\b/gi, replace: "financials" },
  { pattern: /\bobjectvie\b/gi, replace: "objective" },
  { pattern: /\bpublis[hj]\b/gi, replace: "publish" },
  { pattern: /\bpublsih\b/gi, replace: "publish" },
  { pattern: /\bpubish\b/gi, replace: "publish" },
  { pattern: /\bpubls?ih\b/gi, replace: "publish" },
];

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
    /\b(draft|active|paused|completed|archived)\b/.test(n) ||
    /\bsort\b.*\b(by|budget|name|spend)/.test(n) ||
    /\bfilter\b/.test(n) ||
    /\b(set|make)\b.*\b(active|paused|live)\b/.test(n) ||
    /\bproduct\b/.test(n)
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
    /\b(publish|go live|go-live|pause|resume|archive|duplicate)\b/.test(n)
  );
}

function fuzzyCorrectToken(token: string): string {
  const lower = token.toLowerCase();
  if (/^camp[a-z]{3,8}s?$/.test(lower) && !/^campaigns?$/.test(lower)) {
    return /s$/i.test(token) ? "campaigns" : "campaign";
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
  return token;
}

export function normalizeCoPilotUserText(raw: string): string {
  let text = raw.normalize("NFKC").trim();
  text = text.replace(/\s+/g, " ");
  for (const { pattern, replace } of WORD_CORRECTIONS) {
    text = text.replace(pattern, (match) => {
      // Preserve rough plural if original looked plural
      if (/s$/i.test(match) && replace === "campaign") {
        return "campaigns";
      }
      return replace;
    });
  }
  text = text.replace(/\b([A-Za-z]+)\b/g, (token) => fuzzyCorrectToken(token));
  return text;
}
