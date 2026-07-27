import type {
  ExecutionWidgetData,
  SlotFillingData,
} from "../schemas/copilot-payload.schema";

export type WriteIntentKind =
  | "CAMPAIGN_LAUNCH"
  | "CAMPAIGN_EDIT_DRAFT"
  | "INTELLIGENCE_MOVE_TO_PLANNER"
  | "PLANNER_LAUNCH_DRAFT"
  | "DNA_IDENTITY_UPDATE"
  | "DNA_OFFERING_UPDATE"
  | "DNA_PERSONA_CREATE"
  | "PAUSE_CAMPAIGN"
  | "RESUME_CAMPAIGN"
  | "ARCHIVE_CAMPAIGN"
  | "DUPLICATE_CAMPAIGN"
  | "BULK_CAMPAIGN_ACTION";

export type DetectedWriteIntent =
  | { kind: "NONE" }
  | {
      kind: WriteIntentKind;
      stagedPayload: Record<string, unknown>;
      missingSlots: SlotFillingData["missingSlots"];
    };

export type BuildExecutionWidgetArgs = {
  intentKind: WriteIntentKind;
  stagedPayload: Record<string, unknown>;
  idempotencyKey?: string;
};

export type BuildExecutionWidgetFn = (
  args: BuildExecutionWidgetArgs,
) => ExecutionWidgetData | null;
