import type { IntelligenceLeakCardPayload } from "../schemas/intelligence-prompt2.schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function drawer(
  logic: string,
  discrepancy: string,
  stepLabel: string,
): IntelligenceLeakCardPayload["drawerDeepDive"] {
  return {
    underlyingDataLogic: logic,
    competitiveDiscrepancy: discrepancy,
    actionableStepsChecklist: [
      {
        stepId: "STEP_1",
        stepLabel,
        isCompleted: false,
      },
    ],
  };
}

/**
 * Deterministic minimum insight set when Prompt 2 returns nothing usable.
 * Keeps Tab 2 non-empty per product expectation (≥1% lift filter still applies).
 */
export function buildFallbackIntelligenceLeaks(input: {
  baselineHealth: unknown;
  shareOfVoice: unknown;
  growthImpactMatrix: unknown;
  assetMix: unknown;
}): IntelligenceLeakCardPayload[] {
  const health = isRecord(input.baselineHealth) ? input.baselineHealth : {};
  const sov = isRecord(input.shareOfVoice) ? input.shareOfVoice : {};
  const gim = isRecord(input.growthImpactMatrix) ? input.growthImpactMatrix : {};
  const levers = isRecord(gim.levers) ? gim.levers : {};
  const themes = asStringArray(sov.competitorThemesLast30Days);
  const themeHint =
    themes.length > 0 ? themes.slice(0, 2).join(" and ") : "category leaders";

  const contentScore =
    typeof health.contentQualityScore === "number"
      ? health.contentQualityScore
      : 5;

  const pdpLift =
    typeof levers.pdpAlignmentLift === "number" ? levers.pdpAlignmentLift : 10;
  const paidLift =
    typeof levers.paidAmplificationLift === "number"
      ? levers.paidAmplificationLift
      : 10;

  const cards: IntelligenceLeakCardPayload[] = [
    {
      insightTitle: `Align messaging with competitor themes: ${themeHint}`,
      shortDescription20Words:
        "Baseline share-of-voice and theme scan suggest tightening PDP and creative hooks around top competitor narratives.",
      priorityRank: contentScore < 6 ? "HIGH" : "MEDIUM",
      leakBucket: "CREATIVE_HOOK",
      performanceStatus: contentScore < 6 ? "RED" : "YELLOW",
      projectedLiftPercentage: Math.min(100, Math.max(5, Math.round(pdpLift))),
      drawerDeepDive: drawer(
        `Content quality score ${contentScore}/10 and share-of-voice baseline imply creative and PDP narratives can better reflect themes competitors use: ${themeHint}.`,
        `Competitor content themes in the last 30 days overweight angles your current funnel may not emphasize equally, creating a recoverable awareness and conversion gap.`,
        "Map top PDPs and hero ads to competitor theme clusters",
      ),
    },
  ];

  const assetMix = isRecord(input.assetMix) ? input.assetMix : {};
  const productWeight =
    typeof assetMix.product === "number" ? assetMix.product : 0;
  if (productWeight >= 45) {
    cards.push({
      insightTitle: "Rebalance paid asset mix beyond product-only creatives",
      shortDescription20Words:
        "Strategy mix is product-heavy; adding collection and promo-led assets can improve paid efficiency and reach.",
      priorityRank: "MEDIUM",
      leakBucket: "PAID",
      performanceStatus: "YELLOW",
      projectedLiftPercentage: Math.min(100, Math.max(5, Math.round(paidLift))),
      drawerDeepDive: drawer(
        `Paid amplification lever at ~${paidLift}% projected lift with product-weighted asset mix (${productWeight}% product) limits promotional storytelling.`,
        "Peers typically blend product, collection, and offer creatives in paid channels; over-indexing on product-only ads can depress hook rate.",
        "Introduce collection or offer-led variants in the next paid flight",
      ),
    });
  }

  return cards.slice(0, 3);
}
