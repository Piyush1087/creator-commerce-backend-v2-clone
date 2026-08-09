import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

import type {
  DetectedWriteIntent,
  WriteIntentKind,
} from "../core/write-intent.types";
import type {
  ExecutionWidgetData,
  SlotFillingData,
} from "../schemas/copilot-payload.schema";
import {
  type DnaIdentityUpdateAxis,
  parseDnaIdentityUpdate,
  parsePaletteColorsInput,
} from "../utils/co-pilot-dna-identity.util";
import {
  isMoveLeakToPlannerQuery,
  parseLeakTitleHint,
} from "../utils/co-pilot-leak-planner.util";
import { isPlannerLaunchWriteQuery } from "../utils/co-pilot-planner.util";

export type { DetectedWriteIntent, WriteIntentKind };

const CAMPAIGN_OBJECTIVES = [
  "BRAND_AWARENESS",
  "TRAFFIC_CLICKS",
  "SALES_CONVERSIONS",
] as const;

@Injectable()
export class CoPilotIntentService {
  detectWriteIntent(
    userText: string,
    history: Array<{ role: "USER" | "ASSISTANT"; text: string }> = [],
  ): DetectedWriteIntent {
    return (
      this.detectDnaPersonaCreate(userText) ??
      this.detectDnaOfferingUpdate(userText) ??
      this.detectDnaIdentityUpdate(userText) ??
      this.detectCampaignEditDraft(userText) ??
      // Move-leak before launch-card — "move … planner" must not stage launch.
      this.detectIntelligenceMoveToPlanner(userText, history) ??
      this.detectPlannerLaunchDraft(userText) ??
      this.detectCampaignLaunch(userText) ??
      { kind: "NONE" }
    );
  }

  detectIntelligenceMoveToPlanner(
    userText: string,
    _history: Array<{ role: "USER" | "ASSISTANT"; text: string }> = [],
  ): DetectedWriteIntent | null {
    if (!isMoveLeakToPlannerQuery(userText)) {
      return null;
    }

    const titleHint = parseLeakTitleHint(userText);

    return {
      kind: "INTELLIGENCE_MOVE_TO_PLANNER",
      stagedPayload: {
        leak_title_hint: titleHint,
      },
      missingSlots: [
        {
          fieldName: "leak_id",
          uiLabel: "Intelligence leak to move",
          inputType: "SINGLE_SELECT",
          selectOptions: [],
          placeholderText: "Choose a leak from Intelligence & Gaps",
        },
      ],
    };
  }

  detectPlannerLaunchDraft(userText: string): DetectedWriteIntent | null {
    if (!isPlannerLaunchWriteQuery(userText)) {
      return null;
    }

    return {
      kind: "PLANNER_LAUNCH_DRAFT",
      stagedPayload: {},
      missingSlots: [
        {
          fieldName: "planner_card_id",
          uiLabel: "Planner card to launch",
          inputType: "SINGLE_SELECT",
          selectOptions: [],
          placeholderText: "Choose a green planner card",
        },
      ],
    };
  }

  detectCampaignEditDraft(userText: string): DetectedWriteIntent | null {
    const n = userText.toLowerCase();
    if (
      !(
        (n.includes("edit") || n.includes("update")) &&
        n.includes("draft") &&
        n.includes("campaign")
      )
    ) {
      return null;
    }

    const nameMatch = userText.match(
      /(?:campaign|draft)\s+["']?([^"']+)["']?/i,
    )?.[1]?.trim();
    const budgetMatch = userText.match(/budget\s+(?:to\s+)?(\d+)/i)?.[1];

    const stagedPayload: Record<string, unknown> = {
      campaign_name: nameMatch,
      budget_allocation: budgetMatch ? Number(budgetMatch) : undefined,
    };

    const missingSlots: SlotFillingData["missingSlots"] = [
      {
        fieldName: "campaign_id",
        uiLabel: "Draft campaign to edit",
        inputType: "SINGLE_SELECT",
        selectOptions: [],
        placeholderText: "Choose a DRAFT campaign",
      },
    ];

    if (!budgetMatch) {
      missingSlots.push({
        fieldName: "budget_allocation",
        uiLabel: "New budget pool (INR)",
        inputType: "NUMBER",
        placeholderText: "e.g. 150000",
      });
    }

    if (!budgetMatch && !nameMatch) {
      missingSlots.push({
        fieldName: "marketing_objective",
        uiLabel: "Marketing objective",
        inputType: "SINGLE_SELECT",
        selectOptions: [...CAMPAIGN_OBJECTIVES],
        placeholderText: "Choose objective",
      });
    }

    return {
      kind: "CAMPAIGN_EDIT_DRAFT",
      stagedPayload,
      missingSlots,
    };
  }

  detectCampaignLaunch(userText: string): DetectedWriteIntent {
    const normalized = userText.toLowerCase();
    if (
      normalized.includes("launch readiness") ||
      normalized.includes("before uce") ||
      (normalized.includes("readiness") && !normalized.includes("campaign"))
    ) {
      return { kind: "NONE" };
    }

    const triggers = [
      "launch a campaign",
      "launch campaign",
      "create a campaign",
      "create campaign",
      "campaign for",
      "start a campaign",
    ];

    if (!triggers.some((t) => normalized.includes(t))) {
      return { kind: "NONE" };
    }

    if (normalized.includes("planner")) {
      return { kind: "NONE" };
    }

    const productMatch =
      normalized
        .match(
          /(?:campaign for|launch(?: a)? campaign for|create(?: a)? campaign for)\s+(.+)/i,
        )?.[1]
        ?.replace(/\.$/, "")
        .trim() ?? "";

    const stagedPayload: Record<string, unknown> = {
      product_name: productMatch || undefined,
    };

    const missingSlots: SlotFillingData["missingSlots"] = [];

    if (!productMatch) {
      missingSlots.push({
        fieldName: "product_name",
        uiLabel: "Product or campaign focus",
        inputType: "TEXT",
        placeholderText: "e.g. Retinol serum launch",
      });
    }

    missingSlots.push(
      {
        fieldName: "budget_allocation",
        uiLabel: "Campaign budget (INR)",
        inputType: "NUMBER",
        placeholderText: "e.g. 150000",
      },
      {
        fieldName: "marketing_objective",
        uiLabel: "Marketing objective",
        inputType: "SINGLE_SELECT",
        selectOptions: [...CAMPAIGN_OBJECTIVES],
        placeholderText: "Choose objective",
      },
    );

    return { kind: "CAMPAIGN_LAUNCH", stagedPayload, missingSlots };
  }

  detectDnaIdentityUpdate(userText: string): DetectedWriteIntent | null {
    const parsed = parseDnaIdentityUpdate(userText);
    if (!parsed || parsed.axes.length === 0) {
      return null;
    }

    return {
      kind: "DNA_IDENTITY_UPDATE",
      stagedPayload: parsed.stagedPayload,
      missingSlots: parsed.missingSlots,
    };
  }

  detectDnaOfferingUpdate(userText: string): DetectedWriteIntent | null {
    const n = userText.toLowerCase();
    if (
      !(
        (n.includes("update") || n.includes("change")) &&
        (n.includes("description") || n.includes("short description")) &&
        (n.includes("product") || n.includes("offering") || n.includes("serum"))
      )
    ) {
      return null;
    }

    const productMatch =
      userText.match(
        /(?:for|of)\s+(?:our\s+)?(.+?)(?:\s+product|\s+offering|$)/i,
      )?.[1]?.trim() ?? "";

    const descMatch = userText.match(
      /description to\s+["']?(.+?)["']?$/i,
    )?.[1]?.trim();

    const stagedPayload: Record<string, unknown> = {
      offering_name: productMatch || undefined,
      description: descMatch,
    };

    const missingSlots: SlotFillingData["missingSlots"] = [];
    if (!productMatch) {
      missingSlots.push({
        fieldName: "offering_name",
        uiLabel: "Product / offering name",
        inputType: "TEXT",
        placeholderText: "e.g. Vitamin C serum",
      });
    }
    if (!descMatch) {
      missingSlots.push({
        fieldName: "description",
        uiLabel: "New short description",
        inputType: "TEXT",
        placeholderText: "Max 500 characters",
      });
    }

    return {
      kind: "DNA_OFFERING_UPDATE",
      stagedPayload,
      missingSlots,
    };
  }

  detectDnaPersonaCreate(userText: string): DetectedWriteIntent | null {
    const n = userText.toLowerCase();
    if (!(n.includes("create") && n.includes("persona"))) {
      return null;
    }

    const nameMatch = userText.match(
      /persona called\s+["']?([^"']+)["']?/i,
    )?.[1]?.trim();

    const stagedPayload: Record<string, unknown> = {
      persona_name: nameMatch,
    };

    const missingSlots: SlotFillingData["missingSlots"] = [];
    if (!nameMatch) {
      missingSlots.push({
        fieldName: "persona_name",
        uiLabel: "Persona name",
        inputType: "TEXT",
        placeholderText: "e.g. Eco-Conscious Moms",
      });
    }

    missingSlots.push(
      {
        fieldName: "age_min",
        uiLabel: "Minimum age",
        inputType: "NUMBER",
        placeholderText: "e.g. 30",
      },
      {
        fieldName: "age_max",
        uiLabel: "Maximum age",
        inputType: "NUMBER",
        placeholderText: "e.g. 45",
      },
      {
        fieldName: "interests",
        uiLabel: "Interest focus",
        inputType: "TEXT",
        placeholderText: "e.g. Clean beauty, urban lifestyle",
      },
    );

    return {
      kind: "DNA_PERSONA_CREATE",
      stagedPayload,
      missingSlots,
    };
  }

  buildSlotFillingPayload(args: {
    narrativeText: string;
    intentWorkspaceContext: string;
    stagedPayload: Record<string, unknown>;
    missingSlots: SlotFillingData["missingSlots"];
  }) {
    return {
      formatType: "SLOT_FILLING_CLARIFICATION" as const,
      narrativeText: args.narrativeText,
      slotFillingData: {
        intentWorkspaceContext: args.intentWorkspaceContext,
        stagedPayload: args.stagedPayload,
        missingSlots: args.missingSlots,
      },
    };
  }

  buildExecutionWidget(args: {
    intentKind: WriteIntentKind;
    stagedPayload: Record<string, unknown>;
    idempotencyKey?: string;
  }): ExecutionWidgetData {
    const key = args.idempotencyKey ?? randomUUID();

    switch (args.intentKind) {
      case "DNA_IDENTITY_UPDATE": {
        const axes = (args.stagedPayload.update_axes ?? []) as DnaIdentityUpdateAxis[];
        const paletteRaw = args.stagedPayload.palette_colors;
        const prefilled: Record<string, unknown> = {
          update_scope: axes.join(", "),
          current_palette: args.stagedPayload.current_palette,
          current_fonts: args.stagedPayload.current_fonts,
          current_aesthetics: args.stagedPayload.current_aesthetics,
        };

        if (axes.includes("palette") && paletteRaw) {
          prefilled.new_palette = parsePaletteColorsInput(paletteRaw);
        }
        if (axes.includes("fonts") && args.stagedPayload.primary_font) {
          prefilled.new_primary_font = args.stagedPayload.primary_font;
        }
        if (axes.includes("aesthetics") && args.stagedPayload.aesthetic_style) {
          prefilled.new_aesthetic_style = args.stagedPayload.aesthetic_style;
        }

        return {
          formTargetRoute: "/api/v1/brand-centre/dna/identity",
          idempotencyKey: key,
          prefilledFields: prefilled,
          requiredZodValidationSchemaName: "PatchDnaIdentityDto",
          primaryActionLabel: "Confirm DNA identity update",
          cancelActionLabel: "Discard changes",
        };
      }
      case "DNA_OFFERING_UPDATE":
        return {
          formTargetRoute: "/api/v1/brand-centre/dna/offerings",
          idempotencyKey: key,
          prefilledFields: {
            offering_name: args.stagedPayload.offering_name,
            description: args.stagedPayload.description,
          },
          requiredZodValidationSchemaName: "UpdateOfferingDto",
          primaryActionLabel: "Confirm product description update",
          cancelActionLabel: "Discard changes",
        };
      case "DNA_PERSONA_CREATE":
        return {
          formTargetRoute: "/api/v1/brand-centre/dna/personas",
          idempotencyKey: key,
          prefilledFields: {
            persona_name: args.stagedPayload.persona_name,
            age_min: args.stagedPayload.age_min,
            age_max: args.stagedPayload.age_max,
            interests: args.stagedPayload.interests,
          },
          requiredZodValidationSchemaName: "CreatePersonaDto",
          primaryActionLabel: "Confirm persona creation",
          cancelActionLabel: "Discard draft",
        };
      case "INTELLIGENCE_MOVE_TO_PLANNER":
        return {
          formTargetRoute: "/api/v1/brand-centre/intelligence/leaks/move-to-planner",
          idempotencyKey: key,
          prefilledFields: {
            leak: args.stagedPayload.leak_title,
          },
          requiredZodValidationSchemaName: "MoveLeakToPlannerDto",
          primaryActionLabel: "Send to Campaign Planner",
          cancelActionLabel: "Cancel",
        };
      case "PLANNER_LAUNCH_DRAFT":
        return {
          formTargetRoute: "/api/v1/orchestration/process-signal",
          idempotencyKey: key,
          prefilledFields: {
            planner_card:
              args.stagedPayload.planner_card_label ??
              args.stagedPayload.planner_card_id,
          },
          requiredZodValidationSchemaName: "PlannerLaunchBridgeSchema",
          primaryActionLabel: "Approve & create draft campaign",
          cancelActionLabel: "Discard",
        };
      case "CAMPAIGN_EDIT_DRAFT":
        return {
          formTargetRoute: "/api/v1/brand-uce/campaigns/draft-edit",
          idempotencyKey: key,
          prefilledFields: {
            campaign_id: args.stagedPayload.campaign_id,
            campaign_name: args.stagedPayload.campaign_name,
            budget_allocation: args.stagedPayload.budget_allocation,
            marketing_objective: args.stagedPayload.marketing_objective,
          },
          requiredZodValidationSchemaName: "PatchDraftCampaignWizardDto",
          primaryActionLabel: "Confirm draft campaign update",
          cancelActionLabel: "Discard changes",
        };
      case "CAMPAIGN_LAUNCH":
      default: {
        const productName = String(
          args.stagedPayload.product_name ?? "Co-Pilot Campaign",
        );
        const budget = Number(args.stagedPayload.budget_allocation ?? 0);
        const objective = String(
          args.stagedPayload.marketing_objective ?? "SALES_CONVERSIONS",
        );
        return {
          formTargetRoute: "/brand/uce/campaigns/create",
          idempotencyKey: key,
          prefilledFields: {
            campaign_name: `${productName} — Co-Pilot Draft`,
            total_campaign_budget_pool: budget,
            core_objective: objective,
            product_name: productName,
          },
          requiredZodValidationSchemaName: "IntegratedCampaignWizardPayloadSchema",
          primaryActionLabel: "Create draft campaign",
          cancelActionLabel: "Discard draft",
        };
      }
    }
  }
}
