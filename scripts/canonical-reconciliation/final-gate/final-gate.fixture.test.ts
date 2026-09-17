import { describe, expect, it } from "vitest";

import { FINAL_GATE_IDENTITIES, FINAL_GATE_OBJECTIVES } from "./contracts";
import { requireDisposableFinalGateDatabase } from "./guard";

describe("Final Gate validation-only contracts", () => {
  it("freezes six unique role identities and four canonical objectives", () => {
    expect(new Set(Object.values(FINAL_GATE_IDENTITIES)).size).toBe(6);
    expect(FINAL_GATE_OBJECTIVES).toEqual([
      "AWARENESS",
      "TRUST",
      "ASSETS",
      "ACTION",
    ]);
  });

  it("fails closed without the disposable-run marker", () => {
    const marker = process.env.CANONICAL_FINAL_GATE_DISPOSABLE_RUN;
    delete process.env.CANONICAL_FINAL_GATE_DISPOSABLE_RUN;
    expect(() => requireDisposableFinalGateDatabase()).toThrow(/required/);
    if (marker) process.env.CANONICAL_FINAL_GATE_DISPOSABLE_RUN = marker;
  });
});
