import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

import type {
  ExecutionWidgetData,
  SlotFillingData,
} from "../../co-pilot/schemas/copilot-payload.schema";

export type CreatorWriteIntentKind = "MEDIA_KIT_UPDATE";

export type CreatorDetectedWriteIntent =
  | { kind: "NONE" }
  | {
      kind: CreatorWriteIntentKind;
      stagedPayload: Record<string, unknown>;
      missingSlots: SlotFillingData["missingSlots"];
    };

@Injectable()
export class CreatorCoPilotIntentService {
  detectWriteIntent(userText: string): CreatorDetectedWriteIntent {
    return this.detectMediaKitUpdate(userText) ?? { kind: "NONE" };
  }

  private detectMediaKitUpdate(userText: string): CreatorDetectedWriteIntent | null {
    const n = userText.toLowerCase();
    const mentionsMediaKit =
      n.includes("media kit") ||
      n.includes("mediakit") ||
      n.includes("rate") ||
      n.includes("pricing") ||
      n.includes("bio");
    const isWrite =
      n.includes("update") ||
      n.includes("change") ||
      n.includes("set") ||
      n.includes("hide") ||
      n.includes("show") ||
      n.includes("tweak");

    if (!mentionsMediaKit || !isWrite) {
      return null;
    }

    const stagedPayload: Record<string, unknown> = {};
    const missingSlots: SlotFillingData["missingSlots"] = [];

    const videoRate = userText.match(/\$?\s*(\d{2,7})\s*(?:for|video|reel)/i);
    if (videoRate?.[1]) {
      stagedPayload.shortFormVideoRate = Number(videoRate[1]);
    } else {
      missingSlots.push({
        fieldName: "shortFormVideoRate",
        uiLabel: "Short-form video rate (USD)",
        inputType: "NUMBER",
        placeholderText: "e.g. 1250",
      });
    }

    const storyRate = userText.match(/story[^$]*\$?\s*(\d{2,7})/i);
    if (storyRate?.[1]) {
      stagedPayload.storyBundleRate = Number(storyRate[1]);
    }

    if (n.includes("hide") && n.includes("view")) {
      stagedPayload.showViewsMetric = false;
    }
    if (n.includes("show") && n.includes("view")) {
      stagedPayload.showViewsMetric = true;
    }

    return {
      kind: "MEDIA_KIT_UPDATE",
      stagedPayload,
      missingSlots,
    };
  }

  buildSlotFillingPayload(args: {
    narrativeText: string;
    intentWorkspaceContext: CreatorWriteIntentKind;
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
    intentKind: CreatorWriteIntentKind;
    stagedPayload: Record<string, unknown>;
    idempotencyKey?: string;
  }): ExecutionWidgetData {
    const key = args.idempotencyKey ?? randomUUID();
    return {
      formTargetRoute: "/api/v1/creator-centre/media-kit",
      idempotencyKey: key,
      prefilledFields: args.stagedPayload,
      requiredZodValidationSchemaName: "MediaKitSaveSchema",
      primaryActionLabel: "Save Media Kit updates",
      cancelActionLabel: "Discard",
    };
  }
}
