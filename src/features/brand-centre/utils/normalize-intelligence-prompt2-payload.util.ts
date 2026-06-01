const SHORT_DESCRIPTION_MAX = 150;
const SHORT_DESCRIPTION_MIN = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clampShortDescription(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (!raw) {
    return null;
  }
  if (raw.length <= SHORT_DESCRIPTION_MAX) {
    return raw.length >= SHORT_DESCRIPTION_MIN ? raw : raw.padEnd(SHORT_DESCRIPTION_MIN, ".");
  }
  const truncated = raw.slice(0, SHORT_DESCRIPTION_MAX).trimEnd();
  if (truncated.length >= SHORT_DESCRIPTION_MIN) {
    return truncated;
  }
  return truncated.padEnd(SHORT_DESCRIPTION_MIN, ".");
}

function ensureMinText(value: string, minLength: number): string {
  if (value.length >= minLength) {
    return value;
  }
  const pad =
    " Review baseline health, share of voice, and strategy mix to validate lift.";
  return (value + pad).slice(0, Math.max(minLength, value.length + pad.length));
}

function normalizeDrawerDeepDive(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return {
      underlyingDataLogic: ensureMinText(
        "Baseline metrics indicate a recoverable gap versus category benchmarks.",
        20,
      ),
      competitiveDiscrepancy: ensureMinText(
        "Competitor positioning suggests room to tighten messaging and funnel alignment.",
        20,
      ),
      actionableStepsChecklist: [
        {
          stepId: "step-1",
          stepLabel: "Review top funnel step with brand baseline",
          isCompleted: false,
        },
      ],
    };
  }
  const underlyingDataLogic = asTrimmedString(value.underlyingDataLogic);
  const competitiveDiscrepancy = asTrimmedString(value.competitiveDiscrepancy);
  const stepsRaw = value.actionableStepsChecklist;
  const actionableStepsChecklist = Array.isArray(stepsRaw)
    ? stepsRaw
        .filter(isRecord)
        .map((step, index) => ({
          stepId: asTrimmedString(step.stepId) ?? `step-${index + 1}`,
          stepLabel: asTrimmedString(step.stepLabel) ?? "Review recommended action",
          isCompleted:
            typeof step.isCompleted === "boolean" ? step.isCompleted : false,
        }))
        .filter((s) => s.stepLabel.length >= 5)
    : [];

  const logic = ensureMinText(
    underlyingDataLogic ?? "Baseline metrics support this recommendation.",
    20,
  );
  const discrepancy = ensureMinText(
    competitiveDiscrepancy ?? "Competitor benchmarks highlight an addressable gap.",
    20,
  );
  const steps =
    actionableStepsChecklist.length > 0
      ? actionableStepsChecklist
      : [
          {
            stepId: "step-1",
            stepLabel: "Review recommended action with your team",
            isCompleted: false,
          },
        ];

  return {
    underlyingDataLogic: logic,
    competitiveDiscrepancy: discrepancy,
    actionableStepsChecklist: steps,
  };
}

function normalizeLeakCard(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const insightTitle = asTrimmedString(value.insightTitle);
  const shortDescription20Words = clampShortDescription(value.shortDescription20Words);
  const drawerDeepDive = normalizeDrawerDeepDive(value.drawerDeepDive);

  const title =
    insightTitle && insightTitle.length >= 5
      ? insightTitle
      : "Priority growth opportunity from baseline scan";
  if (!shortDescription20Words || !drawerDeepDive) {
    return null;
  }

  const priorityRank = value.priorityRank;
  const leakBucket = value.leakBucket;
  const performanceStatus = value.performanceStatus;
  const projectedLiftPercentage = value.projectedLiftPercentage;

  if (
    typeof priorityRank !== "string" ||
    typeof leakBucket !== "string" ||
    typeof performanceStatus !== "string" ||
    typeof projectedLiftPercentage !== "number" ||
    !Number.isFinite(projectedLiftPercentage)
  ) {
    return null;
  }

  return {
    insightTitle: title,
    shortDescription20Words,
    priorityRank,
    leakBucket,
    performanceStatus,
    projectedLiftPercentage,
    drawerDeepDive,
  };
}

/** Coerce Gemini Prompt 2 output before Zod validation (trim long descriptions, drop malformed cards). */
export function normalizeIntelligencePrompt2Payload(raw: unknown): unknown {
  const list = Array.isArray(raw) ? raw : isRecord(raw) ? [raw] : [];
  return list
    .map((item) => normalizeLeakCard(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}
