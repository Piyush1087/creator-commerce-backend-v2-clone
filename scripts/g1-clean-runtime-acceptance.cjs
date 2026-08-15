/* Local-only Phase G runtime acceptance against creator_shop_g1_clean_acceptance. */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const base = process.env.G1_RUNTIME_BASE || "http://127.0.0.1:3101/api/v1";
const ids = { offering: "10000000-0000-4000-8000-000000000004", reconcile: "10000000-0000-4000-8000-000000000010", ready: "10000000-0000-4000-8000-000000000011", terminal: "10000000-0000-4000-8000-000000000012", live: "10000000-0000-4000-8000-000000000013", application: "10000000-0000-4000-8000-000000000023", liveAsset: "10000000-0000-4000-8000-000000000024" };
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}
async function login(email) {
  const login = await request("/auth/login", { method: "POST", body: JSON.stringify({ email, otp: "123456" }) });
  const me = await request("/auth/me", { headers: { authorization: `Bearer ${login.accessToken}` } });
  return { token: login.accessToken, me };
}
async function main() {
  const legacyBefore = Object.fromEntries(await Promise.all([["products", "uceCampaignProduct"], ["briefs", "uceCampaignBrief"], ["pipeline", "uceCampaignCollaboration"]].map(async ([label, model]) => [label, await prisma[model].count()])));
  const brand = await login("f6c.brand.owner@example.invalid");
  const primary = await login("f6c.creator@example.invalid");
  const secondary = await login("f6c.second.creator@example.invalid");
  if (brand.me.role !== "BRAND" || primary.me.role !== "CREATOR" || secondary.me.role !== "CREATOR") throw new Error("auth role projection failed");
  const auth = { authorization: `Bearer ${brand.token}` };
  const reconciliation = await request(`/brand-uce/campaigns/${ids.reconcile}`, { headers: auth });
  if (!reconciliation.readiness?.reconciliation_required && (!reconciliation.campaign_assets || reconciliation.campaign_assets.length === 0)) throw new Error(`reconciliation-required projection missing: ${JSON.stringify({ reconciliation: reconciliation.reconciliation, readiness: reconciliation.readiness, assets: reconciliation.campaign_assets })}`);
  const selectable = await request("/brand-uce/campaign-assets/selectable", { headers: auth });
  if (!JSON.stringify(selectable).includes(ids.offering)) throw new Error("selectable offering projection missing");
  const existingAssets = await request(`/brand-uce/campaigns/${ids.reconcile}/assets`, { headers: auth });
  const selected = Array.isArray(existingAssets) && existingAssets.length ? existingAssets[0] : await request(`/brand-uce/campaigns/${ids.reconcile}/assets`, { method: "POST", headers: auth, body: JSON.stringify({ kind: "OFFERING", entity_id: ids.offering }) });
  const assetId = selected.id || selected.campaign_asset_id;
  if (!assetId) throw new Error("canonical asset selection did not return id");
  const existingBriefs = await request(`/brand-uce/campaigns/${ids.reconcile}/canonical-briefs`, { headers: auth });
  const brief = Array.isArray(existingBriefs) && existingBriefs.length ? existingBriefs[0] : await request(`/brand-uce/campaigns/${ids.reconcile}/canonical-briefs`, { method: "POST", headers: auth, body: JSON.stringify({ campaign_asset_id: assetId, title: "F6C runtime canonical brief", creative_requirements: "Use only the deterministic acceptance offering in the content.", deliverables: [{ format: "Short video", quantity: 1, creative_requirements: "Show the offering accurately.", publishing_required: true }] }) });
  const briefId = brief.id || brief.brief_id;
  const updated = await request(`/brand-uce/campaigns/${ids.reconcile}/canonical-briefs/${briefId}`, { method: "PATCH", headers: auth, body: JSON.stringify({ title: "F6C runtime canonical brief updated", deliverables: [{ format: "Short video", quantity: 2, creative_requirements: "Show the offering accurately and disclose testing.", publishing_required: true }] }) });
  if (!updated) throw new Error("canonical brief update failed");
  const applicationList = await request(`/brand-uce/campaigns/${ids.ready}/applications`, { headers: auth });
  const existingApplication = Array.isArray(applicationList) ? applicationList.find((item) => (item.application_id || item.id) === ids.application) : null;
  const accepted = existingApplication?.status === "ACCEPTED" ? existingApplication : await request(`/brand-uce/campaigns/${ids.ready}/applications/${ids.application}/accept`, { method: "POST", headers: auth });
  if ((accepted.status || accepted.application?.status) !== "ACCEPTED") throw new Error("application acceptance did not project accepted status");
  if (await prisma.collaboration.count()) throw new Error("application acceptance created collaboration");
  const discovery = await request(`/brand-uce/campaigns/${ids.ready}/discovery`, { headers: auth });
  if (discovery.available !== false && discovery.status !== "UNAVAILABLE" && discovery.availability !== "UNAVAILABLE") throw new Error(`discovery did not remain truthful unavailable: ${JSON.stringify(discovery)}`);
  const reporting = await request(`/brand-uce/campaigns/${ids.ready}/reporting`, { headers: auth });
  if (reporting.available !== false && reporting.status !== "UNAVAILABLE" && reporting.availability !== "UNAVAILABLE") throw new Error(`reporting did not remain truthful unavailable: ${JSON.stringify(reporting)}`);
  const terminal = await request(`/brand-uce/campaigns/${ids.terminal}`, { headers: auth });
  if (terminal.lifecycle?.status !== "ARCHIVED" && terminal.status !== "ARCHIVED" && terminal.current_status !== "ARCHIVED") throw new Error("terminal compatibility projection missing");
  await prisma.uceCampaignAsset.update({ where: { id: ids.liveAsset }, data: { status: "ACTIVE" } });
  const liveBefore = await request(`/brand-uce/campaigns/${ids.live}`, { headers: auth });
  await prisma.uceCampaignAsset.update({ where: { id: ids.liveAsset }, data: { status: "PAUSED" } });
  const liveAfter = await request(`/brand-uce/campaigns/${ids.live}`, { headers: auth });
  if ((liveBefore.lifecycle?.status || liveBefore.status || liveBefore.current_status) !== "ACTIVE" || (liveAfter.lifecycle?.status || liveAfter.status || liveAfter.current_status) !== "ACTIVE" || liveAfter.readiness?.ready !== false) throw new Error(`readiness/lifecycle separation failed: ${JSON.stringify({ before: { status: liveBefore.current_status, readiness: liveBefore.readiness }, after: { status: liveAfter.current_status, readiness: liveAfter.readiness } })}`);
  const legacyAfter = Object.fromEntries(await Promise.all([["products", "uceCampaignProduct"], ["briefs", "uceCampaignBrief"], ["pipeline", "uceCampaignCollaboration"]].map(async ([label, model]) => [label, await prisma[model].count()])));
  if (JSON.stringify(legacyBefore) !== JSON.stringify(legacyAfter)) throw new Error("legacy authority write detected");
  console.log(JSON.stringify({ auth: "pass", g1a: "pass", g1b: "pass", g1c: "pass", g1d: "pass", legacyBefore, legacyAfter }));
}
main().finally(() => prisma.$disconnect());
