import type { ValidationChecklistData } from "../../schemas/copilot-payload.schema";

export type BrandSettingsValidationAction =
  | "UPDATE_GENERAL"
  | "UPDATE_BILLING"
  | "LINK_WITHDRAWAL";

export type BrandSettingsValidationChecklist = {
  code: string;
  action: BrandSettingsValidationAction;
  title: string;
  narrativeText: string;
  items: Array<{
    id: string;
    title: string;
    satisfied: boolean;
    helpText?: string;
    repairHint?: string;
  }>;
  autoResume: boolean;
  deepLinkPath?: string;
};

export function validationChecklistToPayloadFields(
  mapped: BrandSettingsValidationChecklist,
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
      items: mapped.items,
      primaryActionLabel: mapped.autoResume ? "Try again" : "Open Settings",
      cancelActionLabel: "Discard",
    },
  };
}

function extractMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as {
      message?: string | string[];
      response?: { message?: string | string[] };
    };
    const fromResponse = anyErr.response?.message;
    if (Array.isArray(fromResponse)) {
      return fromResponse.join("; ");
    }
    if (typeof fromResponse === "string") {
      return fromResponse;
    }
    if (Array.isArray(anyErr.message)) {
      return anyErr.message.join("; ");
    }
    if (typeof anyErr.message === "string") {
      return anyErr.message;
    }
  }
  return String(err ?? "Unknown error");
}

export function mapBrandSettingsValidationError(args: {
  err: unknown;
  action: BrandSettingsValidationAction;
}): BrandSettingsValidationChecklist {
  const message = extractMessage(args.err);
  const lower = message.toLowerCase();

  if (
    lower.includes("campaign managers cannot") ||
    lower.includes("forbidden") ||
    lower.includes("read only") ||
    lower.includes("not allowed")
  ) {
    return {
      code: "SETTINGS_PERMISSION",
      action: args.action,
      title: "Permission required",
      narrativeText:
        "You don’t have permission to change this setting. Ask a Brand Owner or Finance Admin, or open Settings in the app.",
      items: [
        {
          id: "permission",
          title: "Allowed role",
          satisfied: false,
          helpText: message,
          repairHint: "Switch to an owner/finance admin account.",
        },
      ],
      deepLinkPath: "/brand/settings",
      autoResume: false,
    };
  }

  if (lower.includes("gstin") || lower.includes("gst")) {
    return {
      code: "INVALID_GSTIN",
      action: args.action,
      title: "Invalid GSTIN",
      narrativeText:
        "That GSTIN doesn’t look valid. Fix it and try again, or update billing in Settings.",
      items: [
        {
          id: "gstin",
          title: "Valid GSTIN",
          satisfied: false,
          helpText: message,
          repairHint: "Enter a 15-character GSTIN or leave it blank.",
        },
      ],
      deepLinkPath: "/brand/settings/billing",
      autoResume: true,
    };
  }

  if (lower.includes("pan")) {
    return {
      code: "INVALID_PAN",
      action: args.action,
      title: "Invalid PAN",
      narrativeText:
        "That PAN doesn’t look valid. Fix it and try again, or update billing in Settings.",
      items: [
        {
          id: "pan",
          title: "Valid PAN",
          satisfied: false,
          helpText: message,
          repairHint: "Enter a 10-character PAN or leave it blank.",
        },
      ],
      deepLinkPath: "/brand/settings/billing",
      autoResume: true,
    };
  }

  if (
    lower.includes("ifsc") ||
    lower.includes("account") ||
    lower.includes("do not match")
  ) {
    return {
      code: "INVALID_BANK",
      action: args.action,
      title: "Bank details incomplete",
      narrativeText:
        "Bank details couldn’t be saved. Check account number / IFSC and try again.",
      items: [
        {
          id: "bank",
          title: "Valid bank details",
          satisfied: false,
          helpText: message,
          repairHint: "Confirm account number matches and IFSC is correct.",
        },
      ],
      deepLinkPath: "/brand/settings/billing",
      autoResume: true,
    };
  }

  const deepLink =
    args.action === "UPDATE_GENERAL"
      ? "/brand/settings/general"
      : "/brand/settings/billing";

  return {
    code: "SETTINGS_UPDATE_FAILED",
    action: args.action,
    title: "Couldn’t update settings",
    narrativeText: `I couldn’t save that yet. ${message}`,
    items: [
      {
        id: "settings",
        title: "Valid settings payload",
        satisfied: false,
        helpText: message,
        repairHint: "Open Settings to fix the field, then try again in chat.",
      },
    ],
    deepLinkPath: deepLink,
    autoResume: true,
  };
}
