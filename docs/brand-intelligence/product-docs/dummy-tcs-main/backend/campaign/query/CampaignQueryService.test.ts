import { describe, expect, it } from "vitest";
import { CampaignCommandService } from "../commands/CampaignCommandService";
import { StagingCommandRepository } from "../commands/stagingCommandRepository";
import { createStagingCampaignStore } from "../staging/stagingCampaignStore";
import { CampaignQueryService } from "./CampaignQueryService";
import { StagingCampaignReadRepository } from "./stagingRepository";
describe("CampaignQueryService",()=>{
  it("composes a live Campaign Page projection",async()=>{const page=await new CampaignQueryService(new StagingCampaignReadRepository()).getCampaignPage("campaign-1");expect(page.hydration.outcome).toBe("STATE_4_DISCOVERY_ACTIVE");expect(page.campaign.capabilities.share.available).toBe(true);});

  it("observes lifecycle mutations from the shared staging store",async()=>{
    const store=createStagingCampaignStore();
    const commands=new CampaignCommandService(new StagingCommandRepository(store));
    const query=new CampaignQueryService(new StagingCampaignReadRepository(store));

    expect(commands.pause({campaignId:"campaign-staging"})).toEqual({ok:true,data:{status:"PAUSED"}});
    const paused=await query.getCampaignPage("campaign-staging");
    expect(paused.campaign.lifecycleStatus).toBe("PAUSED");
    expect(paused.hydration.outcome).toBe("STATE_8_PAUSED_CAMPAIGN");
    expect(paused.campaign.capabilities.complete.available).toBe(true);
    expect(paused.performanceSummary.state).toBe("READY");
    expect(paused.workspaces.find((item)=>item.workspace==="DISCOVERY")?.visible).toBe(true);
    expect(paused.workspaces.find((item)=>item.workspace==="APPLICANTS")?.visible).toBe(true);

    expect(commands.resume({campaignId:"campaign-staging"})).toEqual({ok:true,data:{status:"LIVE"}});
    expect((await query.getCampaignPage("campaign-staging")).campaign.lifecycleStatus).toBe("LIVE");
  });

  it("reports active Campaign Product and published Brief counts after deactivation",async()=>{
    const store=createStagingCampaignStore();
    const commands=new CampaignCommandService(new StagingCommandRepository(store));
    const query=new CampaignQueryService(new StagingCampaignReadRepository(store));

    expect((await query.getCampaignPage("campaign-staging")).campaign).toMatchObject({productCount:2,briefCount:3});
    expect(commands.deactivateProduct({campaignId:"campaign-staging",campaignAssetId:"asset-serum"})).toEqual({ok:true,data:{campaignAssetId:"asset-serum",status:"PAUSED"}});
    expect((await query.getCampaignPage("campaign-staging")).campaign).toMatchObject({productCount:1,briefCount:1});
  });

  it("projects Applicant terminal state after an authoritative decision",async()=>{
    const store=createStagingCampaignStore();
    const commands=new CampaignCommandService(new StagingCommandRepository(store));
    const query=new CampaignQueryService(new StagingCampaignReadRepository(store));

    expect(commands.approveApplicant({applicationId:"application-anya"})).toEqual({ok:true,data:{status:"APPROVED"}});
    const applicants=await query.getApplicants("campaign-staging");
    expect(applicants.applicants[0]?.applicationStatus).toBe("APPROVED");
  });

  it("hides operational workspaces during Published setup",async()=>{
    const store=createStagingCampaignStore();
    store.campaign.status="PUBLISHED";
    store.campaign.executionReady=false;
    const query=new CampaignQueryService(new StagingCampaignReadRepository(store));
    const page=await query.getCampaignPage("campaign-staging");

    expect(page.hydration.outcome).toBe("STATE_2_BRIEF_SETUP");
    expect(page.workspaces.filter((item)=>item.visible)).toHaveLength(0);
    expect(page.performanceSummary.state).toBe("UNAVAILABLE");
    expect(page.campaign.capabilities.share.available).toBe(false);
  });

  it("represents post-live readiness loss as a block rather than Draft",async()=>{
    const store=createStagingCampaignStore();
    store.campaign.status="LIVE";
    store.campaign.executionReady=false;
    const query=new CampaignQueryService(new StagingCampaignReadRepository(store));
    const page=await query.getCampaignPage("campaign-staging");

    expect(page.hydration.outcome).not.toBe("DRAFT");
    expect(page.hydration.postLiveReadinessBlocked).toBe(true);
    expect(page.hydration.primaryFocus).toBe("RESTORE_CAMPAIGN_READINESS");
    expect(page.campaign.capabilities.share.available).toBe(false);
    expect(page.workspaces.find((item)=>item.workspace==="APPLICANTS")?.visible).toBe(true);
    expect(page.performanceSummary.state).toBe("READY");
  });
});
