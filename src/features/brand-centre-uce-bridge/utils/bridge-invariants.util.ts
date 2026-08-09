export function calculateSplittingBudgets(rawExpression: string): {
  masterBudget: number;
  subCeilingCap: number;
} {
  const numbers = rawExpression.match(/\d+/g)?.map(Number) || [0, 0];
  if (numbers.length < 2) {
    throw new Error("UNABLE_TO_PARSE_FINANCIAL_EXPRESSION");
  }

  const ratePerCreator = numbers[0];
  const totalCreators = numbers[1];

  const masterBudget = ratePerCreator * totalCreators;
  const subCeilingCap = Number((masterBudget * 0.15).toFixed(2));

  return { masterBudget, subCeilingCap };
}

export function parseTimelineBounds(expression: string): {
  type: "EVERGREEN" | "FIXED_DATE" | "DYNAMIC";
  date?: Date;
  offset?: number;
} {
  if (!expression || expression.toLowerCase().includes("evergreen")) {
    return { type: "EVERGREEN" };
  }

  const dateParsed = Date.parse(expression);
  if (!Number.isNaN(dateParsed)) {
    return { type: "FIXED_DATE", date: new Date(dateParsed) };
  }

  const daysMatch = expression.match(/(\d+)\s*days/i);
  if (daysMatch) {
    return { type: "DYNAMIC", offset: parseInt(daysMatch[1], 10) };
  }

  return { type: "EVERGREEN" };
}

export function safeSkuFromName(name: string): string {
  const trimmed = name.trim().toUpperCase();
  const base = trimmed
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  const suffix = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${base || "SKU"}_${suffix}`;
}

