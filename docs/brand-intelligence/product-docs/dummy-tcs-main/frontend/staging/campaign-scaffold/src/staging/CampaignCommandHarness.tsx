import { useEffect, useState } from "react";
import type { CampaignCommandAdapter } from "../features/campaign/commandAdapter";
import type { CampaignReadAdapter } from "../features/campaign/readAdapter";
import type { CampaignPageView, DiscoveryWorkspaceView } from "../features/campaign/types";

let sequence = 0;
/** Creates a client request identity only; replay/idempotency remains service-owned. */
export const createStagingRequestId = (prefix: string) => `${prefix}-${Date.now()}-${++sequence}`;
export const parseCreatorCsv = (csv: string) => csv.split(String.fromCharCode(10)).filter(Boolean).map((line) => {
  const [platform, socialHandle, email] = line.split(",").map((value) => value.trim());
  return { platform: platform as "INSTAGRAM" | "TIKTOK" | "YOUTUBE", socialHandle, email };
});

export function CampaignCommandHarness({ adapter, commands, enabled, onRefresh, view }: { adapter: CampaignReadAdapter; commands: CampaignCommandAdapter; enabled: boolean; onRefresh: () => Promise<void>; view: CampaignPageView }) {
  const campaignId = view.campaign.id;
  const products = view.productsBriefsSummary.products;
  const [assetId, setAssetId] = useState(products[0]?.campaignAssetId ?? "");
  const [briefId, setBriefId] = useState(products[0]?.briefs[0]?.briefId ?? "");
  const [creatorId, setCreatorId] = useState("");
  const [platform, setPlatform] = useState<"INSTAGRAM" | "TIKTOK" | "YOUTUBE">("INSTAGRAM");
  const [offeringId, setOfferingId] = useState("offering-serum");
  const [brandInstruction, setBrandInstruction] = useState("");
  const [creators, setCreators] = useState<DiscoveryWorkspaceView["creators"]>([]);
  const [feedback, setFeedback] = useState<string>();
  const [briefName, setBriefName] = useState("Staging brief");
  const [creativeIntent, setCreativeIntent] = useState("Creator-led product introduction");
  const [creatorBrief, setCreatorBrief] = useState("Create a concise product introduction.");
  const [socialHandle, setSocialHandle] = useState("staging_creator");
  const [email, setEmail] = useState("staging.creator@example.com");
  const [csv, setCsv] = useState("INSTAGRAM,staging_csv,staging.csv@example.com");
  const [subject, setSubject] = useState("Campaign invitation");
  const [body, setBody] = useState("We would like to invite you to participate.");

  useEffect(() => { void adapter.getDiscovery(campaignId).then((result) => { setCreators(result.creators); if (!creatorId) setCreatorId(result.creators[0]?.campaignCreatorId ?? ""); }); }, [adapter, campaignId, creatorId]);

  const run = async (label: string, command: Promise<{ ok: boolean; category?: string; message?: string }>) => {
    if (!enabled) { setFeedback("Commands are disabled while a visual scenario fixture is selected."); return; }
    const result = await command;
    setFeedback(result.ok ? `${label} completed.` : `${result.category ?? "UNAVAILABLE"}: ${result.message ?? "Command could not be completed."}`);
    if (result.ok) await onRefresh();
  };
  const briefs = products.flatMap((product) => product.briefs);

  return <aside className="stagingCommandHarness" aria-label="Staging command harness">
    <div><p className="eyebrow">Development only</p><h2>Command harness</h2><p>Temporary DTO input surface. It is outside the Campaign product UI and disabled for scenario fixtures.</p></div>
    {feedback && <p className="stagingNotice" role="status">{feedback}</p>}
    <section><h3>Campaign lifecycle</h3><div className="harnessActions"><><button disabled={!enabled} onClick={() => void run("Pause", commands.pause({ campaignId }))} type="button">Pause</button><button disabled={!enabled} onClick={() => void run("Resume", commands.resume({ campaignId }))} type="button">Resume</button><button disabled={!enabled} onClick={() => void run("Complete", commands.complete({ campaignId }))} type="button">Complete</button><button disabled={!enabled} onClick={() => void run("Archive", commands.archive({ campaignId }))} type="button">Archive</button></></div></section>
    <section><h3>Products</h3><label>Kind <select value="OFFERING" disabled><option>OFFERING</option></select></label><label>Offering reference <select onChange={(event) => setOfferingId(event.target.value)} value={offeringId}><option value="offering-serum">offering-serum</option><option value="offering-cream">offering-cream</option></select></label><p className="harnessHint">Only existing shared-store Offering references are exposed in this harness.</p><div className="harnessActions"><button disabled={!enabled} onClick={() => void run("Add Product", commands.addProduct({ campaignId, kind: "OFFERING", offeringId }))} type="button">Add Product</button><button disabled={!enabled || !assetId} onClick={() => void run("Deactivate Product", commands.deactivateProduct({ campaignId, campaignAssetId: assetId }))} type="button">Deactivate selected</button></div></section>
    <section><h3>Briefs</h3><label>Product <select onChange={(event) => setAssetId(event.target.value)} value={assetId}>{products.map((product) => <option key={product.campaignAssetId} value={product.campaignAssetId}>{product.name}</option>)}</select></label><label>Brief <select onChange={(event) => setBriefId(event.target.value)} value={briefId}>{briefs.map((brief) => <option key={brief.briefId} value={brief.briefId}>{brief.name}</option>)}</select></label><label>Name <input onChange={(event) => setBriefName(event.target.value)} value={briefName}/></label><label>Creative intent <input onChange={(event) => setCreativeIntent(event.target.value)} value={creativeIntent}/></label><label>Creator brief <textarea onChange={(event) => setCreatorBrief(event.target.value)} value={creatorBrief}/></label><div className="harnessActions"><button disabled={!enabled} onClick={() => void run("Create Brief", commands.createBriefDraft({ campaignAssetId: assetId, briefName }))} type="button">Create draft</button><button disabled={!enabled} onClick={() => void run("Edit Brief", commands.editBriefDraft({ briefId, briefName }))} type="button">Edit draft</button><button disabled={!enabled} onClick={() => void run("Edit published Brief", commands.editPublishedBrief({ briefId, briefName }))} type="button">Edit published</button><button disabled={!enabled} onClick={() => void run("Publish Brief", commands.publishBrief({ briefId, briefName, creativeIntent, creatorBrief, briefType: "CREATOR_LED", platform: "INSTAGRAM", deliverables: [{ format: "REEL_VIDEO", displayOrder: 0 }] }))} type="button">Publish</button><button disabled={!enabled} onClick={() => void run("Pause Brief", commands.pauseBrief({ briefId }))} type="button">Pause</button></div></section>
    <section><h3>Creators</h3><label>Platform <select onChange={(event) => setPlatform(event.target.value as "INSTAGRAM" | "TIKTOK" | "YOUTUBE")} value={platform}><option>INSTAGRAM</option><option>TIKTOK</option><option>YOUTUBE</option></select></label><label>Handle <input onChange={(event) => setSocialHandle(event.target.value)} value={socialHandle}/></label><label>Email <input onChange={(event) => setEmail(event.target.value)} value={email}/></label><label>CSV rows: platform,socialHandle,email <textarea onChange={(event) => setCsv(event.target.value)} value={csv}/></label><label>Existing creator <select onChange={(event) => setCreatorId(event.target.value)} value={creatorId}>{creators.map((creator) => <option key={creator.campaignCreatorId} value={creator.campaignCreatorId}>{creator.name}</option>)}</select></label><div className="harnessActions"><button disabled={!enabled} onClick={() => void run("Add creator", commands.addManualCreator({ campaignId, platform, socialHandle, email }))} type="button">Add creator</button><button disabled={!enabled} onClick={() => void run("Import creators", commands.importCreatorsCsv({ campaignId, rows: parseCreatorCsv(csv) }))} type="button">Import CSV</button><button disabled={!enabled || !creatorId} onClick={() => void run("Archive creator", commands.archiveCampaignCreator({ campaignCreatorId: creatorId }))} type="button">Archive creator</button></div></section>
    <section><h3>Outreach</h3><label>Creator <select onChange={(event) => setCreatorId(event.target.value)} value={creatorId}>{creators.map((creator) => <option key={creator.campaignCreatorId} value={creator.campaignCreatorId}>{creator.name}</option>)}</select></label><label>Brand instruction <input onChange={(event) => setBrandInstruction(event.target.value)} value={brandInstruction}/></label><label>Subject <input onChange={(event) => setSubject(event.target.value)} value={subject}/></label><label>Final body <textarea onChange={(event) => setBody(event.target.value)} value={body}/></label><p className="harnessHint">The service determines the authoritative outreach path; this panel cannot choose it.</p><div className="harnessActions"><button disabled={!enabled || !creatorId} onClick={() => void run("Compose Outreach", commands.composeOutreach({ campaignCreatorId: creatorId, brandFreeFormInstruction: brandInstruction }))} type="button">Compose</button><button disabled={!enabled || !creatorId} onClick={() => void run("Initiate Email", commands.initiateEmailOutreach({ campaignCreatorId: creatorId, requestId: createStagingRequestId("email"), finalSubject: subject, finalBody: body }))} type="button">Initiate email</button><button disabled={!enabled || !creatorId} onClick={() => void run("Confirm Priority DM", commands.confirmPriorityDmOutreach({ campaignCreatorId: creatorId, requestId: createStagingRequestId("priority"), finalBody: body }))} type="button">Confirm Priority DM</button><button disabled={!enabled || !creatorId} onClick={() => void run("Retry Email", commands.retryEmailCompose({ campaignCreatorId: creatorId, requestId: createStagingRequestId("retry") }))} type="button">Retry email</button></div></section>
    <section><h3>Share</h3><div className="harnessActions">{view.share.supportedChannels.map((channel) => <button disabled={!enabled} key={channel} onClick={() => void run("Share", commands.executeShare({ campaignId, channel, requestId: createStagingRequestId("share") }))} type="button">Share: {channel}</button>)}</div></section>
  </aside>;
}
