export const INSTAGRAM_B3B_SELECTOR_VERSION = "instagram-b3b-thinner-v1";
export const INSTAGRAM_B3B_SELECTION_CAP = 24;

export type InstagramB3bSelectionReason =
  | "FORMAT_COVERAGE"
  | "PUBLICATION_TIME_COVERAGE"
  | "RECENCY_STABLE_FILL"
  | "ALL_ELIGIBLE_WITHIN_CAP";

export type InstagramB3bSelectionInput = Readonly<{
  providerMediaId: string;
  mediaType: string;
  publishedAt: string;
}>;

export type InstagramB3bSelectionOutput = Readonly<{
  selectorVersion: typeof INSTAGRAM_B3B_SELECTOR_VERSION;
  eligibleCount: number;
  selectedCount: number;
  selections: readonly Readonly<{
    providerMediaId: string;
    selectionRank: number;
    reasonCodes: readonly InstagramB3bSelectionReason[];
  }>[];
}>;

export function selectInstagramB3bCorpus(
  input: readonly InstagramB3bSelectionInput[],
): InstagramB3bSelectionOutput {
  const eligible = canonicalEligible(input);
  if (eligible.length <= INSTAGRAM_B3B_SELECTION_CAP) {
    return output(
      eligible.map((item) => ({ item, reasons: ["ALL_ELIGIBLE_WITHIN_CAP"] })),
      eligible.length,
    );
  }

  const selected = new Map<
    string,
    { item: InstagramB3bSelectionInput; reasons: InstagramB3bSelectionReason[] }
  >();
  const add = (
    item: InstagramB3bSelectionInput,
    reason: InstagramB3bSelectionReason,
  ) => {
    const prior = selected.get(item.providerMediaId);
    if (prior) {
      if (!prior.reasons.includes(reason)) prior.reasons.push(reason);
      return;
    }
    if (selected.size < INSTAGRAM_B3B_SELECTION_CAP) {
      selected.set(item.providerMediaId, { item, reasons: [reason] });
    }
  };

  for (const format of [
    ...new Set(eligible.map((item) => normalizeFormat(item.mediaType))),
  ].sort()) {
    const candidate = eligible.find(
      (item) => normalizeFormat(item.mediaType) === format,
    );
    if (candidate) add(candidate, "FORMAT_COVERAGE");
  }

  const oldest = Math.min(
    ...eligible.map((item) => Date.parse(item.publishedAt)),
  );
  const newest = Math.max(
    ...eligible.map((item) => Date.parse(item.publishedAt)),
  );
  const span = Math.max(1, newest - oldest + 1);
  for (let bucket = 0; bucket < 4; bucket += 1) {
    const candidates = eligible.filter(
      (item) =>
        Math.min(
          3,
          Math.floor(((Date.parse(item.publishedAt) - oldest) * 4) / span),
        ) === bucket,
    );
    if (candidates[0]) add(candidates[0], "PUBLICATION_TIME_COVERAGE");
  }

  for (const item of eligible) add(item, "RECENCY_STABLE_FILL");
  return output([...selected.values()], eligible.length);
}

function canonicalEligible(input: readonly InstagramB3bSelectionInput[]) {
  const ids = new Set<string>();
  return input
    .filter((item) => {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(item.providerMediaId)) return false;
      if (!Number.isFinite(Date.parse(item.publishedAt))) return false;
      if (ids.has(item.providerMediaId)) return false;
      ids.add(item.providerMediaId);
      return true;
    })
    .sort(
      (a, b) =>
        Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
        a.providerMediaId.localeCompare(b.providerMediaId),
    );
}

function output(
  rows: readonly {
    item: InstagramB3bSelectionInput;
    reasons: InstagramB3bSelectionReason[];
  }[],
  eligibleCount: number,
): InstagramB3bSelectionOutput {
  return {
    selectorVersion: INSTAGRAM_B3B_SELECTOR_VERSION,
    eligibleCount,
    selectedCount: rows.length,
    selections: rows.map((row, index) => ({
      providerMediaId: row.item.providerMediaId,
      selectionRank: index + 1,
      reasonCodes: [...row.reasons],
    })),
  };
}

function normalizeFormat(value: string): string {
  const format = value.trim().toUpperCase();
  return format === "REELS" ? "REEL" : format;
}
