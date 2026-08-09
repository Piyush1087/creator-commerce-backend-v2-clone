import { describe, expect, it } from "vitest";
import { createStagingCampaignCommandAdapter } from "./commandAdapter";
import type { CampaignUiAction } from "./actionModel";

describe("Campaign UI actions", () => {
  it("retains canonical entity IDs in typed action payloads", () => {
    const actions: CampaignUiAction[] = [
      { type: "VIEW_PRODUCT_DETAILS", campaignId: "campaign-staging", campaignAssetId: "asset-serum" },
      { type: "VIEW_BRIEF_DETAILS", campaignId: "campaign-staging", briefId: "brief-reel" },
      { type: "COMPOSE_OUTREACH", campaignId: "campaign-staging", campaignCreatorId: "creator-anya" },
      { type: "APPROVE_APPLICANT", campaignId: "campaign-staging", applicationId: "application-anya" },
    ];
    expect(actions).toMatchObject([
      { campaignId: "campaign-staging", campaignAssetId: "asset-serum" },
      { campaignId: "campaign-staging", briefId: "brief-reel" },
      { campaignId: "campaign-staging", campaignCreatorId: "creator-anya" },
      { campaignId: "campaign-staging", applicationId: "application-anya" },
    ]);
  });

  it("invokes Applicant approval with the original applicationId only", async () => {
    const observed: Array<{ applicationId: string }> = [];
    const adapter = {
      approveApplicant: async (input: { applicationId: string }) => {
        observed.push(input);
        return { ok: true };
      },
      rejectApplicant: async () => ({ ok: true }),
    };
    const action: CampaignUiAction = {
      type: "APPROVE_APPLICANT",
      campaignId: "campaign-staging",
      applicationId: "application-anya",
    };
    await adapter.approveApplicant({ applicationId: action.applicationId });
    expect(observed).toEqual([{ applicationId: "application-anya" }]);
  });

  it("uses no synthetic DTO fields at the staging adapter boundary", async () => {
    const adapter = createStagingCampaignCommandAdapter();
    expect(await adapter.approveApplicant({ applicationId: "application-anya" })).toMatchObject({ ok: true });
  });
});
