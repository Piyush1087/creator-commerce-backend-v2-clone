import { useEffect, useState } from "react";
import type { CampaignUiAction, CampaignUiActionHandler } from "../actionModel";
import type { CampaignReadAdapter } from "../readAdapter";
import type { ApplicantsWorkspaceView } from "../types";
import { CreatorCard } from "./CreatorCard";
import { SurfaceStateNotice } from "./SurfaceState";

export function ApplicantsWorkspace({ adapter, campaignId, expanded, onAction }: { adapter: CampaignReadAdapter; campaignId: string; expanded: boolean; onAction: CampaignUiActionHandler }) {
  const [view, setView] = useState<ApplicantsWorkspaceView>();
  const [filter, setFilter] = useState("Pending");
  useEffect(() => { if (expanded && !view) void adapter.getApplicants(campaignId).then(setView); }, [adapter, campaignId, expanded, view]);
  const act = async (action: CampaignUiAction) => {
    const result = await onAction(action);
    if (result.ok) setView(await adapter.getApplicants(campaignId));
  };
  if (!expanded) return null;
  const applicants = filter === "Pending" ? view?.applicants.filter((item) => item.applicationStatus === undefined || item.applicationStatus === "PENDING") : view?.applicants;
  return <><div className="workspaceTools"><div className="filterGroup">{["Pending", "All"].map((label) => <button className={filter === label ? "filter activeFilter" : "filter"} key={label} onClick={() => setFilter(label)} type="button">{label}</button>)}</div></div>{!view ? <p className="loadingState">Loading applicants…</p> : view.state !== "READY" ? <SurfaceStateNotice state={view.state} subject="applicants"/> : <div className="workspaceScroll">{applicants?.map((applicant) => <CreatorCard creator={applicant} intelligenceLabel={applicant.intelligenceLabel ?? applicant.intelligenceStatus} key={applicant.applicationId} mode="applicant" onPrimary={() => void act({ type: "APPROVE_APPLICANT", campaignId, applicationId: applicant.applicationId })} onSecondary={() => void act({ type: "REJECT_APPLICANT", campaignId, applicationId: applicant.applicationId })} />)}</div>}</>;
}
