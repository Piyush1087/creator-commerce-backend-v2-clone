/**
 * Part 5 — map Campaign List lifecycle failures into AI checklists.
 * Covers brand-uce API messages from docs + real service throws.
 * Does not change validators; only interprets errors for chat.
 */

export type CampaignListValidationAction =
  | "GO_LIVE"
  | "RESUME"
  | "PAUSE"
  | "ARCHIVE"
  | "DUPLICATE"
  | "BULK"
  | "UNKNOWN";

export type CampaignValidationChecklistItem = {
  id: string;
  title: string;
  satisfied: boolean;
  helpText?: string;
  repairHint?: string;
};

export type CampaignValidationChecklist = {
  code: string;
  action: CampaignListValidationAction;
  title: string;
  narrativeText: string;
  campaignId?: string;
  campaignName?: string;
  items: CampaignValidationChecklistItem[];
  autoResume: boolean;
  deepLinkPath?: string;
};

type ActivationChecklistRow = {
  key: string;
  label: string;
  satisfied: boolean;
};

const ACTIVATION_ITEM_META: Record<
  string,
  { id: string; title: string; helpText: string; repairHint: string }
> = {
  product_sku: {
    id: "products",
    title: "Products",
    helpText: "Add at least one product SKU to the campaign.",
    repairHint: "Open the campaign → Products and add a SKU.",
  },
  active_brief: {
    id: "brief",
    title: "Campaign brief",
    helpText: "Configure at least one brief.",
    repairHint: "Open the campaign → Briefs and complete a brief.",
  },
  escrow_funding: {
    id: "budget",
    title: "Budget pool",
    helpText: "Set a campaign budget pool greater than zero.",
    repairHint: "Open the campaign → Commercials and set the budget pool.",
  },
};

function mapActivationRows(
  checklist: ActivationChecklistRow[],
): CampaignValidationChecklistItem[] {
  return checklist.map((row) => {
    const meta = ACTIVATION_ITEM_META[row.key];
    if (meta) {
      return {
        id: meta.id,
        title: meta.title,
        satisfied: row.satisfied,
        helpText: meta.helpText,
        repairHint: meta.repairHint,
      };
    }
    return {
      id: row.key,
      title: row.label,
      satisfied: row.satisfied,
    };
  });
}

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
  checklist?: ActivationChecklistRow[];
  status?: number;
} {
  const status = extractHttpStatus(err);

  if (!err || typeof err !== "object") {
    return { message: String(err ?? "Unknown error"), status };
  }

  const anyErr = err as {
    message?: unknown;
    getResponse?: () => unknown;
    response?: unknown;
    code?: string;
    name?: string;
  };

  const response = anyErr.getResponse?.() ?? anyErr.response ?? anyErr.message;
  if (typeof response === "string") {
    return { message: response, status };
  }

  const record = asRecord(response);
  if (!record) {
    const fallback =
      err instanceof Error ? err.message : "Request failed";
    return { message: fallback, status };
  }

  const message =
    typeof record.message === "string"
      ? record.message
      : Array.isArray(record.message)
        ? record.message.map(String).join(" ")
        : err instanceof Error
          ? err.message
          : "Request failed";

  const checklistRaw = record.checklist;
  const checklist = Array.isArray(checklistRaw)
    ? checklistRaw
        .map((row) => asRecord(row))
        .filter((row): row is Record<string, unknown> => row != null)
        .map((row) => ({
          key: String(row.key ?? ""),
          label: String(row.label ?? row.key ?? "Requirement"),
          satisfied: Boolean(row.satisfied),
        }))
        .filter((row) => row.key.length > 0)
    : undefined;

  return { message, checklist, status };
}

function isServerFailure(status: number | undefined, message: string): boolean {
  if (status != null && status >= 500) {
    return true;
  }
  const lower = message.toLowerCase();
  return (
    lower.includes("internal server error") ||
    lower.includes("unexpected token") ||
    lower.includes("prisma") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("socket hang up") ||
    lower.includes("database") ||
    /\bp20\d{2}\b/i.test(message)
  );
}

function campaignDeepLink(campaignId?: string): string | undefined {
  return campaignId ? `/brand/uce/campaigns/${campaignId}` : undefined;
}

function singleItemChecklist(
  action: CampaignListValidationAction,
  code: string,
  title: string,
  narrativeText: string,
  item: CampaignValidationChecklistItem,
  campaign?: { id?: string; name?: string },
  autoResume = false,
): CampaignValidationChecklist {
  return {
    code,
    action,
    title,
    narrativeText,
    campaignId: campaign?.id,
    campaignName: campaign?.name,
    items: [item],
    autoResume,
    deepLinkPath: campaignDeepLink(campaign?.id),
  };
}

function actionVerb(action: CampaignListValidationAction): string {
  switch (action) {
    case "GO_LIVE":
      return "go live";
    case "RESUME":
      return "resume";
    case "PAUSE":
      return "pause";
    case "ARCHIVE":
      return "archive";
    case "DUPLICATE":
      return "duplicate";
    case "BULK":
      return "run this bulk action";
    case "UNKNOWN":
      return "complete this action";
    default:
      return "complete this action";
  }
}

/**
 * Map a thrown brand-uce / Nest / unexpected error into a chat checklist.
 * Always returns a checklist (never null) so chat never shows a raw generic toast.
 */
export function mapCampaignListValidationError(args: {
  err: unknown;
  action: CampaignListValidationAction;
  campaignId?: string;
  campaignName?: string;
}): CampaignValidationChecklist {
  const { message, checklist, status } = extractNestMessage(args.err);
  const campaign = {
    id: args.campaignId,
    name: args.campaignName,
  };
  const lower = message.toLowerCase();

  // Activation checklist payload from patchStatus / goLive / resume
  if (
    checklist &&
    checklist.length > 0 &&
    (args.action === "GO_LIVE" || args.action === "RESUME")
  ) {
    const items = mapActivationRows(checklist);
    const pending = items.filter((i) => !i.satisfied);
    const label = actionVerb(args.action);
    return {
      code: "CAMPAIGN_NOT_READY",
      action: args.action,
      title: "Campaign setup required",
      narrativeText:
        pending.length > 0
          ? `Your campaign isn't ready to ${label} yet. Complete the remaining setup, then confirm again — I'll continue from here.`
          : `Campaign setup looks incomplete. Review the checklist, then try again.`,
      campaignId: campaign.id,
      campaignName: campaign.name,
      items,
      autoResume: true,
      deepLinkPath: campaignDeepLink(campaign.id),
    };
  }

  // Docs: PERMISSION_DENIED / ownership
  if (
    status === 403 ||
    status === 401 ||
    lower.includes("forbidden") ||
    lower.includes("permission") ||
    lower.includes("not authorized") ||
    lower.includes("unauthorized")
  ) {
    return singleItemChecklist(
      args.action,
      "PERMISSION_DENIED",
      "Permission denied",
      "You don't have permission to run this campaign action for the selected brand.",
      {
        id: "permission",
        title: "Brand access required",
        satisfied: false,
        helpText: "This action needs an authenticated brand user who owns the campaign.",
        repairHint: "Confirm you're signed into the correct brand account, then try again.",
      },
      campaign,
      true,
    );
  }

  // Docs: INTERNAL_ERROR / HTTP 500 / infra
  // Don't treat Prisma "invalid enum" (format persist) as a campaign action failure —
  // those are handled by message persist fallback.
  if (
    isServerFailure(status, message) &&
    !/invalid input value for enum/i.test(message) &&
    !/VALIDATION_CHECKLIST/i.test(message)
  ) {
    return singleItemChecklist(
      args.action,
      "INTERNAL_ERROR",
      "Something went wrong on our side",
      `I couldn't ${actionVerb(args.action)} right now because of a server error. Your campaign wasn't changed.`,
      {
        id: "server",
        title: "Temporary server issue",
        satisfied: false,
        helpText:
          "This is an unexpected backend failure (not a checklist gap on the campaign).",
        repairHint: "Wait a moment, then tap Try again. If it keeps failing, retry later or contact support.",
      },
      campaign,
      true,
    );
  }

  // Conflict (e.g. essentials locked by active collabs) — rare on list lifecycle but real API
  if (
    status === 409 ||
    lower.includes("before any creator applications") ||
    lower.includes("conflict")
  ) {
    return singleItemChecklist(
      args.action,
      "CAMPAIGN_CONFLICT",
      "Campaign is locked by activity",
      "This campaign can't be changed that way while creator applications or active collaborations exist.",
      {
        id: "collaboration_lock",
        title: "No blocking collaborations",
        satisfied: false,
        helpText: message,
        repairHint:
          "Finish or settle active collaborations first, or use a different lifecycle action.",
      },
      campaign,
      false,
    );
  }

  if (args.action === "PAUSE" && lower.includes("only active")) {
    return singleItemChecklist(
      "PAUSE",
      "INVALID_STATUS_FOR_PAUSE",
      "Cannot pause campaign",
      "Only ACTIVE campaigns can be paused.",
      {
        id: "status_active",
        title: "Campaign must be ACTIVE",
        satisfied: false,
        helpText: "Pause is only available while the campaign is live.",
        repairHint: "Go live or resume the campaign first, then pause.",
      },
      campaign,
    );
  }

  if (
    (args.action === "RESUME" || args.action === "GO_LIVE") &&
    (lower.includes("only paused or draft") ||
      lower.includes("only draft") ||
      lower.includes("only paused") ||
      lower.includes("use resume for paused") ||
      lower.includes("use go live for draft"))
  ) {
    return singleItemChecklist(
      args.action,
      "INVALID_STATUS_FOR_ACTIVATE",
      "Cannot activate campaign",
      message,
      {
        id: "status",
        title: "Campaign status must allow activation",
        satisfied: false,
        helpText:
          args.action === "GO_LIVE"
            ? "Go live applies to DRAFT campaigns. Use resume for PAUSED ones."
            : "Resume applies to PAUSED campaigns. Use go live for DRAFT ones.",
        repairHint:
          "Pick a campaign in the correct status, or use the matching action (go live vs resume).",
      },
      campaign,
    );
  }

  if (
    args.action === "ARCHIVE" &&
    (lower.includes("only active, paused, or completed") ||
      lower.includes("cannot be archived"))
  ) {
    return singleItemChecklist(
      "ARCHIVE",
      "INVALID_STATUS_FOR_ARCHIVE",
      "Cannot archive campaign",
      message,
      {
        id: "status_archiveable",
        title: "Campaign must be LIVE, PAUSED, or COMPLETED",
        satisfied: false,
        helpText: "Draft campaigns cannot be archived from chat.",
        repairHint:
          "Archive after the campaign has been live, or edit/delete the draft instead.",
      },
      campaign,
    );
  }

  if (
    lower.includes("completed or archived campaigns cannot be edited") ||
    lower.includes("already archived") ||
    lower.includes("already completed")
  ) {
    return singleItemChecklist(
      args.action,
      "CAMPAIGN_TERMINAL_STATUS",
      "Campaign is closed",
      "This campaign is completed or archived, so that action isn't available.",
      {
        id: "terminal_status",
        title: "Campaign still editable / actionable",
        satisfied: false,
        helpText: message,
        repairHint: "Choose a LIVE, PAUSED, or DRAFT campaign instead.",
      },
      campaign,
    );
  }

  if (args.action === "DUPLICATE") {
    if (
      lower.includes("strategy") ||
      lower.includes("targeting") ||
      lower.includes("commercials")
    ) {
      return {
        code: "DUPLICATE_SOURCE_INCOMPLETE",
        action: "DUPLICATE",
        title: "Cannot duplicate campaign",
        narrativeText:
          "This campaign is missing required setup pieces, so it can't be duplicated yet.",
        campaignId: campaign.id,
        campaignName: campaign.name,
        items: [
          {
            id: "strategy",
            title: "Strategy",
            satisfied: !lower.includes("strategy"),
            helpText: "Campaign needs a complete strategy block.",
            repairHint: "Open the source campaign wizard and finish strategy.",
          },
          {
            id: "targeting",
            title: "Targeting",
            satisfied: !lower.includes("targeting"),
            helpText: "Campaign needs targeting configured.",
            repairHint: "Open the source campaign wizard and finish targeting.",
          },
          {
            id: "commercials",
            title: "Commercials",
            satisfied: !lower.includes("commercials"),
            helpText: "Campaign needs commercial terms.",
            repairHint: "Open the source campaign wizard and finish commercials.",
          },
        ],
        autoResume: false,
        deepLinkPath: campaignDeepLink(campaign.id),
      };
    }
    if (lower.includes("name is required")) {
      return singleItemChecklist(
        "DUPLICATE",
        "DUPLICATE_NAME_REQUIRED",
        "New campaign name required",
        "Provide a name for the duplicated draft.",
        {
          id: "new_name",
          title: "New campaign name",
          satisfied: false,
          helpText: "Duplication needs a non-empty new name.",
          repairHint:
            "Discard and ask again with a new name, or fill the name slot.",
        },
        campaign,
      );
    }
  }

  if (args.action === "BULK") {
    if (lower.includes("bulk_action must be")) {
      return singleItemChecklist(
        "BULK",
        "INVALID_BULK_ACTION",
        "Invalid bulk action",
        "Bulk action must be PAUSE, RESUME, or ARCHIVE.",
        {
          id: "bulk_action",
          title: "Choose PAUSE, RESUME, or ARCHIVE",
          satisfied: false,
          helpText: message,
          repairHint: "Discard and ask again with a clear bulk action.",
        },
        campaign,
      );
    }
    if (lower.includes("at least one campaign")) {
      return singleItemChecklist(
        "BULK",
        "BULK_CAMPAIGNS_REQUIRED",
        "No campaigns selected",
        "Pick at least one campaign for the bulk action.",
        {
          id: "campaign_ids",
          title: "Campaign selection",
          satisfied: false,
          helpText: message,
          repairHint: "Select campaigns from the list, then confirm again.",
        },
        campaign,
      );
    }
  }

  if (
    lower.includes("campaign id is required") ||
    lower.includes("source campaign and new campaign name")
  ) {
    return singleItemChecklist(
      args.action,
      "CAMPAIGN_ID_REQUIRED",
      "Campaign required",
      "I need a campaign selected before I can continue.",
      {
        id: "campaign_id",
        title: "Choose a campaign",
        satisfied: false,
        helpText: message,
        repairHint: "Pick a campaign from the staged options, then confirm.",
      },
      campaign,
    );
  }

  // Docs + APIs: not found (404 or BadRequest text)
  if (
    status === 404 ||
    lower.includes("not found") ||
    lower.includes("source campaign not found")
  ) {
    return singleItemChecklist(
      args.action,
      "CAMPAIGN_NOT_FOUND",
      "Campaign not found",
      "I couldn't find that campaign for this brand.",
      {
        id: "campaign",
        title: "Valid campaign",
        satisfied: false,
        helpText:
          "The selected campaign is missing, deleted, or not owned by this brand.",
        repairHint: "Say “show my campaigns” and pick one from the current list.",
      },
      campaign,
    );
  }

  // Docs: INVALID_FILTER style messages if they leak into writes
  if (lower.includes("invalid filter") || lower.includes("invalid sort")) {
    return singleItemChecklist(
      args.action,
      "INVALID_FILTER",
      "Invalid request",
      "That filter or sort option isn't supported.",
      {
        id: "filter",
        title: "Supported filters only",
        satisfied: false,
        helpText: message,
        repairHint:
          "Try status filters like draft/active/paused, or sort by name/budget/spend.",
      },
      campaign,
      true,
    );
  }

  // Friendly fallback — never dump opaque Nest/500 text alone
  const safeHelp =
    message && !isServerFailure(status, message)
      ? message
      : "The campaign action could not be completed.";

  return singleItemChecklist(
    args.action,
    "CAMPAIGN_ACTION_BLOCKED",
    "Action blocked",
    `I couldn't ${actionVerb(args.action)} yet.`,
    {
      id: "action",
      title: "Resolve blocking issue",
      satisfied: false,
      helpText: safeHelp,
      repairHint: "Fix the issue in Campaigns, then confirm again — or discard and rephrase.",
    },
    campaign,
    true,
  );
}

/** Build checklist from bulkLifecycleAction partial failures. */
export function mapBulkLifecyclePartialFailures(args: {
  action: "PAUSE" | "RESUME" | "ARCHIVE";
  results: Array<{
    campaign_id: string;
    ok: boolean;
    current_status?: string;
    error?: string;
  }>;
  campaignNames?: Record<string, string>;
}): CampaignValidationChecklist | null {
  const failed = args.results.filter((r) => !r.ok);
  if (failed.length === 0) {
    return null;
  }

  const items: CampaignValidationChecklistItem[] = failed.map((row) => {
    const name = args.campaignNames?.[row.campaign_id] ?? row.campaign_id.slice(0, 8);
    const mapped = mapCampaignListValidationError({
      err: new Error(row.error ?? "Failed"),
      action:
        args.action === "PAUSE"
          ? "PAUSE"
          : args.action === "RESUME"
            ? "RESUME"
            : "ARCHIVE",
      campaignId: row.campaign_id,
      campaignName: name,
    });
    const first = mapped.items[0];
    return {
      id: row.campaign_id,
      title: name,
      satisfied: false,
      helpText: first?.helpText ?? row.error ?? "Action failed for this campaign.",
      repairHint: first?.repairHint,
    };
  });

  const okCount = args.results.length - failed.length;
  return {
    code: "BULK_PARTIAL_FAILURE",
    action: "BULK",
    title: `Bulk ${args.action.toLowerCase()} — some campaigns failed`,
    narrativeText: `${okCount} succeeded, ${failed.length} failed. Review the failed campaigns below.`,
    items,
    autoResume: false,
  };
}

export function validationChecklistToPayloadFields(
  checklist: CampaignValidationChecklist,
): {
  formatType: "VALIDATION_CHECKLIST";
  narrativeText: string;
  validationChecklistData: {
    title: string;
    action: string;
    code: string;
    campaignId?: string;
    campaignName?: string;
    autoResume: boolean;
    deepLinkPath?: string;
    items: CampaignValidationChecklistItem[];
    primaryActionLabel: string;
    cancelActionLabel: string;
  };
} {
  return {
    formatType: "VALIDATION_CHECKLIST",
    narrativeText: checklist.narrativeText,
    validationChecklistData: {
      title: checklist.title,
      action: checklist.action,
      code: checklist.code,
      campaignId: checklist.campaignId,
      campaignName: checklist.campaignName,
      autoResume: checklist.autoResume,
      deepLinkPath: checklist.deepLinkPath,
      items: checklist.items,
      primaryActionLabel: checklist.autoResume ? "Try again" : "Dismiss",
      cancelActionLabel: "Discard action",
    },
  };
}
