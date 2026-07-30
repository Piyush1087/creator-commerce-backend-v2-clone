import { Injectable } from "@nestjs/common";
import type { CoPilotScopeContext } from "@prisma/client";
import { randomUUID } from "crypto";

import type { AuthUser } from "../../../auth/types/auth-user";
import type {
  CoPilotAiModule,
  CoPilotModuleReadContext,
  CoPilotModuleReadResult,
} from "../../core/ai-module.contract";
import type { ReadQueryKind } from "../../core/read-kind.types";
import type {
  DetectedWriteIntent,
  WriteIntentKind,
} from "../../core/write-intent.types";
import type { ExecutionWidgetData } from "../../schemas/copilot-payload.schema";
import {
  presentDetailRead,
  wantsFullDetailWidget,
} from "../../utils/co-pilot-presentation.util";
import {
  detectBrandSettingsRead,
  detectBrandSettingsWrite,
} from "./brand-settings.intents";
import { BRAND_SETTINGS_PROMPT_EXTENSION } from "./brand-settings.prompt";
import { BrandSettingsCoPilotToolsService } from "./brand-settings.tools";

const READ_KINDS: ReadQueryKind[] = [
  "SETTINGS_OVERVIEW",
  "SETTINGS_GENERAL",
  "SETTINGS_FINANCE",
  "SETTINGS_INTEGRATIONS",
];

const WRITE_INTENTS: WriteIntentKind[] = [
  "SETTINGS_UPDATE_GENERAL",
  "SETTINGS_UPDATE_BILLING",
  "SETTINGS_LINK_WITHDRAWAL",
];

@Injectable()
export class BrandSettingsAiModule implements CoPilotAiModule {
  readonly id = "brand-settings";
  readonly name = "Brand Settings";
  readonly supportedReadKinds = READ_KINDS;
  readonly supportedWriteIntents = WRITE_INTENTS;
  readonly promptExtension = BRAND_SETTINGS_PROMPT_EXTENSION;

  constructor(private readonly tools: BrandSettingsCoPilotToolsService) {}

  detectRead(
    userText: string,
    _scope: CoPilotScopeContext,
  ): ReadQueryKind | null {
    return detectBrandSettingsRead(userText);
  }

  detectWrite(
    userText: string,
    _history: Array<{ role: "USER" | "ASSISTANT"; text: string }>,
  ): DetectedWriteIntent | null {
    return detectBrandSettingsWrite(userText);
  }

  async executeRead(
    kind: ReadQueryKind,
    ctx: CoPilotModuleReadContext,
  ): Promise<CoPilotModuleReadResult | null> {
    if (!READ_KINDS.includes(kind)) {
      return null;
    }

    const authUser = ctx.authUser as AuthUser | undefined;
    if (!authUser) {
      return {
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText:
          "I couldn’t load Brand Settings without an authenticated brand session.",
      };
    }

    if (kind === "SETTINGS_OVERVIEW") {
      const overview = await this.tools.getOverview(authUser);
      return {
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText: this.tools.overviewNarrative(overview),
        toolsInvoked: ["settings.getOverview"],
      };
    }

    if (kind === "SETTINGS_GENERAL") {
      const general = await this.tools.getGeneral(authUser);
      return {
        ...presentDetailRead({
          userText: ctx.userText,
          narrativeText: this.tools.generalNarrative(general),
          metricGridData: this.tools.generalMetrics(general),
          preferMetrics: wantsFullDetailWidget(ctx.userText),
          toolsInvoked: ["settings.getGeneral"],
        }),
      };
    }

    if (kind === "SETTINGS_FINANCE") {
      const [billing, withdrawal] = await Promise.all([
        this.tools.getBillingProfile(authUser),
        this.tools.getWithdrawalAccount(authUser),
      ]);
      return {
        ...presentDetailRead({
          userText: ctx.userText,
          narrativeText: this.tools.financeNarrative(
            billing,
            withdrawal,
            ctx.userText,
          ),
          metricGridData: this.tools.financeMetrics(billing, withdrawal),
          preferMetrics:
            wantsFullDetailWidget(ctx.userText) ||
            /\b(finance settings|billing settings|show (?:my )?billing)\b/i.test(
              ctx.userText,
            ),
          toolsInvoked: [
            "settings.getBillingProfile",
            "settings.getWithdrawalAccount",
          ],
        }),
      };
    }

    if (kind === "SETTINGS_INTEGRATIONS") {
      return {
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText: this.tools.integrationsNarrative(),
        toolsInvoked: ["settings.viewIntegrations"],
      };
    }

    return null;
  }

  async enrichWriteIntent(
    intent: Exclude<DetectedWriteIntent, { kind: "NONE" }>,
  ): Promise<Exclude<DetectedWriteIntent, { kind: "NONE" }>> {
    if (!WRITE_INTENTS.includes(intent.kind as WriteIntentKind)) {
      return intent;
    }

    const stagedPayload = { ...intent.stagedPayload };
    const missingSlots = intent.missingSlots.filter((slot) => {
      const value = stagedPayload[slot.fieldName];
      if (value === undefined || value === null) {
        return true;
      }
      if (typeof value === "string" && !value.trim()) {
        return true;
      }
      return false;
    });

    return {
      kind: intent.kind,
      stagedPayload,
      missingSlots,
    };
  }

  buildExecutionWidget(args: {
    intentKind: WriteIntentKind;
    stagedPayload: Record<string, unknown>;
    idempotencyKey: string;
  }): ExecutionWidgetData | null {
    if (!WRITE_INTENTS.includes(args.intentKind)) {
      return null;
    }

    const key = args.idempotencyKey || randomUUID();
    const fields = { ...args.stagedPayload };

    switch (args.intentKind) {
      case "SETTINGS_UPDATE_GENERAL":
        return {
          formTargetRoute: "/api/v1/brand/settings/general",
          idempotencyKey: key,
          prefilledFields: fields,
          requiredZodValidationSchemaName: "UpdateBrandGeneralProfileSchema",
          primaryActionLabel: "Confirm general settings update",
          cancelActionLabel: "Discard",
        };
      case "SETTINGS_UPDATE_BILLING":
        return {
          formTargetRoute: "/api/v1/brand/settings/billing-profile",
          idempotencyKey: key,
          prefilledFields: fields,
          requiredZodValidationSchemaName: "BrandBillingProfileSchema",
          primaryActionLabel: "Confirm billing profile update",
          cancelActionLabel: "Discard",
        };
      case "SETTINGS_LINK_WITHDRAWAL":
        return {
          formTargetRoute: "/api/v1/brand/settings/withdrawal-account",
          idempotencyKey: key,
          prefilledFields: fields,
          requiredZodValidationSchemaName: "BrandWithdrawalAccountSchema",
          primaryActionLabel: "Confirm link withdrawal account",
          cancelActionLabel: "Discard",
        };
      default:
        return null;
    }
  }

  writeSlotNarrative(
    kind: WriteIntentKind,
    _stagedPayload?: Record<string, unknown>,
  ): string | null {
    switch (kind) {
      case "SETTINGS_UPDATE_GENERAL":
        return "I can update organization settings after you confirm. Fill any missing fields below.";
      case "SETTINGS_UPDATE_BILLING":
        return "I can update the billing profile (company, address, GST/PAN) after you confirm.";
      case "SETTINGS_LINK_WITHDRAWAL":
        return "I can link a withdrawal bank account after you confirm the details.";
      default:
        return null;
    }
  }

  hitlReviewNarrative(
    kind: WriteIntentKind,
    _stagedPayload?: Record<string, unknown>,
  ): string | null {
    switch (kind) {
      case "SETTINGS_UPDATE_GENERAL":
        return "Review the general settings update below. Nothing is saved until you confirm.";
      case "SETTINGS_UPDATE_BILLING":
        return "Review the billing profile update below. Nothing is saved until you confirm.";
      case "SETTINGS_LINK_WITHDRAWAL":
        return "Review the withdrawal bank details below. Nothing is saved until you confirm.";
      default:
        return null;
    }
  }
}
