import type {
  DataTableData,
  MetricItem,
} from "../schemas/copilot-payload.schema";
import type { CoPilotModuleReadResult } from "../core/ai-module.contract";

const TABLE_THRESHOLD = 2;

/** User explicitly wants a list/table/inventory view. */
export function wantsInventoryWidget(userText: string): boolean {
  const n = userText.toLowerCase();
  return (
    /\b(list|table|pipeline|all of them|show all|every)\b/.test(n) ||
    /\b(break ?down|full list|as a table)\b/.test(n)
  );
}

/** User explicitly wants the full metric / detail card dump. */
export function wantsFullDetailWidget(userText: string): boolean {
  const n = userText.toLowerCase();
  return (
    /\b(full (?:detail|details|breakdown|metrics|commercials|summary)|break(?: it)? down|show (?:all|every) (?:metric|detail|field)|overview card)\b/.test(
      n,
    ) || /\bmetric(?:s)? grid\b/.test(n)
  );
}

/**
 * Fact / Q&A style — answer in prose; widgets optional.
 * Broad inventory/audit language is excluded.
 */
export function isFactOrientedQuestion(userText: string): boolean {
  const n = userText.toLowerCase().trim();
  if (wantsInventoryWidget(n) || wantsFullDetailWidget(n)) {
    return false;
  }
  return (
    /^(how much|what(?:'s| is| are)|whats|where's|where is|when|who|which)\b/.test(
      n,
    ) ||
    /\b(how much|quoted|quote|offer|amount|price|budget|spend|remaining|tracking|stage|status of|tds|tax buffer)\b/.test(
      n,
    ) ||
    /\b(did they|have they|was (?:the )?)\b/.test(n)
  );
}

/** Broad status/summary asks that still benefit from a compact metric grid. */
export function isBroadStatusAsk(userText: string): boolean {
  const n = userText.toLowerCase();
  return (
    /\b(overview|summary|dashboard|full status|how (?:am i|are we) doing|readiness|completeness)\b/.test(
      n,
    ) && !isFactOrientedQuestion(userText)
  );
}

export function presentInventoryRead(args: {
  userText: string;
  narrativeText: string;
  tableData: DataTableData;
  rowCount: number;
  toolsInvoked?: string[];
  /** Enrich single-item narrative when collapsing the table. */
  singleItemNarrative?: string;
}): CoPilotModuleReadResult {
  const { userText, tableData, rowCount, toolsInvoked } = args;
  const forceTable = wantsInventoryWidget(userText);
  const narrativeText =
    rowCount <= 1 && args.singleItemNarrative
      ? args.singleItemNarrative
      : args.narrativeText;

  if (!forceTable && rowCount < TABLE_THRESHOLD) {
    return {
      formatType: "CONVERSATIONAL_NARRATIVE",
      narrativeText,
      toolsInvoked,
    };
  }

  return {
    formatType: "TABULAR_AUDIT_DATA",
    narrativeText: args.narrativeText,
    tableData,
    toolsInvoked,
  };
}

export function presentDetailRead(args: {
  userText: string;
  narrativeText: string;
  metricGridData: MetricItem[];
  toolsInvoked?: string[];
  /**
   * When fact-oriented, optionally keep a tiny subset of metrics.
   * Default: narrative only for fact Qs.
   */
  factMetrics?: MetricItem[];
  /** Force metric grid (e.g. explicit CAMPAIGN_SUMMARY overview). */
  preferMetrics?: boolean;
}): CoPilotModuleReadResult {
  const {
    userText,
    narrativeText,
    metricGridData,
    toolsInvoked,
    factMetrics,
    preferMetrics,
  } = args;

  if (wantsFullDetailWidget(userText) || preferMetrics) {
    return {
      formatType: "METRIC_HIGHLIGHT_GRID",
      narrativeText,
      metricGridData,
      toolsInvoked,
    };
  }

  if (isFactOrientedQuestion(userText)) {
    if (factMetrics && factMetrics.length > 0) {
      return {
        formatType: "METRIC_HIGHLIGHT_GRID",
        narrativeText,
        metricGridData: factMetrics.slice(0, 3),
        toolsInvoked,
      };
    }
    return {
      formatType: "CONVERSATIONAL_NARRATIVE",
      narrativeText,
      toolsInvoked,
    };
  }

  // Soft default: short grid for status-style asks; narrative if empty metrics
  if (metricGridData.length === 0) {
    return {
      formatType: "CONVERSATIONAL_NARRATIVE",
      narrativeText,
      toolsInvoked,
    };
  }

  if (isBroadStatusAsk(userText)) {
    return {
      formatType: "METRIC_HIGHLIGHT_GRID",
      narrativeText,
      metricGridData,
      toolsInvoked,
    };
  }

  // Default for ambiguous detail/status: narrative-first (smart AI feel)
  return {
    formatType: "CONVERSATIONAL_NARRATIVE",
    narrativeText,
    toolsInvoked,
  };
}
