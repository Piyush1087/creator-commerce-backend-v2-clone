export const FINAL_GATE_MARKER = "CANONICAL_FINAL_GATE_DISPOSABLE_RUN";
export const FINAL_GATE_DB_PREFIX = "canonical_final_gate_";

export const FINAL_GATE_IDS = {
  brandOrganization: "f1000000-0000-4000-8000-000000000001",
  brandProfile: "f1000000-0000-4000-8000-000000000002",
  brandOwner: "f1000000-0000-4000-8000-000000000011",
  brandFinance: "f1000000-0000-4000-8000-000000000012",
  brandManager: "f1000000-0000-4000-8000-000000000013",
  creatorOrganization: "f1000000-0000-4000-8000-000000000021",
  creatorProfile: "f1000000-0000-4000-8000-000000000022",
  creatorWorkspace: "f1000000-0000-4000-8000-000000000023",
  creatorOwner: "f1000000-0000-4000-8000-000000000031",
  creatorManager: "f1000000-0000-4000-8000-000000000032",
  creatorAssistant: "f1000000-0000-4000-8000-000000000033",
  creatorOwnerMembership: "f1000000-0000-4000-8000-000000000041",
  creatorManagerMembership: "f1000000-0000-4000-8000-000000000042",
  creatorAssistantMembership: "f1000000-0000-4000-8000-000000000043",
  campaignAwareness: "f1000000-0000-4000-8000-000000000101",
  campaignTrust: "f1000000-0000-4000-8000-000000000102",
  campaignAssets: "f1000000-0000-4000-8000-000000000103",
  campaignAction: "f1000000-0000-4000-8000-000000000104",
  campaignLegacy: "f1000000-0000-4000-8000-000000000105",
  product: "f1000000-0000-4000-8000-000000000111",
  legacyBrief: "f1000000-0000-4000-8000-000000000112",
  canonicalAsset: "f1000000-0000-4000-8000-000000000113",
  canonicalBrief: "f1000000-0000-4000-8000-000000000114",
  canonicalDeliverable: "f1000000-0000-4000-8000-000000000115",
  campaignCreator: "f1000000-0000-4000-8000-000000000116",
  application: "f1000000-0000-4000-8000-000000000117",
  collaboration: "f1000000-0000-4000-8000-000000000118",
  mediaKit: "f1000000-0000-4000-8000-000000000119",
  applicationSubmittedTransition: "f1000000-0000-4000-8000-000000000120",
  applicationApprovedTransition: "f1000000-0000-4000-8000-000000000121",
  b06Offering: "f1000000-0000-4000-8000-000000000122",
} as const;

export const FINAL_GATE_IDENTITIES = {
  BRAND_OWNER: "final-gate-brand-owner@example.test",
  FINANCE_ADMIN: "final-gate-brand-finance@example.test",
  CAMPAIGN_MANAGER: "final-gate-brand-manager@example.test",
  CREATOR_OWNER: "final-gate-creator-owner@example.test",
  CREATOR_MANAGER: "final-gate-creator-manager@example.test",
  CREATOR_ASSISTANT: "final-gate-creator-assistant@example.test",
} as const;

export const FINAL_GATE_OBJECTIVES = [
  "AWARENESS",
  "TRUST",
  "ASSETS",
  "ACTION",
] as const;

export const FINAL_GATE_PUBLIC_MEDIA_KIT_ID = "finalgatecreator00000001";

export type FinalGateManifest = {
  version: "FINAL_GATE_FIXTURE_V2";
  scenario: FinalGateScenarioId;
  database: string;
  identities: typeof FINAL_GATE_IDENTITIES;
  objectives: readonly string[];
  campaigns: Record<string, string>;
  legacyCampaignId: string;
  applicationId: string;
  collaborationId: string;
  creatorWorkspaceId: string;
  publicMediaKitId: string;
  providerMode: "DISABLED_SYNTHETIC_ONLY";
  reporting: "FAIL_CLOSED_UNIMPLEMENTED";
  creatorChat: "DEFERRED_ABSENT";
  b06EligibleEntityId: string;
};

export const FINAL_GATE_SCENARIOS = [
  "B01", "B02", "B03", "B04", "B05", "B06",
  "B07", "B08", "B09", "B10", "B11", "B12",
] as const;

export type FinalGateScenarioId = (typeof FINAL_GATE_SCENARIOS)[number];

export function requireFinalGateScenario(): FinalGateScenarioId {
  const value = process.env.FINAL_GATE_SCENARIO ?? "B01";
  if (!(FINAL_GATE_SCENARIOS as readonly string[]).includes(value)) {
    throw new Error(`FINAL_GATE_SCENARIO_INVALID:${value}`);
  }
  return value as FinalGateScenarioId;
}
