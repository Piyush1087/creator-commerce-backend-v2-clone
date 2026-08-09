import type { CampaignUiActionHandler } from "../actionModel";
import type { Capability, CampaignPageView } from "../types";

function canRender(capability: Capability | undefined) {
  return capability && capability.presentation !== "HIDDEN";
}

export function CampaignHeader({ view, onAction }: { view: CampaignPageView; onAction: CampaignUiActionHandler }) {
  const campaignId = view.campaign.id;
  const viewCapability = view.campaign.capabilities.view;
  const editCapability = view.campaign.capabilities.edit;
  const shareCapability = view.campaign.capabilities.share;

  return <header className="campaignHeader"><div><p className="eyebrow">Campaign</p><div className="campaignTitle"><h1>{view.campaign.name}</h1><span className="lifecycleBadge">{view.campaign.lifecycleStatus}</span></div><p className="headerCounts">{view.campaign.productCount} Products · {view.campaign.briefCount} Briefs</p></div><div className="headerActions">
    {canRender(viewCapability) && <button className="textAction" disabled={!viewCapability?.available} onClick={() => void onAction({ type: "VIEW_CAMPAIGN_DETAILS", campaignId })} type="button">View</button>}
    {canRender(editCapability) && <button className="textAction" disabled={!editCapability?.available} onClick={() => void onAction({ type: "EDIT_CAMPAIGN", campaignId })} type="button">Edit</button>}
    {canRender(shareCapability) && <button className="primaryAction" disabled={!shareCapability?.available} onClick={() => void onAction({ type: "SHARE_CAMPAIGN", campaignId })} type="button">Share</button>}
  </div></header>;
}
