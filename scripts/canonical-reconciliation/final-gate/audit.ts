import { PrismaClient } from "@prisma/client";
import { readFile, writeFile } from "node:fs/promises";

import { hashCanonicalCampaignDefinition } from "../../../src/features/brand-uce/services/canonical-campaign-definition";
import {
  FINAL_GATE_IDS,
  requireFinalGateScenario,
  type FinalGateScenarioId,
} from "./contracts";
import {
  requireDisposableFinalGateDatabase,
  requireRunArtifactPath,
} from "./guard";

const prisma = new PrismaClient();

async function snapshot() {
  const [
    users,
    brandMemberships,
    creatorMemberships,
    campaigns,
    products,
    legacyBriefs,
    assets,
    canonicalBriefs,
    applications,
    applicationEvents,
    collaborations,
    collaborationSnapshots,
    agreements,
    providerMappings,
    financialInstructions,
    payoutReceipts,
    payoutObligations,
    instagramConnections,
    reportingSnapshots,
    reportingTimeseries,
    reportingAssets,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.brandTeamMember.count(),
    prisma.creatorWorkspaceMember.count(),
    prisma.uceCampaign.count(),
    prisma.uceCampaignProduct.count(),
    prisma.uceCampaignBrief.count(),
    prisma.uceCampaignAsset.count(),
    prisma.canonicalCampaignBrief.count(),
    prisma.uceApplication.count(),
    prisma.applicationDomainEvent.count(),
    prisma.collaboration.count(),
    prisma.collaborationExecutionSnapshot.count(),
    prisma.collaborationCommercialAgreement.count(),
    prisma.creatorPayoutDestinationProviderMapping.count(),
    prisma.collaborationFinancialAuthorityInstruction.count(),
    prisma.payoutReconciledReceipt.count(),
    prisma.creatorPayoutObligation.count(),
    prisma.creatorSocialIntegration.count(),
    prisma.uceCampaignReportingSnapshot.count(),
    prisma.uceCampaignReportingTimeseriesHourly.count(),
    prisma.uceCampaignReportingAssetGallery.count(),
  ]);
  const campaignHashes = await prisma.uceCampaign.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      status: true,
      canonicalDefinition: true,
      canonicalDefinitionHash: true,
    },
  });
  const applicationStates = await prisma.uceApplication.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      status: true,
      statusVersion: true,
      collaboration: { select: { id: true, sourceApplicationId: true } },
    },
  });
  const assetStates = await prisma.uceCampaignAsset.findMany({
    orderBy: { id: "asc" },
    select: { id: true, campaignId: true, kind: true, offeringId: true },
  });
  const canonicalBriefStates = await prisma.canonicalCampaignBrief.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      campaignAssetId: true,
      briefName: true,
      creationSource: true,
    },
  });
  return {
    users,
    brandMemberships,
    creatorMemberships,
    campaigns,
    products,
    legacyBriefs,
    assets,
    canonicalBriefs,
    applications,
    applicationEvents,
    collaborations,
    collaborationSnapshots,
    agreements,
    providerMappings,
    financialInstructions,
    payoutReceipts,
    payoutObligations,
    instagramConnections,
    reportingSnapshots,
    reportingTimeseries,
    reportingAssets,
    campaignHashes,
    applicationStates,
    assetStates,
    canonicalBriefStates,
  };
}

type Snapshot = Awaited<ReturnType<typeof snapshot>>;
type CampaignHashState = Snapshot["campaignHashes"][number];
const MUTATING = new Set<FinalGateScenarioId>(["B05", "B06", "B08"]);
const PROTECTED: Array<keyof Snapshot> = [
  "users",
  "brandMemberships",
  "creatorMemberships",
  "products",
  "legacyBriefs",
  "providerMappings",
  "financialInstructions",
  "payoutReceipts",
  "payoutObligations",
  "reportingSnapshots",
  "reportingTimeseries",
  "reportingAssets",
];

export function assertPublishedCanonicalHashes(states: CampaignHashState[]) {
  for (const campaign of states) {
    if (campaign.status !== "PUBLISHED" || campaign.canonicalDefinition == null)
      continue;
    if (!/^sha256:[0-9a-f]{64}$/.test(campaign.canonicalDefinitionHash ?? ""))
      throw new Error(`PUBLISHED_CANONICAL_HASH_INVALID:${campaign.id}`);
    if (
      campaign.canonicalDefinitionHash !==
      hashCanonicalCampaignDefinition(campaign.canonicalDefinition)
    )
      throw new Error(`PUBLISHED_CANONICAL_HASH_MISMATCH:${campaign.id}`);
  }
}

export function assertB05DraftHashes(
  before: CampaignHashState[],
  after: CampaignHashState[],
) {
  const inserted = after.filter(
    (item) => !before.some((prior) => prior.id === item.id),
  );
  if (
    inserted.length !== 4 ||
    inserted.some(
      (item) =>
        item.status !== "DRAFT" || item.canonicalDefinitionHash !== null,
    )
  )
    throw new Error("B05_DRAFT_HASH_LIFECYCLE_MISMATCH");
}

function validateDelta(
  scenario: FinalGateScenarioId,
  before: Snapshot,
  after: Snapshot,
) {
  for (const key of PROTECTED) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      throw new Error(
        `UNCLASSIFIED_DATABASE_WRITE:${scenario}:${String(key)}:${JSON.stringify(before[key])}->${JSON.stringify(after[key])}`,
      );
  }
  if (
    !MUTATING.has(scenario) &&
    JSON.stringify(before) !== JSON.stringify(after)
  )
    throw new Error(
      `UNCLASSIFIED_DATABASE_WRITE:${scenario}:READ_ONLY_SCENARIO`,
    );
  if (scenario === "B05") {
    if (after.campaigns - before.campaigns !== 4)
      throw new Error("B05_CANONICAL_CAMPAIGN_DRAFT_WRITE_MISMATCH");
    assertB05DraftHashes(before.campaignHashes, after.campaignHashes);
  }
  if (scenario === "B06") {
    const insertedAssets = after.assetStates.filter(
      (item) => !before.assetStates.some((prior) => prior.id === item.id),
    );
    const insertedBriefs = after.canonicalBriefStates.filter(
      (item) =>
        !before.canonicalBriefStates.some((prior) => prior.id === item.id),
    );
    const asset = insertedAssets[0];
    const brief = insertedBriefs[0];
    if (
      after.assets - before.assets !== 1 ||
      after.canonicalBriefs - before.canonicalBriefs !== 1 ||
      insertedAssets.length !== 1 ||
      insertedBriefs.length !== 1 ||
      asset?.campaignId !== FINAL_GATE_IDS.campaignTrust ||
      asset?.kind !== "OFFERING" ||
      asset?.offeringId !== FINAL_GATE_IDS.b06Offering ||
      brief?.campaignAssetId !== asset.id ||
      brief?.briefName !== "Final Gate Linked Brief" ||
      brief?.creationSource !== "MANUAL"
    )
      throw new Error("B06_CANONICAL_ASSET_BRIEF_WRITE_MISMATCH");
  }
  if (scenario === "B08") {
    if (
      after.applications - before.applications !== 1 ||
      after.collaborations - before.collaborations !== 1
    )
      throw new Error("B08_C03_C04_WRITE_MISMATCH");
    const linked = after.applicationStates.filter(
      (item) => item.collaboration?.sourceApplicationId === item.id,
    );
    if (
      linked.length !== 1 ||
      linked[0]?.status !== "APPROVED" ||
      linked[0]?.statusVersion !== 2
    )
      throw new Error("B08_C03_C04_LINKAGE_MISMATCH");
  }
  if (
    after.providerMappings +
      after.financialInstructions +
      after.payoutReceipts !==
    0
  )
    throw new Error("UNAUTHORIZED_FINANCIAL_OR_PROVIDER_WRITE");
}

async function main() {
  requireDisposableFinalGateDatabase();
  const scenario = requireFinalGateScenario();
  const phase = process.argv.includes("--after") ? "after" : "before";
  const current = await snapshot();
  assertPublishedCanonicalHashes(current.campaignHashes);
  if (phase === "after") {
    const artifact = JSON.parse(
      await readFile(
        requireRunArtifactPath(`audit-${scenario}-before.json`),
        "utf8",
      ),
    ) as { snapshot: Snapshot };
    validateDelta(scenario, artifact.snapshot, current);
  } else if (
    current.providerMappings +
      current.financialInstructions +
      current.payoutReceipts !==
    0
  ) {
    throw new Error("PROHIBITED_PROVIDER_OR_FINANCIAL_STATE_PRESENT");
  }
  await writeFile(
    requireRunArtifactPath(`audit-${scenario}-${phase}.json`),
    JSON.stringify({ scenario, phase, snapshot: current }, null, 2),
    "utf8",
  );
  process.stdout.write(
    JSON.stringify({ scenario, phase, snapshot: current }) + "\n",
  );
}

if (require.main === module) {
  main()
    .finally(() => prisma.$disconnect())
    .catch((error: unknown) => {
      console.error(
        error instanceof Error ? error.message : "FINAL_GATE_AUDIT_FAILED",
      );
      process.exitCode = 1;
    });
}
