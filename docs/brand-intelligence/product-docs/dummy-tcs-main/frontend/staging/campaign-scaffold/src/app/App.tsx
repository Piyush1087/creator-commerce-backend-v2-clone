import { useCallback, useEffect, useMemo, useState } from "react";
import { ApplicationShell } from "./ApplicationShell";
import { CampaignPage } from "../features/campaign/CampaignPage";
import type { CampaignUiAction, CampaignUiActionResult } from "../features/campaign/actionModel";
import { createStagingCampaignCommandAdapter } from "../features/campaign/commandAdapter";
import { createExecutableCampaignReadAdapter } from "../features/campaign/readAdapter";
import type { CampaignPageView } from "../features/campaign/types";
import { CampaignCommandHarness } from "../staging/CampaignCommandHarness";
import { scenarioIds, scenarioLabel, type ScenarioId } from "../staging/scenarioFixtures";
import { createScenarioCampaignReadAdapter } from "../staging/scenarioReadAdapter";

export function App() {
  const [scenario, setScenario] = useState<ScenarioId | "normal">("normal");
  const [view, setView] = useState<CampaignPageView>();
  const adapter = useMemo(() => scenario === "normal" ? createExecutableCampaignReadAdapter() : createScenarioCampaignReadAdapter(scenario), [scenario]);
  const commands = useMemo(() => createStagingCampaignCommandAdapter(), []);
  const refresh = useCallback(async () => { setView(await adapter.getCampaignPage("campaign-staging")); }, [adapter]);

  useEffect(() => { setView(undefined); void refresh(); }, [refresh]);

  const handleAction = async (action: CampaignUiAction): Promise<CampaignUiActionResult> => {
    if (scenario !== "normal") return { ok: false, category: "STAGING_SCENARIO", message: "Commands are disabled while a visual scenario fixture is selected." };
    const result = action.type === "APPROVE_APPLICANT"
      ? await commands.approveApplicant({ applicationId: action.applicationId })
      : action.type === "REJECT_APPLICANT"
        ? await commands.rejectApplicant({ applicationId: action.applicationId })
        : { ok: false, category: "INPUT_REQUIRED", message: "This approved action needs its later detail surface or staging input." };
    if (result.ok) await refresh();
    return result;
  };

  return <ApplicationShell><div className="stagingScenarioControls" aria-label="Development-only Campaign scenario controls"><p className="eyebrow">Development only</p><label className="scenarioSelector">Visual scenario <select onChange={(event) => setScenario(event.target.value as ScenarioId | "normal")} value={scenario}><option value="normal">Normal executable read</option>{scenarioIds.map((id) => <option key={id} value={id}>{scenarioLabel[id]}</option>)}</select></label><p className="harnessHint">Scenario fixtures are presentation-only. Commands are disabled outside normal executable mode.</p></div>
    {view ? <><CampaignPage adapter={adapter} onAction={handleAction} view={view} /><CampaignCommandHarness adapter={adapter} commands={commands} enabled={scenario === "normal"} onRefresh={refresh} view={view}/></> : <p className="loadingState">Loading Campaign content area…</p>}
  </ApplicationShell>;
}
