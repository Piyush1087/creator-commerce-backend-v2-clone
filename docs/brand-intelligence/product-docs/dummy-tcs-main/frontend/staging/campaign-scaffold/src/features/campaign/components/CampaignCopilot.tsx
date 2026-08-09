import type { CampaignUiActionHandler } from "../actionModel";
import type { CopilotSummary } from "../types";
import { SurfaceStateNotice } from "./SurfaceState";

export function CampaignCopilot({ campaignId, copilot, onAction }: { campaignId: string; copilot: CopilotSummary; onAction: CampaignUiActionHandler }) {
  return <section className="copilotCard" aria-labelledby="copilot-title"><div className="sectionHeading"><div><p className="eyebrow">AI priority</p><h2 id="copilot-title">Campaign Copilot</h2></div><span className="copilotMark">✦</span></div>{copilot.state === "READY" ? <><p>{copilot.summary}</p>{copilot.actions.length ? <div className="priorityActions">{copilot.actions.map((item) => {
    const workspace = item.action === "APPLICANTS" ? "APPLICANTS" : "DISCOVERY";
    return <article className="priorityAction" key={item.id}><span>{item.context}</span><button className="textAction" onClick={() => void onAction({ type: "OPEN_WORKSPACE", campaignId, workspace })} type="button">{item.label}</button></article>;
  })}</div> : <SurfaceStateNotice state="EMPTY" subject="priority actions"/>}</> : <SurfaceStateNotice state={copilot.state} subject="Campaign Copilot"/>}</section>;
}
