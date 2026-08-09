import { useEffect, useState } from "react";
import type { CampaignUiActionHandler } from "../actionModel";
import type { CampaignReadAdapter } from "../readAdapter";
import type { DiscoveryWorkspaceView } from "../types";
import { CreatorCard } from "./CreatorCard";
import { SurfaceStateNotice } from "./SurfaceState";

export function DiscoveryWorkspace({ adapter, campaignId, expanded, onAction }: { adapter: CampaignReadAdapter; campaignId: string; expanded: boolean; onAction: CampaignUiActionHandler }) {
  const [view, setView] = useState<DiscoveryWorkspaceView>();
  const [filter, setFilter] = useState("All");
  useEffect(() => { if (expanded && !view) void adapter.getDiscovery(campaignId).then(setView); }, [adapter, campaignId, expanded, view]);
  if (!expanded) return null;
  return <><div className="workspaceTools"><div className="filterGroup">{["All", "High match", "New"].map((label) => <button className={filter === label ? "filter activeFilter" : "filter"} key={label} onClick={() => setFilter(label)} type="button">{label}</button>)}</div></div>{!view ? <p className="loadingState">Loading creators…</p> : view.state !== "READY" ? <SurfaceStateNotice state={view.state} subject="creators"/> : <div className="workspaceScroll">{view.creators.filter((creator) => filter === "All" || creator.contextLabel === filter).map((creator) => <CreatorCard creator={creator} key={creator.campaignCreatorId} mode="discovery" onPrimary={(item) => void onAction({ type: "COMPOSE_OUTREACH", campaignId, campaignCreatorId: item.campaignCreatorId })} onSecondary={(item) => void onAction({ type: "VIEW_CREATOR_PROFILE", campaignId, campaignCreatorId: item.campaignCreatorId })} />)}</div>}</>;
}
