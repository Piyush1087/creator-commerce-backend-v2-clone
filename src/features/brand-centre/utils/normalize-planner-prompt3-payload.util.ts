const OBJECTIVES = ["PULSE", "PROOF", "PUSH", "PRODUCTION"] as const;
const TIERS = ["NANO", "MICRO", "MID_TIER", "MEGA", "CELEBRITY"] as const;
const CARD_TYPES = ["NEW_CAMPAIGN", "SUGGESTED_UPDATE", "AUTO_PAUSE_LOG"] as const;
const ENTITY_TYPES = [
  "PRODUCT",
  "MODULE",
  "TREATMENT",
  "EXPERIENCE",
  "COLLECTION",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isIsoDatetime(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function normalizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof value !== "string") {
    return fallback;
  }
  const upper = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(upper)
    ? (upper as T)
    : fallback;
}

function normalizeEntityType(value: unknown): (typeof ENTITY_TYPES)[number] {
  return normalizeEnum(value, ENTITY_TYPES, "PRODUCT");
}

function defaultDeadlineIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

function normalizeBudgetParameters(
  value: unknown,
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return {
      minAllocationThreshold: 500,
      maxAllocationThreshold: 2500,
    };
  }
  let min =
    typeof value.minAllocationThreshold === "number"
      ? value.minAllocationThreshold
      : 500;
  let max =
    typeof value.maxAllocationThreshold === "number"
      ? value.maxAllocationThreshold
      : 2500;
  min = Math.max(500, min);
  max = Math.max(min, max);
  return {
    ...value,
    minAllocationThreshold: min,
    maxAllocationThreshold: max,
  };
}

function normalizeAudience(value: unknown): Record<string, unknown> {
  const base = isRecord(value) ? { ...value } : {};
  const ensureStrings = (key: string, fallback: string[]) => {
    const arr = Array.isArray(base[key])
      ? (base[key] as unknown[]).filter((v): v is string => typeof v === "string")
      : [];
    base[key] = arr.length > 0 ? arr : fallback;
  };
  ensureStrings("geoTargets", ["US"]);
  ensureStrings("genderFocus", ["All"]);
  ensureStrings("ageWindows", ["25-34"]);
  ensureStrings("explicitInterests", ["Brand affinity"]);
  return base;
}

function normalizeBriefs(entityName: string, briefsRaw: unknown): unknown[] {
  if (!Array.isArray(briefsRaw) || briefsRaw.length === 0) {
    return [
      {
        briefName: `${entityName} launch brief`,
        contentPillarThemeCore: `Creator content highlighting ${entityName} benefits and proof points.`,
        requiredDeliverables: [{ platform: "Instagram", quantity: 1 }],
        operationalChecklists: {},
      },
    ];
  }
  return briefsRaw.filter(isRecord).map((brief, index) => {
    const briefName =
      asTrimmedString(brief.briefName) ?? `${entityName} brief ${index + 1}`;
    const contentPillarThemeCore =
      asTrimmedString(brief.contentPillarThemeCore) ??
      `Campaign narrative for ${entityName} aligned to brand objective.`;
    const deliverables = Array.isArray(brief.requiredDeliverables)
      ? brief.requiredDeliverables
          .filter(isRecord)
          .map((d) => ({
            platform:
              asTrimmedString(d.platform) ?? "Instagram",
            quantity:
              typeof d.quantity === "number" && d.quantity >= 1
                ? Math.floor(d.quantity)
                : 1,
          }))
          .filter((d) => d.platform.length > 0)
      : [];
    return {
      ...brief,
      briefName,
      contentPillarThemeCore:
        contentPillarThemeCore.length >= 10
          ? contentPillarThemeCore
          : `${contentPillarThemeCore} campaign story.`.slice(0, 120),
      requiredDeliverables:
        deliverables.length > 0
          ? deliverables
          : [{ platform: "Instagram", quantity: 1 }],
      operationalChecklists: isRecord(brief.operationalChecklists)
        ? brief.operationalChecklists
        : {},
    };
  });
}

function normalizeAssetsMatrix(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [
      {
        entityName: "Hero offer",
        entityType: "PRODUCT",
        productionBriefs: normalizeBriefs("Hero offer", []),
      },
    ];
  }
  const rows = value.filter(isRecord).map((row) => {
    const entityName =
      asTrimmedString(row.entityName) ?? "Campaign inventory item";
    const entityId = asTrimmedString(row.entityId);
    return {
      ...row,
      entityName,
      ...(entityId && isUuid(entityId) ? { entityId } : {}),
      entityType: normalizeEntityType(row.entityType),
      productionBriefs: normalizeBriefs(entityName, row.productionBriefs),
    };
  });
  return rows.length > 0
    ? rows
    : [
        {
          entityName: "Hero offer",
          entityType: "PRODUCT",
          productionBriefs: normalizeBriefs("Hero offer", []),
        },
      ];
}

/**
 * Coerce Gemini Prompt 3 output before Zod (unwrap arrays, fix enums, budgets).
 */
export function normalizePlannerPrompt3Payload(raw: unknown): unknown {
  let candidate: unknown = raw;
  if (Array.isArray(candidate)) {
    candidate =
      candidate.find((item) => isRecord(item) && Object.keys(item).length > 0) ??
      candidate[0];
  }
  if (!isRecord(candidate)) {
    return raw;
  }

  const out: Record<string, unknown> = { ...candidate };

  let cardType = normalizeEnum(out.cardType, CARD_TYPES, "NEW_CAMPAIGN");
  let existingId: string | null = null;
  const existingRaw = out.existingTargetCampaignId;
  if (typeof existingRaw === "string" && isUuid(existingRaw)) {
    existingId = existingRaw;
  }

  if (cardType === "SUGGESTED_UPDATE" && !existingId) {
    cardType = "NEW_CAMPAIGN";
  }
  if (cardType === "NEW_CAMPAIGN" || cardType === "AUTO_PAUSE_LOG") {
    existingId = null;
  }

  out.cardType = cardType;
  out.existingTargetCampaignId = existingId;

  const aggregationKey = isRecord(out.aggregationKey)
    ? { ...out.aggregationKey }
    : {};
  const hook =
    asTrimmedString(aggregationKey.aiContextHook) ??
    "Consolidated campaign from approved insight";
  aggregationKey.objective = normalizeEnum(
    aggregationKey.objective,
    OBJECTIVES,
    "PULSE",
  );
  aggregationKey.targetCreatorTier = normalizeEnum(
    aggregationKey.targetCreatorTier,
    TIERS,
    "MICRO",
  );
  aggregationKey.aiContextHook =
    hook.length >= 5 ? hook : "Consolidated campaign draft";
  out.aggregationKey = aggregationKey;

  const metadata = isRecord(out.campaignMetadata)
    ? { ...out.campaignMetadata }
    : {};
  metadata.audienceDemographics = normalizeAudience(
    metadata.audienceDemographics,
  );
  metadata.operationalBudgetParameters = normalizeBudgetParameters(
    metadata.operationalBudgetParameters,
  );
  const deadline = asTrimmedString(metadata.campaignArchitectureDeadline);
  metadata.campaignArchitectureDeadline =
    deadline && isIsoDatetime(deadline) ? deadline : defaultDeadlineIso();
  out.campaignMetadata = metadata;

  out.assetsAndBriefsMatrix = normalizeAssetsMatrix(out.assetsAndBriefsMatrix);

  if (cardType === "AUTO_PAUSE_LOG") {
    out.workflowStatus = "AUTO_EXECUTED_BYPASS";
  } else if (
    out.workflowStatus !== "PENDING_USER_REVIEW" &&
    out.workflowStatus !== "PROCEEDED_TO_PIPELINE" &&
    out.workflowStatus !== "DISCARDED" &&
    out.workflowStatus !== "AUTO_EXECUTED_BYPASS"
  ) {
    out.workflowStatus = "PENDING_USER_REVIEW";
  }

  return out;
}
