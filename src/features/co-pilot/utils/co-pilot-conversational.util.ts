const PLATFORM_KEYWORDS = [
  "brand",
  "campaign",
  "escrow",
  "collab",
  "collaboration",
  "dna",
  "planner",
  "leak",
  "draft",
  "persona",
  "compliance",
  "ledger",
  "vault",
  "launch",
  "offering",
  "product",
  "competitor",
  "funnel",
  "readiness",
  "overview",
  "visual",
  "identity",
  "budget",
  "objective",
  "confirm",
  "discard",
  "edit",
  "update",
  "create",
  "approve",
  "intelligence",
  "gap",
  "tds",
  "tax",
  "logistics",
  "production",
  "fulfillment",
];

const GIBBERISH_PATTERNS = [
  /^asdf+$/i,
  /^qwerty$/i,
  /^zxcv/i,
  /^xxx+$/i,
  /^blah+$/i,
  /^lorem\b/i,
  /^[bcdfghjklmnpqrstvwxyz]{5,}$/i,
];

export function isCasualGreeting(userText: string): boolean {
  const trimmed = userText.trim();
  const lower = trimmed.toLowerCase();

  if (
    /^(hi|hello|hey|yo|howdy|sup|hiya)\b[!?.]*$/i.test(trimmed) ||
    /^good\s+(morning|afternoon|evening)\b[!?.]*$/i.test(trimmed)
  ) {
    return true;
  }

  if (/^(test|testing)\s*[!?.]*$/i.test(trimmed)) {
    return true;
  }

  if (
    trimmed.length <= 20 &&
    /^(hi|hello|hey)\b/i.test(trimmed) &&
    !lower.includes("overview") &&
    !lower.includes("campaign")
  ) {
    return true;
  }

  return false;
}

export function isGibberishInput(userText: string): boolean {
  const trimmed = userText.trim();
  if (!trimmed) {
    return true;
  }

  if (isCasualGreeting(trimmed)) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  if (PLATFORM_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return false;
  }

  if (GIBBERISH_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  if (trimmed.length <= 2) {
    return true;
  }

  if (trimmed.length <= 6 && !/[aeiou]/i.test(trimmed)) {
    return true;
  }

  const alphaCount = trimmed.replace(/[^a-zA-Z]/g, "").length;
  if (trimmed.length >= 8 && alphaCount / trimmed.length < 0.45) {
    return true;
  }

  return false;
}

export function buildCoPilotWelcomeReply(brandName: string): string {
  return [
    `Hello! I'm your Brand Co-Pilot for ${brandName}.`,
    "",
    "I can help with Brand Centre (DNA, intelligence gaps, and campaign planner), draft campaigns, escrow ledger reads, and collaboration status. I can also stage DNA or campaign changes — nothing saves until you confirm.",
    "",
    "Pick one of the suggested prompts below, or ask in your own words.",
  ].join("\n");
}

export function buildCoPilotFallbackReply(brandName: string): string {
  return [
    `I'm not sure I understood that — sorry about that.`,
    "",
    `Try a suggested prompt below, or ask about your Brand Centre overview, funnel leaks, campaign planner, escrow audit, or launching a draft campaign for ${brandName}.`,
    "",
    "If you were confirming a staged action, use Confirm or Discard on the card above instead of typing here.",
  ].join("\n");
}
