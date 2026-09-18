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

async function readJsonLines(name: string) {
  try {
    return (await readFile(requireRunArtifactPath(name), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function runtimeIsolationSnapshot() {
  const [mail, blocked] = await Promise.all([
    readJsonLines("validation-mail-adapter.ndjson"),
    readJsonLines("backend-egress-blocked.ndjson"),
  ]);
  const providerAttempts = blocked.filter(
    (item) => item.classification === "PROVIDER",
  ).length;
  return {
    validationMailAdapterInvocations: mail.length,
    nonLoopbackNetworkAttempts: blocked.length,
    nonLoopbackProviderAttempts: providerAttempts,
  };
}

async function waitForB08Notifications() {
  const deadline = Date.now() + 20_000;
  do {
    const [jobs, pendingJobs, deliveries, pendingDeliveries] =
      await Promise.all([
        prisma.notificationJob.count(),
        prisma.notificationJob.count({
          where: { status: { in: ["PENDING", "PROCESSING"] } },
        }),
        prisma.notificationEmailDelivery.count(),
        prisma.notificationEmailDelivery.count({
          where: {
            status: { in: ["PENDING", "PROCESSING", "FAILED_RETRYABLE"] },
          },
        }),
      ]);
    if (jobs > 0 && deliveries > 0 && pendingJobs === 0 && pendingDeliveries === 0)
      return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  throw new Error("B08_NOTIFICATION_SETTLEMENT_TIMEOUT");
}

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
    notifications,
    notificationRecipients,
    notificationEmailDeliveries,
    notificationJobs,
    notificationJobRecipients,
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
    prisma.notification.count(),
    prisma.notificationRecipient.count(),
    prisma.notificationEmailDelivery.count(),
    prisma.notificationJob.count(),
    prisma.notificationJobRecipient.count(),
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
  const notificationStates = await prisma.notification.findMany({
    orderBy: [{ eventType: "asc" }, { createdAt: "asc" }],
    select: { eventType: true, emailPolicy: true, inAppPolicy: true },
  });
  const notificationJobStates = await prisma.notificationJob.findMany({
    orderBy: [{ eventType: "asc" }, { createdAt: "asc" }],
    select: { eventType: true, status: true, attempts: true },
  });
  const notificationDeliveryStates =
    await prisma.notificationEmailDelivery.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      select: { status: true, attempts: true, providerMessageId: true },
    });
  const runtimeIsolation = await runtimeIsolationSnapshot();
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
    notifications,
    notificationRecipients,
    notificationEmailDeliveries,
    notificationJobs,
    notificationJobRecipients,
    campaignHashes,
    applicationStates,
    assetStates,
    canonicalBriefStates,
    notificationStates,
    notificationJobStates,
    notificationDeliveryStates,
    runtimeIsolation,
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
const NOTIFICATION_STATE: Array<keyof Snapshot> = [
  "notifications",
  "notificationRecipients",
  "notificationEmailDeliveries",
  "notificationJobs",
  "notificationJobRecipients",
  "notificationStates",
  "notificationJobStates",
  "notificationDeliveryStates",
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
  if (scenario !== "B08") {
    for (const key of NOTIFICATION_STATE) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
        throw new Error(
          `UNCLASSIFIED_NOTIFICATION_WRITE:${scenario}:${String(key)}`,
        );
    }
    if (
      before.runtimeIsolation.validationMailAdapterInvocations !==
      after.runtimeIsolation.validationMailAdapterInvocations
    )
      throw new Error(`UNEXPECTED_VALIDATION_MAIL:${scenario}`);
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
    const allowedEvents = new Set([
      "campaigns.application_approved",
      "campaigns.application_received",
    ]);
    const sentDeliveries = after.notificationDeliveryStates.filter(
      (item) => item.status === "SENT",
    );
    const mailDelta =
      after.runtimeIsolation.validationMailAdapterInvocations -
      before.runtimeIsolation.validationMailAdapterInvocations;
    if (
      after.notificationJobs <= before.notificationJobs ||
      after.notifications <= before.notifications ||
      after.notificationEmailDeliveries <= before.notificationEmailDeliveries ||
      after.notificationStates.some((item) => !allowedEvents.has(item.eventType)) ||
      after.notificationJobStates.some(
        (item) => !allowedEvents.has(item.eventType) || item.status !== "COMPLETED",
      ) ||
      after.notificationDeliveryStates.some(
        (item) =>
          !["SENT", "NOT_REQUIRED"].includes(item.status) ||
          (item.status === "SENT" &&
            !/^final-gate-mail-\d{6}$/.test(item.providerMessageId ?? "")),
      ) ||
      mailDelta !== sentDeliveries.length
    )
      throw new Error("B08_NOTIFICATION_ISOLATION_MISMATCH");
  }
  if (
    after.runtimeIsolation.nonLoopbackNetworkAttempts !== 0 ||
    after.runtimeIsolation.nonLoopbackProviderAttempts !== 0
  )
    throw new Error("FINAL_GATE_NON_LOOPBACK_ATTEMPT_DETECTED");
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
  if (scenario === "B08" && phase === "after")
    await waitForB08Notifications();
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
