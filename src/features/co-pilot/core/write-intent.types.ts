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
  | "GO_LIVE_CAMPAIGN"
  | "ARCHIVE_CAMPAIGN"
  | "DUPLICATE_CAMPAIGN"
  | "BULK_CAMPAIGN_ACTION"
  | "COLLAB_COUNTER_OFFER"
  | "COLLAB_ACCEPT_TERMS"
  | "COLLAB_FUND_ESCROW"
  | "COLLAB_DISPATCH"
  | "COLLAB_APPROVE_CONTENT"
  | "COLLAB_REQUEST_REVISION"
  | "COLLAB_VERIFY_COMPLIANCE"
  | "SETTINGS_UPDATE_GENERAL"
  | "SETTINGS_UPDATE_BILLING"
  | "SETTINGS_LINK_WITHDRAWAL";

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
