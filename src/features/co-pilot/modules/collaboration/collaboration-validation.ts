/**
 * Part 5 — map Collaboration workflow failures into AI checklists.
 * Does not change validators; only interprets errors for chat recovery.
 */

import type { ValidationChecklistData } from "../../schemas/copilot-payload.schema";
import { STAGE_LABELS } from "./collaboration.stages";

export type CollaborationValidationAction =
  | "COUNTER_OFFER"
  | "ACCEPT_TERMS"
  | "FUND_ESCROW"
  | "DISPATCH"
  | "APPROVE_CONTENT"
  | "REQUEST_REVISION"
  | "VERIFY_COMPLIANCE"
  | "UNKNOWN";

export type CollaborationValidationChecklistItem = {
  id: string;
  title: string;
  satisfied: boolean;
  helpText?: string;
  repairHint?: string;
};

export type CollaborationValidationChecklist = {
  code: string;
  action: CollaborationValidationAction;
  title: string;
  narrativeText: string;
  collaborationId?: string;
  creatorLabel?: string;
  campaignName?: string;
  items: CollaborationValidationChecklistItem[];
  autoResume: boolean;
  deepLinkPath?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function extractHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") {
    return undefined;
  }
  const anyErr = err as {
    getStatus?: () => number;
    status?: number;
    statusCode?: number;
  };
  if (typeof anyErr.getStatus === "function") {
    try {
      return anyErr.getStatus();
    } catch {
      /* ignore */
    }
  }
  if (typeof anyErr.status === "number") {
    return anyErr.status;
  }
  if (typeof anyErr.statusCode === "number") {
    return anyErr.statusCode;
  }
  return undefined;
}

function extractNestMessage(err: unknown): {
  message: string;
  response?: Record<string, unknown>;
} {
  if (!err || typeof err !== "object") {
    return { message: String(err ?? "Unknown error") };
  }
  const anyErr = err as {
    message?: string | string[];
    response?: { message?: string | string[]; [k: string]: unknown };
  };
  const fromResponse = anyErr.response?.message;
  const raw =
    (Array.isArray(fromResponse)
      ? fromResponse.join("; ")
      : fromResponse) ??
    (Array.isArray(anyErr.message)
      ? anyErr.message.join("; ")
      : anyErr.message) ??
    "Unknown error";
  return {
    message: String(raw),
    response: asRecord(anyErr.response) ?? undefined,
  };
}

function deepLink(collaborationId?: string): string | undefined {
  if (!collaborationId) {
    return "/brand/collaborations";
  }
  return `/brand/collaborations?thread=${collaborationId}`;
}

function humanStage(raw: string): string {
  const key = raw.trim().toUpperCase();
  if (key in STAGE_LABELS) {
    return STAGE_LABELS[key as keyof typeof STAGE_LABELS];
  }
  return raw
    .replace(/^STAGE_\d+_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function actionVerb(action: CollaborationValidationAction): string {
  switch (action) {
    case "COUNTER_OFFER":
      return "send a counter-offer";
    case "ACCEPT_TERMS":
      return "accept terms";
    case "FUND_ESCROW":
      return "fund escrow";
    case "DISPATCH":
      return "dispatch logistics";
    case "APPROVE_CONTENT":
      return "approve content";
    case "REQUEST_REVISION":
      return "request a revision";
    case "VERIFY_COMPLIANCE":
      return "verify compliance";
    default:
      return "complete this action";
  }
}

function checklist(args: {
  code: string;
  action: CollaborationValidationAction;
  title: string;
  narrativeText: string;
  collaborationId?: string;
  creatorLabel?: string;
  campaignName?: string;
  items: CollaborationValidationChecklistItem[];
  autoResume?: boolean;
}): CollaborationValidationChecklist {
  return {
    ...args,
    autoResume: args.autoResume ?? true,
    deepLinkPath: deepLink(args.collaborationId),
  };
}

/**
 * Map a thrown Collaboration / Nest error into a chat checklist.
 * Always returns a checklist so chat never shows a raw generic toast.
 */
export function mapCollaborationValidationError(args: {
  err: unknown;
  action: CollaborationValidationAction;
  collaborationId?: string;
  creatorLabel?: string;
  campaignName?: string;
}): CollaborationValidationChecklist {
  const { message } = extractNestMessage(args.err);
  const status = extractHttpStatus(args.err);
  const lower = message.toLowerCase();
  const verb = actionVerb(args.action);
  const meta = {
    collaborationId: args.collaborationId,
    creatorLabel: args.creatorLabel,
    campaignName: args.campaignName,
  };

  if (
    status === 403 ||
    lower.includes("access required") ||
    lower.includes("forbidden") ||
    lower.includes("unsupported role")
  ) {
    return checklist({
      code: "PERMISSION_DENIED",
      action: args.action,
      title: "Permission blocked",
      narrativeText: `You can’t ${verb} on this collaboration with the current account. Sign in as the owning brand, then try again.`,
      ...meta,
      autoResume: false,
      items: [
        {
          id: "permission",
          title: "Brand permission required",
          satisfied: false,
          helpText: message,
          repairHint: "Use the brand account that owns this collaboration.",
        },
      ],
    });
  }

  if (lower.includes("terminated") || lower.includes("collaboration closed")) {
    return checklist({
      code: "COLLABORATION_CLOSED",
      action: args.action,
      title: "Collaboration closed",
      narrativeText:
        "This collaboration is terminated, so stage actions can’t continue. Open Collaborations if you need history or a new thread.",
      ...meta,
      autoResume: false,
      items: [
        {
          id: "terminated",
          title: "Collaboration not active",
          satisfied: false,
          helpText: message,
          repairHint: "Start or open an active collaboration thread.",
        },
      ],
    });
  }

  if (lower.includes("expected stage") || lower.includes("current stage")) {
    const expectedRaw =
      message.match(/Expected stage\s+(\w+)/i)?.[1] ?? "required stage";
    const currentRaw =
      message.match(/current\s+(\w+)/i)?.[1] ?? "current stage";
    const expected = humanStage(expectedRaw);
    const current = humanStage(currentRaw);
    return checklist({
      code: "INVALID_STAGE",
      action: args.action,
      title: "Wrong workflow stage",
      narrativeText: `To ${verb}, this collaboration must be in ${expected}. It’s currently in ${current}. Finish the pending step, then try again — I’ll continue from here.`,
      ...meta,
      items: [
        {
          id: "stage",
          title: `Reach ${expected}`,
          satisfied: false,
          helpText: message,
          repairHint: `Open Collaborations and complete work in ${current} first.`,
        },
      ],
    });
  }

  if (
    lower.includes("tracking_id is required") ||
    (lower.includes("tracking") && lower.includes("required"))
  ) {
    return checklist({
      code: "SHIPMENT_PENDING",
      action: args.action,
      title: "Shipment details required",
      narrativeText:
        "D2C dispatch needs a carrier tracking ID / AWB. Add tracking (and courier if you have it), then confirm again.",
      ...meta,
      items: [
        {
          id: "tracking",
          title: "Tracking ID",
          satisfied: false,
          helpText: message,
          repairHint:
            'Say e.g. "dispatch with tracking ABCD1234 via Delhivery".',
        },
      ],
    });
  }

  if (
    lower.includes("digital access credentials") ||
    lower.includes("redemption code")
  ) {
    return checklist({
      code: "DISPATCH_DETAILS_REQUIRED",
      action: args.action,
      title: "Dispatch details required",
      narrativeText:
        "Provide digital access credentials, a redemption code, or a tracking ID before dispatch can complete.",
      ...meta,
      items: [
        {
          id: "dispatch_details",
          title: "Access credentials, redemption code, or tracking",
          satisfied: false,
          helpText: message,
          repairHint:
            "Open the collaboration Logistics stage and fill at least one dispatch field.",
        },
      ],
    });
  }

  if (
    lower.includes("logistics already dispatched") ||
    lower.includes("waiting for the creator to confirm receipt")
  ) {
    return checklist({
      code: "ALREADY_DISPATCHED",
      action: args.action,
      title: "Already dispatched",
      narrativeText:
        "Logistics are already marked dispatched. Wait for the creator to confirm receipt, then continue in Content Review.",
      ...meta,
      autoResume: false,
      items: [
        {
          id: "dispatched",
          title: "Creator receipt confirmation",
          satisfied: false,
          helpText: message,
          repairHint: "Ask the creator to confirm package receipt in chat.",
        },
      ],
    });
  }

  if (
    lower.includes("no pending media") ||
    lower.includes("confirm logistics receipt before uploading")
  ) {
    return checklist({
      code: "CONTENT_NOT_SUBMITTED",
      action: args.action,
      title: "Content not ready",
      narrativeText:
        args.action === "APPROVE_CONTENT" || args.action === "REQUEST_REVISION"
          ? "There’s no pending media to review yet. Wait for the creator to submit a draft, then try again."
          : "Content isn’t ready for this step yet. Open the thread to see what’s pending.",
      ...meta,
      items: [
        {
          id: "media",
          title: "Pending media submission",
          satisfied: false,
          helpText: message,
          repairHint: "Ask the creator to submit content, then retry.",
        },
      ],
    });
  }

  if (
    lower.includes("live post url missing") ||
    lower.includes("domain verification failed") ||
    lower.includes("must be instagram")
  ) {
    return checklist({
      code: "COMPLIANCE_PENDING",
      action: args.action,
      title: "Live post not ready",
      narrativeText:
        "Compliance verification needs a valid Instagram, TikTok, or YouTube live URL from the creator first.",
      ...meta,
      items: [
        {
          id: "live_url",
          title: "Valid live post URL",
          satisfied: false,
          helpText: message,
          repairHint:
            "Ask the creator to submit the live post URL, then verify compliance again.",
        },
      ],
    });
  }

  if (lower.includes("compliance is already verified")) {
    return checklist({
      code: "ALREADY_VERIFIED",
      action: args.action,
      title: "Already verified",
      narrativeText:
        "Compliance is already verified for this collaboration. Continue in Feedback if ratings are still open.",
      ...meta,
      autoResume: false,
      items: [
        {
          id: "verified",
          title: "Compliance already complete",
          satisfied: true,
          helpText: message,
        },
      ],
    });
  }

  if (
    lower.includes("escrow is already funded") ||
    lower.includes("already funded")
  ) {
    return checklist({
      code: "ALREADY_FUNDED",
      action: args.action,
      title: "Escrow already funded",
      narrativeText:
        "Escrow is already funded. Move on to Logistics (dispatch) if that’s still open.",
      ...meta,
      autoResume: false,
      items: [
        {
          id: "funded",
          title: "Escrow funded",
          satisfied: true,
          helpText: message,
          repairHint: "Try dispatch logistics next if the stage allows it.",
        },
      ],
    });
  }

  if (
    lower.includes("escrow funding only") ||
    lower.includes("manual receipt") ||
    lower.includes("manual confirmation") ||
    lower.includes("not uploaded advance") ||
    lower.includes("advance receipt already")
  ) {
    return checklist({
      code: "SECUREMENT_BLOCKED",
      action: args.action,
      title: "Securement blocked",
      narrativeText:
        "Securement can’t proceed with the current payout mode or missing receipt steps. Finish securement in Collaborations, then retry.",
      ...meta,
      items: [
        {
          id: "securement",
          title: "Complete securement prerequisites",
          satisfied: false,
          helpText: message,
          repairHint:
            "Open Collaborations → Securement (fund escrow or upload/confirm advance receipt).",
        },
      ],
    });
  }

  if (
    lower.includes("counter-offer already sent") ||
    lower.includes("waiting for the creator to respond")
  ) {
    return checklist({
      code: "COUNTER_PENDING",
      action: args.action,
      title: "Waiting on creator",
      narrativeText:
        "A counter-offer was already sent. Wait for the creator to respond, or accept terms if they send a final offer.",
      ...meta,
      autoResume: false,
      items: [
        {
          id: "await_creator",
          title: "Creator response",
          satisfied: false,
          helpText: message,
          repairHint: "Open the negotiation thread and wait for their reply.",
        },
      ],
    });
  }

  if (
    lower.includes("final offer") ||
    lower.includes("counter is disabled") ||
    lower.includes("negotiation round cap")
  ) {
    return checklist({
      code: "NEGOTIATION_BLOCKED",
      action: args.action,
      title: "Negotiation blocked",
      narrativeText:
        lower.includes("final offer") || lower.includes("counter is disabled")
          ? "The creator sent a final offer. Accept terms (or decline in Collaborations) — counter-offer is no longer available."
          : "Negotiation rounds are exhausted. Accept the current terms or continue in the collaboration workspace.",
      ...meta,
      items: [
        {
          id: "negotiation",
          title: "Valid negotiation next step",
          satisfied: false,
          helpText: message,
          repairHint:
            'Try "accept terms" for this collaboration, or open Negotiations in Collaborations.',
        },
      ],
    });
  }

  if (
    lower.includes("barter") &&
    (lower.includes("quote") || lower.includes("zero"))
  ) {
    return checklist({
      code: "BARTER_CONSTRAINT",
      action: args.action,
      title: "Barter collaboration",
      narrativeText:
        "Barter collaborations don’t use paid quotes. Accept terms or continue logistics without a counter-offer amount.",
      ...meta,
      items: [
        {
          id: "barter",
          title: "Barter-compatible action",
          satisfied: false,
          helpText: message,
          repairHint: "Use accept terms instead of a counter-offer amount.",
        },
      ],
    });
  }

  if (lower.includes("already submitted your rating")) {
    return checklist({
      code: "FEEDBACK_ALREADY_SUBMITTED",
      action: args.action,
      title: "Feedback already submitted",
      narrativeText: "You’ve already rated this collaboration.",
      ...meta,
      autoResume: false,
      items: [
        {
          id: "rating",
          title: "Brand rating submitted",
          satisfied: true,
          helpText: message,
        },
      ],
    });
  }

  if (status === 404 || lower.includes("not found")) {
    return checklist({
      code: "COLLAB_NOT_FOUND",
      action: args.action,
      title: "Collaboration not found",
      narrativeText:
        "I couldn’t find that collaboration thread. List collaborations and pick the right creator/campaign, then try again.",
      ...meta,
      autoResume: false,
      items: [
        {
          id: "missing",
          title: "Valid collaboration",
          satisfied: false,
          helpText: message,
          repairHint: 'Ask "show my collaborations" and choose one.',
        },
      ],
    });
  }

  if (status !== undefined && status >= 500) {
    return checklist({
      code: "INTERNAL_ERROR",
      action: args.action,
      title: "Something went wrong",
      narrativeText: `I couldn’t ${verb} because of a server error. Wait a moment and try again, or open Collaborations to continue manually.`,
      ...meta,
      items: [
        {
          id: "server",
          title: "Retry the action",
          satisfied: false,
          helpText: message,
          repairHint: "Try again, or complete the step in Collaborations.",
        },
      ],
    });
  }

  return checklist({
    code: "WORKFLOW_BLOCKED",
    action: args.action,
    title: "Collaboration action blocked",
    narrativeText: `I couldn’t ${verb} yet. ${message || "Open the collaboration thread to resolve the blocker, then try again."}`,
    ...meta,
    items: [
      {
        id: "blocker",
        title: "Resolve workflow blocker",
        satisfied: false,
        helpText: message,
        repairHint: "Open Collaborations and complete the missing step.",
      },
    ],
  });
}

export function validationChecklistToPayloadFields(
  mapped: CollaborationValidationChecklist,
): {
  narrativeText: string;
  validationChecklistData: ValidationChecklistData;
} {
  return {
    narrativeText: mapped.narrativeText,
    validationChecklistData: {
      code: mapped.code,
      title: mapped.title,
      action: mapped.action,
      autoResume: mapped.autoResume,
      deepLinkPath: mapped.deepLinkPath,
      // Do not map collaborationId into campaignId — FE deep-links via deepLinkPath.
      campaignName:
        mapped.creatorLabel && mapped.campaignName
          ? `${mapped.creatorLabel} · ${mapped.campaignName}`
          : mapped.campaignName ?? mapped.creatorLabel,
      items: mapped.items.map((item) => ({
        id: item.id,
        title: item.title,
        satisfied: item.satisfied,
        helpText: item.helpText,
        repairHint: item.repairHint,
      })),
      primaryActionLabel: mapped.autoResume ? "Try again" : "Open collaboration",
      cancelActionLabel: "Discard",
    },
  };
}
