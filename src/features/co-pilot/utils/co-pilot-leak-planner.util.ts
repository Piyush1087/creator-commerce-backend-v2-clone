import { mentionsPlanner } from "./co-pilot-planner.util";

export type LeakPlannerCandidate = {
  id: string;
  insightTitle: string;
};

const GENERIC_LEAK_REFERENCES = new Set([
  "it",
  "this",
  "that",
  "them",
  "those",
  "leak",
  "leaks",
  "all",
  "one",
  "that leak",
  "this leak",
  "the leak",
  "the leaks",
]);

export function mentionsCampaignPlanner(text: string): boolean {
  return mentionsPlanner(text);
}

export function isGenericLeakReference(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  if (!normalized) {
    return true;
  }
  return GENERIC_LEAK_REFERENCES.has(normalized);
}

export function parseLeakTitleHint(userText: string): string | undefined {
  const patterns = [
    /(?:approve|pass)\s+(?:and\s+pass\s+)?(?:the\s+)?(?:leak\s+)?["']?(.+?)["']?\s*$/i,
    /(?:move|send|push|convert|pass)\s+(?:the\s+)?(?:leak\s+)?["']?(.+?)["']?\s+(?:to|into)\s+(?:the\s+)?(?:campaign\s+)?plann/i,
    /(?:move|send|push)\s+(?:the\s+)?(?:leak\s+)?["']?(.+?)["']?\s+(?:to|into)\s+(?:the\s+)?plann/i,
  ];

  for (const pattern of patterns) {
    const match = userText.match(pattern)?.[1]?.trim();
    if (match && !isGenericLeakReference(match)) {
      return match;
    }
  }

  return undefined;
}

export function isMoveLeakToPlannerQuery(userText: string): boolean {
  const n = userText.toLowerCase();

  if (
    mentionsCampaignPlanner(userText) &&
    /\b(move|send|push|convert|pass|approve)\b/.test(n)
  ) {
    return true;
  }

  if (/\b(approve|pass)\s+(?:and\s+pass\s+)?(?:the\s+)?/i.test(userText)) {
    const titleHint = parseLeakTitleHint(userText);
    if (titleHint) {
      return true;
    }
    if (/\bleak\b/.test(n) || mentionsCampaignPlanner(userText)) {
      return true;
    }
  }

  if (mentionsCampaignPlanner(userText) && /\b(it|this|that)\b/.test(n)) {
    return true;
  }

  return (
    n.includes("send opportunity to campaign planner") ||
    n.includes("to campaign planner")
  );
}

export function matchLeakByTitleHint(
  hint: string,
  leaks: LeakPlannerCandidate[],
): LeakPlannerCandidate | undefined {
  const normalizedHint = hint.toLowerCase().trim();
  if (!normalizedHint || isGenericLeakReference(normalizedHint)) {
    return undefined;
  }

  const exact = leaks.find(
    (leak) => leak.insightTitle.toLowerCase() === normalizedHint,
  );
  if (exact) {
    return exact;
  }

  const partialMatches = leaks.filter((leak) => {
    const title = leak.insightTitle.toLowerCase();
    return (
      title.includes(normalizedHint) ||
      (normalizedHint.length >= 12 && normalizedHint.includes(title))
    );
  });

  if (partialMatches.length === 1) {
    return partialMatches[0];
  }

  return undefined;
}

export function resolveLeakFromThreadContext(
  history: Array<{ role: "USER" | "ASSISTANT"; text: string }>,
  leaks: LeakPlannerCandidate[],
  userText: string,
): LeakPlannerCandidate | undefined {
  const orderedUserTexts = [
    userText,
    ...history
      .slice()
      .reverse()
      .filter((entry) => entry.role === "USER")
      .map((entry) => entry.text),
  ];

  for (const text of orderedUserTexts) {
    for (const leak of leaks) {
      if (text.toLowerCase().includes(leak.insightTitle.toLowerCase())) {
        return leak;
      }
    }
  }

  const n = userText.toLowerCase();
  const wantsContextual =
    /\b(it|this|that|them|those)\b/.test(n) || isGenericLeakReference(userText);

  if (wantsContextual && leaks.length === 1) {
    return leaks[0];
  }

  return undefined;
}

export function buildNoMovableLeaksNarrative(): string {
  return [
    "There are no active Intelligence & Gaps leaks ready to move to Campaign Planner.",
    "",
    "Leaks come from your Brand Centre deep scan — I cannot invent them in chat.",
    "Open **Brand Centre → Intelligence & Gaps** to run or refresh the scan, then ask me to list active leaks or send one to the planner.",
  ].join("\n");
}
