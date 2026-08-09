import { describe, expect, it } from "vitest";
import { createMockCampaignReadAdapter } from "./scenarioReadAdapter";

describe("staging Campaign scenario adapter", () => {
  it("returns a typed projection fixture and stays outside the production-shaped read adapter", async () => {
    const page = await createMockCampaignReadAdapter().getCampaignPage("campaign-1");

    expect(page.campaign.id).toBe("campaign-1");
    expect(page.hydration.outcome).toBe("STATE_4_DISCOVERY_ACTIVE");
    expect(page.workspaces.filter((workspace) => workspace.visible)).toHaveLength(2);
  });
});
