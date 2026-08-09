import { describe, expect, it } from "vitest";
import { createStagingRequestId, parseCreatorCsv } from "./CampaignCommandHarness";

describe("Campaign staging command harness helpers", () => {
  it("creates request identity without adding command semantics", () => {
    expect(createStagingRequestId("share")).toMatch(/^share-.+-\d+$/);
  });

  it("preserves canonical CSV row fields only", () => {
    expect(parseCreatorCsv("INSTAGRAM,handle,creator@example.com")).toEqual([
      { platform: "INSTAGRAM", socialHandle: "handle", email: "creator@example.com" },
    ]);
  });
});
