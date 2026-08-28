import { describe, expect, it } from "vitest";

import { sortSemanticAddresses } from "./intelligence-current-state.repository";

describe("semantic-address lock ordering", () => {
  it("is deterministic when callers provide reverse order", () => {
    const left = {
      brandId: "brand",
      objectSemanticId: "communication",
      pathSchemeVersion: 1,
      componentSemanticPath: "$/f/a",
    };
    const right = { ...left, componentSemanticPath: "$/f/z" };
    expect(sortSemanticAddresses([right, left])).toEqual([left, right]);
    expect(sortSemanticAddresses([left, right])).toEqual([left, right]);
  });
});
