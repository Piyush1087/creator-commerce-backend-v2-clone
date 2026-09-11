import { describe, expect, it } from "vitest";

import { selectInstagramB3bCorpus } from "./instagram-b3b-selector";

const item = (index: number, mediaType = "IMAGE") => ({
  providerMediaId: `media-${String(index).padStart(3, "0")}`,
  mediaType,
  publishedAt: new Date(
    Date.UTC(2026, 8, 11) - index * 86_400_000,
  ).toISOString(),
});

describe("B3B deterministic deep selector", () => {
  it.each([0, 1, 24])(
    "selects every eligible item when count is %i",
    (count) => {
      const result = selectInstagramB3bCorpus(
        Array.from({ length: count }, (_, index) => item(index)),
      );
      expect(result.selectedCount).toBe(count);
      expect(
        result.selections.every((row) =>
          row.reasonCodes.includes("ALL_ELIGIBLE_WITHIN_CAP"),
        ),
      ).toBe(true);
    },
  );

  it.each([25, 61])("selects exactly 24 from %i eligible items", (count) => {
    expect(
      selectInstagramB3bCorpus(
        Array.from({ length: count }, (_, index) => item(index)),
      ).selectedCount,
    ).toBe(24);
  });

  it("preserves mixed format and occupied publication-time coverage", () => {
    const rows = Array.from({ length: 40 }, (_, index) =>
      item(index, ["IMAGE", "CAROUSEL_ALBUM", "REEL", "VIDEO"][index % 4]),
    );
    const selected = selectInstagramB3bCorpus(rows);
    const ids = new Set(selected.selections.map((row) => row.providerMediaId));
    expect(
      new Set(
        rows
          .filter((row) => ids.has(row.providerMediaId))
          .map((row) => row.mediaType),
      ),
    ).toEqual(new Set(["IMAGE", "CAROUSEL_ALBUM", "REEL", "VIDEO"]));
    expect(
      selected.selections.some((row) =>
        row.reasonCodes.includes("PUBLICATION_TIME_COVERAGE"),
      ),
    ).toBe(true);
  });

  it("is byte-identical across shuffled input", () => {
    const rows = Array.from({ length: 40 }, (_, index) =>
      item(index, index % 2 ? "IMAGE" : "REEL"),
    );
    const shuffled = [...rows].sort((a, b) =>
      b.providerMediaId.localeCompare(a.providerMediaId),
    );
    expect(JSON.stringify(selectInstagramB3bCorpus(shuffled))).toBe(
      JSON.stringify(selectInstagramB3bCorpus(rows)),
    );
  });
});
