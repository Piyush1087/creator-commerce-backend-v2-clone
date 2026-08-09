import type { CampaignReadAdapter } from "../features/campaign/readAdapter";
import type { ApplicantsWorkspaceView, DiscoveryWorkspaceView } from "../features/campaign/types";
import { applyScenario, type ScenarioId } from "./scenarioFixtures";

const enabled = { available: true, presentation: "ENABLED" as const };

/** Development-only deterministic fixture adapter. Never use as production/domain truth. */
export function createMockCampaignReadAdapter(): CampaignReadAdapter {
  return {
    async getCampaignPage(campaignId) {
      return {
        campaign: {
          id: campaignId,
          name: "Campaign staging",
          lifecycleStatus: "LIVE",
          creationSource: "MANUAL",
          productCount: 2,
          briefCount: 3,
          capabilities: { view: enabled, edit: enabled, share: enabled },
        },
        hydration: { outcome: "STATE_4_DISCOVERY_ACTIVE", executionReady: true, primaryFocus: "DISCOVERY", postLiveReadinessBlocked: false },
        productsBriefsSummary: { state: "READY", label: "Products & Briefs", capability: enabled, products: [{ campaignAssetId: "asset-serum", name: "Glow Face Serum", briefs: [{ briefId: "brief-reel", name: "Instagram Reel" }, { briefId: "brief-story", name: "Story + Link" }] }, { campaignAssetId: "asset-cream", name: "Night Repair Cream", briefs: [{ briefId: "brief-ugc", name: "UGC Video" }] }] },
        copilotSummary: { state: "READY", label: "Campaign Copilot", summary: "Strong creator interest this week. Prioritize the highest-match prospects and pending applicants.", actions: [{ id: "new-creators", label: "Review", context: "8 new creators found for the campaign", action: "DISCOVERY" }, { id: "applicants", label: "Review", context: "3 applicants need a decision", action: "APPLICANTS" }] },
        performanceSummary: { state: "READY", label: "Performance", capability: enabled, metrics: [{ metricId: "reach", label: "Reach", value: "124K", tone: "success" }, { metricId: "engagement", label: "Engagement", value: "5.8%", tone: "neutral" }, { metricId: "budget", label: "Committed", value: "₹48K", tone: "attention" }] },
        workspaces: [
          { workspace: "DISCOVERY", state: "READY", instantiated: true, visible: true, expand: enabled },
          { workspace: "APPLICANTS", state: "READY", instantiated: true, visible: true, expand: enabled },
          { workspace: "COLLABORATIONS", state: "UNAVAILABLE", instantiated: false, visible: false, expand: { available:false,presentation:"HIDDEN",reasonCategory:"CAPABILITY_UNAVAILABLE" } },
        ],
        share: { capability: enabled, supportedChannels: ["COPY_LINK", "WHATSAPP", "INSTAGRAM"] },
      };
    },
    async getCampaignDetails(campaignId) { return { campaignId, state: "READY" }; },
    async getProductDetails(campaignAssetId) { return { campaignAssetId, state: "READY" }; },
    async getBriefDetails(briefId) { return { briefId, state: "READY" }; },
    async getDiscovery() { return { state: "READY", creators: [{ campaignCreatorId: "creator-anya", name: "Anya Kapoor", category: "Beauty & Skincare", followers: "128K", engagement: "6.4%", avatarInitials: "AK", contextLabel: "High match" }, { campaignCreatorId: "creator-mira", name: "Mira Shah", category: "Lifestyle", followers: "92K", engagement: "5.9%", avatarInitials: "MS", contextLabel: "New" }, { campaignCreatorId: "creator-nia", name: "Nia Thomas", category: "Beauty", followers: "76K", engagement: "7.1%", avatarInitials: "NT", contextLabel: "High match" }] }; },
    async getCreatorProfile(campaignCreatorId) { return { campaignCreatorId, state: "READY" }; },
    async getOutreachComposer(campaignCreatorId) { return { campaignCreatorId, state: "UNAVAILABLE", capability: { available: false, presentation: "DISABLED", reasonCategory: "CAPABILITY_UNAVAILABLE" } }; },
    async getApplicants() { return { state: "READY", applicants: [{ applicationId: "application-anya", campaignCreatorId: "creator-anya", name: "Anya Kapoor", category: "Beauty & Skincare", followers: "128K", engagement: "6.4%", avatarInitials: "AK", intelligenceStatus: "READY", intelligenceLabel: "Strong audience fit" }, { applicationId: "application-isha", campaignCreatorId: "creator-isha", name: "Isha Mehta", category: "Skincare", followers: "64K", engagement: "7.5%", avatarInitials: "IM", intelligenceStatus: "PROCESSING" }] }; },
    async getReporting(campaignId) { return { campaignId, state: "UNAVAILABLE" }; },
    async getCollaborationReferences() { return []; },
  };
}

export function createScenarioCampaignReadAdapter(scenario: ScenarioId): CampaignReadAdapter {
  const base = createMockCampaignReadAdapter();
  return {
    ...base,
    async getCampaignPage(id) { return applyScenario(await base.getCampaignPage(id), scenario); },
    async getDiscovery(id) {
      if (scenario === "loading") return new Promise<DiscoveryWorkspaceView>(() => undefined);
      if (scenario === "no-results") return { state:"EMPTY", creators:[] };
      if (scenario === "unavailable") return { state:"ERROR", creators:[] };
      return base.getDiscovery(id);
    },
    async getApplicants(id) {
      if (scenario === "loading") return new Promise<ApplicantsWorkspaceView>(() => undefined);
      if (scenario === "unavailable") return { state:"ERROR", applicants:[] };
      return base.getApplicants(id);
    },
  };
}
