import { IndustryVertical } from "@prisma/client";

import type {
  InboundInjectSignal,
  InboundLaunchSignal,
} from "../../brand-centre-uce-bridge/schemas/bridge-signal.schema";

type PlannerCardRow = {
  id: string;
  aggregationKey: unknown;
  campaignMetadata: unknown;
  assetsAndBriefsMatrix: unknown;
};

export function mapIndustryVerticalToBridgeSector(
  industry: IndustryVertical,
): InboundLaunchSignal["industry_sector"] {
  switch (industry) {
    case IndustryVertical.HEALTHCARE:
      return "HEALTHCARE";
    case IndustryVertical.SAAS_AI:
      return "AI_SAAS";
    case IndustryVertical.OFFLINE_SERVICES:
      return "OFFLINE_EXPERIENCES";
    default:
      return "D2C_ECOMMERCE";
  }
}

export function mapPlannerObjectiveToMacro(
  objective: string | null | undefined,
): InboundLaunchSignal["assigned_macro_objective"] {
  switch (objective) {
    case "PRODUCTION":
      return "PRODUCTION";
    case "PROOF":
      return "PROOF_PUSH";
    case "PULSE":
    case "PUSH":
    default:
      return "PULSE";
  }
}

export function buildBridgeLaunchSignal(args: {
  brandProfileId: string;
  industry: IndustryVertical;
  card: PlannerCardRow;
}): InboundLaunchSignal {
  const key = (args.card.aggregationKey ?? {}) as Record<string, unknown>;
  const meta = (args.card.campaignMetadata ?? {}) as Record<string, unknown>;
  const hook =
    typeof key.aiContextHook === "string" && key.aiContextHook.length >= 3
      ? key.aiContextHook
      : "Co-Pilot Planner Campaign";

  const budgetParams = meta.operationalBudgetParameters as
    | { maxAllocationThreshold?: number }
    | undefined;
  const maxBudget = budgetParams?.maxAllocationThreshold ?? 3500;
  const creatorCount = countCreatorSlots(args.card.assetsAndBriefsMatrix);

  const deadline =
    typeof meta.campaignArchitectureDeadline === "string"
      ? meta.campaignArchitectureDeadline
      : "evergreen";

  return {
    signal_type: "LAUNCH_NEW_FRAMEWORK",
    brand_id: args.brandProfileId,
    campaign_name: hook.slice(0, 255),
    industry_sector: mapIndustryVerticalToBridgeSector(args.industry),
    assigned_macro_objective: mapPlannerObjectiveToMacro(
      typeof key.objective === "string" ? key.objective : null,
    ),
    raw_budget_expression: `$${maxBudget} per creator allocation for ${creatorCount} creators`,
    timeline_expression: deadline,
  };
}

export function buildBridgeInjectSignals(args: {
  campaignId: string;
  card: PlannerCardRow;
  hookText: string;
}): InboundInjectSignal[] {
  const matrix = Array.isArray(args.card.assetsAndBriefsMatrix)
    ? args.card.assetsAndBriefsMatrix
    : [];
  const meta = (args.card.campaignMetadata ?? {}) as Record<string, unknown>;
  const budgetParams = meta.operationalBudgetParameters as
    | { maxAllocationThreshold?: number }
    | undefined;
  const basePrice = budgetParams?.maxAllocationThreshold ?? 3500;

  const signals: InboundInjectSignal[] = [];

  for (const entityRow of matrix) {
    const entity = entityRow as Record<string, unknown>;
    const productName =
      typeof entity.entityName === "string" ? entity.entityName : "Product";
    const briefs = Array.isArray(entity.productionBriefs)
      ? entity.productionBriefs
      : [];

    for (const briefRow of briefs) {
      if (signals.length >= 10) {
        break;
      }
      const brief = briefRow as Record<string, unknown>;
      const briefName =
        typeof brief.briefName === "string" ? brief.briefName : "Brief";
      signals.push({
        signal_type: "INJECT_ASSET_LINE",
        campaign_id: args.campaignId,
        product_name: productName,
        estimated_base_price: basePrice,
        raw_strategic_context: args.hookText,
        creative_briefs: [
          {
            brief_name: briefName,
            deliverable_type: "REEL_VIDEO",
            compensation_type: "BARTER",
          },
        ],
      });
    }
  }

  if (signals.length === 0) {
    signals.push({
      signal_type: "INJECT_ASSET_LINE",
      campaign_id: args.campaignId,
      product_name: "Planner offering",
      estimated_base_price: basePrice,
      raw_strategic_context: args.hookText,
      creative_briefs: [
        {
          brief_name: "Planner brief",
          deliverable_type: "REEL_VIDEO",
          compensation_type: "BARTER",
        },
      ],
    });
  }

  return signals;
}

function countCreatorSlots(assetsAndBriefsMatrix: unknown): number {
  const matrix = Array.isArray(assetsAndBriefsMatrix)
    ? assetsAndBriefsMatrix
    : [];
  let qty = 0;
  for (const entityRow of matrix) {
    const entity = entityRow as Record<string, unknown>;
    const briefs = Array.isArray(entity.productionBriefs)
      ? entity.productionBriefs
      : [];
    for (const briefRow of briefs) {
      const brief = briefRow as Record<string, unknown>;
      const deliverables = Array.isArray(brief.requiredDeliverables)
        ? brief.requiredDeliverables
        : [];
      for (const deliverable of deliverables) {
        const d = deliverable as Record<string, unknown>;
        qty += typeof d.quantity === "number" ? d.quantity : 1;
      }
    }
  }
  return Math.max(qty, Math.max(matrix.length * 2, 1));
}
