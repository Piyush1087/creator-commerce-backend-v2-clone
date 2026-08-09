import { useEffect, useMemo, useState } from "react";
import type { CampaignUiAction, CampaignUiActionHandler, CampaignUiActionResult } from "./actionModel";
import type { CampaignReadAdapter } from "./readAdapter";
import type { CampaignPageView, WorkspaceSummary } from "./types";
import { ApplicantsWorkspace } from "./components/ApplicantsWorkspace";
import { CampaignCopilot } from "./components/CampaignCopilot";
import { CampaignHeader } from "./components/CampaignHeader";
import { DiscoveryWorkspace } from "./components/DiscoveryWorkspace";
import { ExpandableSection } from "./components/ExpandableSection";
import { PerformanceSummary } from "./components/PerformanceSummary";
import { ProductsBriefsSection } from "./components/ProductsBriefsSection";

type WorkspaceId = WorkspaceSummary["workspace"];

function preferredWorkspace(view: CampaignPageView): WorkspaceId {
  const visible = view.workspaces.filter((item) => item.visible && item.expand.presentation !== "HIDDEN");
  const focused = visible.find((item) => item.workspace === view.hydration.primaryFocus);
  return focused?.workspace ?? visible[0]?.workspace ?? "DISCOVERY";
}

export function CampaignPage({ view, adapter, onAction }: { view: CampaignPageView; adapter: CampaignReadAdapter; onAction: CampaignUiActionHandler }) {
  const [productsOpen, setProductsOpen] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceId>(() => preferredWorkspace(view));
  const [notice, setNotice] = useState<string>();
  const visibleWorkspaces = useMemo(() => view.workspaces.filter((item) => item.visible && item.expand.presentation !== "HIDDEN"), [view.workspaces]);

  const act: CampaignUiActionHandler = async (action: CampaignUiAction): Promise<CampaignUiActionResult> => {
    if (action.type === "OPEN_WORKSPACE") {
      const target = visibleWorkspaces.find((item) => item.workspace === action.workspace && item.expand.available);
      if (target) setWorkspace(action.workspace);
      return target ? { ok: true } : { ok: false, message: "This workspace is not currently available." };
    }
    const result = await onAction(action);
    if (!result.ok) setNotice(result.message ?? "This action requires its approved detail surface or staging input.");
    return result;
  };

  useEffect(() => {
    const current = visibleWorkspaces.find((item) => item.workspace === workspace && item.expand.available);
    if (!current) setWorkspace(preferredWorkspace(view));
  }, [view, visibleWorkspaces, workspace]);

  return <section className="campaignPage">
    <CampaignHeader onAction={act} view={view}/>
    {notice && <p className="stagingNotice" role="status">{notice}</p>}
    <div className="campaignLayout"><div className="campaignPrimary">
      <CampaignCopilot campaignId={view.campaign.id} copilot={view.copilotSummary} onAction={act}/>
      <PerformanceSummary performance={view.performanceSummary} onReport={() => void act({ type: "VIEW_REPORTING", campaignId: view.campaign.id })}/>
      <ProductsBriefsSection campaignId={view.campaign.id} expanded={productsOpen} onAction={act} onToggle={() => setProductsOpen((open) => !open)} summary={view.productsBriefsSummary}/>
    </div><div className="campaignWorkspaces">
      {visibleWorkspaces.map((item) => {
        const summary = item.count == null ? undefined : `${item.count}${item.workspace === "DISCOVERY" ? " New" : item.workspace === "APPLICANTS" ? " Pending" : ""}`;
        if (item.workspace === "DISCOVERY") return <ExpandableSection key={item.workspace} expanded={workspace === item.workspace} onToggle={() => item.expand.available && setWorkspace(item.workspace)} summary={summary} title="Discovery"><DiscoveryWorkspace adapter={adapter} campaignId={view.campaign.id} expanded={workspace === item.workspace} onAction={act}/></ExpandableSection>;
        if (item.workspace === "APPLICANTS") return <ExpandableSection key={item.workspace} expanded={workspace === item.workspace} onToggle={() => item.expand.available && setWorkspace(item.workspace)} summary={summary} title="Applicants"><ApplicantsWorkspace adapter={adapter} campaignId={view.campaign.id} expanded={workspace === item.workspace} onAction={act}/></ExpandableSection>;
        return <ExpandableSection key={item.workspace} expanded={workspace === item.workspace} onToggle={() => item.expand.available && setWorkspace(item.workspace)} placeholder summary={summary ?? "Reference only"} title="Collaborations"><p>Collaboration is independently owned. This Campaign surface has no workflow or domain behavior.</p></ExpandableSection>;
      })}
    </div></div>
  </section>;
}
