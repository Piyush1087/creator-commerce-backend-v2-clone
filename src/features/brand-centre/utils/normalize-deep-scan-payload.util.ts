import { BrandRoutingType, OfferingType } from "@prisma/client";

import { getIndustryRoutingTemplate } from "../config/industry-routing-templates";

const ROUTING_DO_NOT_SAY_FALLBACKS: Record<BrandRoutingType, string[]> = {
  [BrandRoutingType.D2C_SKINCARE]: [
    "Guaranteed cure",
    "Instant permanent results",
    "Clinically proven without evidence",
  ],
  [BrandRoutingType.SAAS_PRODUCT]: [
    "Guaranteed 10x ROI",
    "100% uptime guarantee",
    "Zero implementation effort",
  ],
  [BrandRoutingType.HEALTHCARE_TREATMENT]: [
    "Cures disease",
    "FDA Approved",
    "100% Painless",
  ],
  [BrandRoutingType.OFFLINE_EXPERIENCE]: [
    "Unlimited alcohol",
    "Guaranteed celebrity appearances",
    "Risk-free adventure",
  ],
};

export type DiscoveredProductRow = {
  id: string;
  type: OfferingType;
  name: string;
  url: string;
  description: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isIsoDatetime(value: string): boolean {
  // Zod's .datetime() accepts RFC3339 / ISO-like strings; Date.parse is a decent guard.
  return Number.isFinite(Date.parse(value));
}

type Prompt1EntityType =
  | "PRODUCT"
  | "MODULE"
  | "TREATMENT"
  | "EXPERIENCE"
  | "COLLECTION";

const ARCHETYPE_KEYS = ["everyman", "expert", "jester", "rebel"] as const;

function normalizeArchetypeDistribution(value: unknown): Record<
  (typeof ARCHETYPE_KEYS)[number],
  number
> {
  const fallback = { everyman: 25, expert: 25, jester: 25, rebel: 25 };
  if (!isRecord(value)) {
    return fallback;
  }

  const weights = ARCHETYPE_KEYS.map((key) => {
    const n = value[key];
    return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (sum <= 0) {
    return fallback;
  }

  const scaled = weights.map((w) => Math.round((w / sum) * 100));
  const scaledSum = scaled.reduce((acc, w) => acc + w, 0);
  if (scaledSum !== 100) {
    const maxIdx = scaled.indexOf(Math.max(...scaled));
    scaled[maxIdx] += 100 - scaledSum;
  }

  return {
    everyman: scaled[0],
    expert: scaled[1],
    jester: scaled[2],
    rebel: scaled[3],
  };
}

function normalizePrompt1EntityType(value: unknown): Prompt1EntityType {
  if (typeof value !== "string") {
    return "PRODUCT";
  }
  const upper = value.trim().toUpperCase();
  if (upper === "COLLECTION") {
    return "COLLECTION";
  }
  if (upper === "MODULE") {
    return "MODULE";
  }
  if (upper === "TREATMENT") {
    return "TREATMENT";
  }
  if (upper === "EXPERIENCE") {
    return "EXPERIENCE";
  }
  // SERVICE and unknown values map to PRODUCT for Prompt 1 inventory.
  return "PRODUCT";
}

function mapOfferingTypeToEntityType(type: OfferingType): Prompt1EntityType {
  if (type === OfferingType.MODULE) {
    return "MODULE";
  }
  if (type === OfferingType.TREATMENT) {
    return "TREATMENT";
  }
  if (type === OfferingType.EXPERIENCE) {
    return "EXPERIENCE";
  }
  if (type === OfferingType.COLLECTION) {
    return "COLLECTION";
  }
  return "PRODUCT";
}

function deriveGrowthImpactMatrix(baselineHealth: Record<string, unknown>) {
  const score =
    typeof baselineHealth.contentQualityScore === "number"
      ? baselineHealth.contentQualityScore
      : 5;
  const reach =
    typeof baselineHealth.reachMoMPercentage === "number"
      ? baselineHealth.reachMoMPercentage
      : 0;
  const projected = Math.min(
    500,
    Math.max(5, Math.round(score * 8 + Math.max(0, reach) * 0.5)),
  );
  let statusIndicator: "GREEN" | "YELLOW" | "RED" = "YELLOW";
  if (score >= 7) {
    statusIndicator = "GREEN";
  } else if (score < 4) {
    statusIndicator = "RED";
  }
  return {
    projectedRevenueLiftPercentage: projected,
    levers: {
      pdpAlignmentLift: Math.min(100, Math.max(5, Math.round(projected * 0.4))),
      paidAmplificationLift: Math.min(
        100,
        Math.max(5, Math.round(projected * 0.35)),
      ),
      creatorRosterLift: Math.min(
        100,
        Math.max(5, Math.round(projected * 0.25)),
      ),
    },
    statusIndicator,
  };
}

function synthesizeInventoryFromProducts(
  products: DiscoveredProductRow[],
  brandUsps: string[],
) {
  const sellingFallback =
    brandUsps.length >= 3
      ? brandUsps.slice(0, 3)
      : ["Quality formulation", "Trusted brand", "Visible results"];
  return products.slice(0, 10).map((p) => ({
    entityType: mapOfferingTypeToEntityType(p.type),
    entityName: p.name,
    entityUrl: p.url.startsWith("http") ? p.url : `https://${p.url}`,
    briefDescription: p.description ?? undefined,
    sellingPoints: sellingFallback,
    productDoNotSay: [],
  }));
}

/**
 * Coerce Gemini output to satisfy Prompt 1 Zod validation before parse.
 */
export function normalizeDeepScanGeminiPayload(
  raw: unknown,
  routingType: BrandRoutingType,
  discoveredProducts: DiscoveredProductRow[] = [],
): unknown {
  if (!isRecord(raw)) {
    return raw;
  }

  const strategicDNA = isRecord(raw.strategicDNA)
    ? { ...raw.strategicDNA }
    : {};
  const narrative = isRecord(strategicDNA.narrative)
    ? { ...strategicDNA.narrative }
    : {};
  const visuals = isRecord(strategicDNA.visuals)
    ? { ...strategicDNA.visuals }
    : {};
  const compliance = isRecord(strategicDNA.complianceGuardrails)
    ? { ...strategicDNA.complianceGuardrails }
    : {};

  const brandUsps = asStringArray(narrative.brandUsps);
  if (brandUsps.length < 3) {
    const template = getIndustryRoutingTemplate(routingType);
    narrative.brandUsps = [
      `${template.section4.header} excellence`,
      "Trusted customer experience",
      "Science-backed quality",
    ];
  }

  if (asStringArray(narrative.toneOfVoice).length === 0) {
    narrative.toneOfVoice = ["Professional", "Authentic", "Clear"];
  }

  if (asStringArray(visuals.palette).length === 0) {
    visuals.palette = ["#111827", "#6B7280", "#34D399"];
  }
  if (asStringArray(visuals.fonts).length === 0) {
    visuals.fonts = ["Inter", "System UI"];
  }
  if (asStringArray(visuals.aesthetics).length === 0) {
    visuals.aesthetics = ["Modern", "Clean"];
  }

  const existingDoNotSay = asStringArray(compliance.doNotSayList)
    .map((s) => s.trim())
    .filter(Boolean);
  if (existingDoNotSay.length === 0) {
    const template = getIndustryRoutingTemplate(routingType);
    const fromTemplate = template.section4.doNotSayExamples ?? [];
    compliance.doNotSayList =
      fromTemplate.length > 0
        ? fromTemplate.slice(0, 3)
        : ROUTING_DO_NOT_SAY_FALLBACKS[routingType].slice(0, 3);
  } else {
    compliance.doNotSayList = existingDoNotSay;
  }

  strategicDNA.narrative = narrative;
  strategicDNA.visuals = visuals;
  strategicDNA.complianceGuardrails = compliance;

  const baselineHealth = isRecord(raw.baselineHealth)
    ? { ...raw.baselineHealth }
    : {};
  const archetypeMatch = isRecord(baselineHealth.archetypeMatch)
    ? { ...baselineHealth.archetypeMatch }
    : {};
  archetypeMatch.ourBrandDistribution = normalizeArchetypeDistribution(
    archetypeMatch.ourBrandDistribution,
  );
  archetypeMatch.competitorAverageDistribution = normalizeArchetypeDistribution(
    archetypeMatch.competitorAverageDistribution,
  );
  baselineHealth.archetypeMatch = archetypeMatch;

  const shareOfVoice = isRecord(raw.shareOfVoice)
    ? { ...raw.shareOfVoice }
    : {};
  if (asStringArray(shareOfVoice.competitorThemesLast30Days).length === 0) {
    shareOfVoice.competitorThemesLast30Days = [
      "Seasonal promotions",
      "Creator partnerships",
    ];
  }

  let inventoryInfrastructure = isRecord(raw.inventoryInfrastructure)
    ? { ...raw.inventoryInfrastructure }
    : undefined;
  const entityRows = Array.isArray(inventoryInfrastructure?.entities)
    ? inventoryInfrastructure.entities
    : [];
  if (entityRows.length === 0 && discoveredProducts.length > 0) {
    inventoryInfrastructure = {
      entities: synthesizeInventoryFromProducts(
        discoveredProducts,
        asStringArray(narrative.brandUsps),
      ),
    };
  } else if (entityRows.length === 0) {
    // Keep schema strict (entities must be non-empty if present) by dropping empty blocks.
    inventoryInfrastructure = undefined;
  } else if (inventoryInfrastructure) {
    inventoryInfrastructure = {
      ...inventoryInfrastructure,
      entities: entityRows
        .filter(isRecord)
        .map((entity) => ({
          ...entity,
          entityType: normalizePrompt1EntityType(entity.entityType),
        })),
    };
  }

  const growthImpactMatrix = isRecord(raw.growthImpactMatrix)
    ? raw.growthImpactMatrix
    : deriveGrowthImpactMatrix(baselineHealth);

  let brandProfile: Record<string, unknown> | undefined;
  if (isRecord(raw.brandProfile)) {
    brandProfile = { ...raw.brandProfile };
    for (const key of [
      "logoUrl",
      "igHandle",
      "ytHandle",
      "tiktokHandle",
      "lifecycleStage",
    ] as const) {
      if (brandProfile[key] === null) {
        delete brandProfile[key];
      }
    }
    if (Object.keys(brandProfile).length === 0) {
      brandProfile = undefined;
    }
  }

  const { brandProfile: _rawBrandProfile, ...rawRest } = raw;

  return {
    ...rawRest,
    ...(brandProfile !== undefined ? { brandProfile } : {}),
    strategicDNA,
    baselineHealth,
    shareOfVoice,
    inventoryInfrastructure,
    growthImpactMatrix,
    offersLedger: Array.isArray(raw.offersLedger)
      ? raw.offersLedger.flatMap((row) => {
          if (!isRecord(row)) {
            return [];
          }
          const offerName =
            asTrimmedString(row.offerName) ?? asTrimmedString(row.name);
          const promoCode =
            asTrimmedString(row.promoCode) ?? asTrimmedString(row.couponCode);
          const applicabilityScope = asTrimmedString(row.applicabilityScope);
          const validityStart = asTrimmedString(row.validityStart);
          const validityEnd = asTrimmedString(row.validityEnd);

          if (
            !offerName ||
            !promoCode ||
            !applicabilityScope ||
            !validityStart ||
            !validityEnd ||
            !isIsoDatetime(validityStart) ||
            !isIsoDatetime(validityEnd)
          ) {
            return [];
          }

          return [
            {
              offerName,
              promoCode,
              applicabilityScope,
              validityStart,
              validityEnd,
              description: asTrimmedString(row.description) ?? undefined,
            },
          ];
        })
      : [],
  };
}
