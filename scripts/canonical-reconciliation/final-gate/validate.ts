import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

import { projectCampaignObjectiveHandoffV1 } from "../../../src/features/brand-uce/services/canonical-campaign-definition";
import {
  FINAL_GATE_IDENTITIES,
  FINAL_GATE_IDS,
  FINAL_GATE_OBJECTIVES,
  type FinalGateManifest,
} from "./contracts";
import {
  requireDisposableFinalGateDatabase,
  requireRunArtifactPath,
} from "./guard";

const prisma = new PrismaClient();

async function main() {
  requireDisposableFinalGateDatabase();
  const manifest = JSON.parse(
    await readFile(requireRunArtifactPath("fixture-manifest.json"), "utf8"),
  ) as FinalGateManifest;
  const users = await prisma.user.findMany({
    where: { email: { in: Object.values(FINAL_GATE_IDENTITIES) } },
    select: { email: true, role: true, authState: true },
  });
  if (users.length !== 6 || users.some((user) => user.authState !== "ACTIVE")) {
    throw new Error("FINAL_GATE_IDENTITY_MANIFEST_MISMATCH");
  }
  const campaigns = await prisma.uceCampaign.findMany({
    where: { id: { in: Object.values(manifest.campaigns) } },
    include: { strategy: true },
  });
  if (campaigns.length !== 4)
    throw new Error("FINAL_GATE_CAMPAIGN_COUNT_MISMATCH");
  const projected = campaigns.map((campaign) =>
    projectCampaignObjectiveHandoffV1({
      campaignId: campaign.id,
      coreObjective: campaign.strategy?.coreObjective,
      canonicalDefinition: campaign.canonicalDefinition,
      canonicalDefinitionHash: campaign.canonicalDefinitionHash,
    }),
  );
  if (
    projected.some((value) => value.status !== "AVAILABLE") ||
    new Set(
      projected.map((value) =>
        value.status === "AVAILABLE" ? value.objective : "",
      ),
    ).size !== FINAL_GATE_OBJECTIVES.length
  )
    throw new Error("FINAL_GATE_OBJECTIVE_PROJECTION_MISMATCH");

  const legacy = await prisma.uceCampaign.findUniqueOrThrow({
    where: { id: FINAL_GATE_IDS.campaignLegacy },
    include: { strategy: true },
  });
  const legacyProjection = projectCampaignObjectiveHandoffV1({
    campaignId: legacy.id,
    coreObjective: legacy.strategy?.coreObjective,
    canonicalDefinition: legacy.canonicalDefinition,
    canonicalDefinitionHash: legacy.canonicalDefinitionHash,
  });
  if (legacyProjection.status !== "UNAVAILABLE")
    throw new Error("LEGACY_OBJECTIVE_DID_NOT_FAIL_CLOSED");

  const application = await prisma.uceApplication.findUniqueOrThrow({
    where: { id: FINAL_GATE_IDS.application },
    include: { collaboration: true },
  });
  if (
    application.authorityVersion !== "C03_CANONICAL" ||
    application.collaboration?.authorityVersion !== "CANONICAL_V1" ||
    application.collaboration.sourceApplicationId !== application.id
  )
    throw new Error("CANONICAL_C03_C04_HANDOFF_MISMATCH");

  const [providerMappings, financialInstructions, payoutReceipts] =
    await Promise.all([
      prisma.creatorPayoutDestinationProviderMapping.count(),
      prisma.collaborationFinancialAuthorityInstruction.count(),
      prisma.payoutReconciledReceipt.count(),
    ]);
  if (providerMappings + financialInstructions + payoutReceipts !== 0) {
    throw new Error("PROHIBITED_PROVIDER_OR_FINANCIAL_STATE_PRESENT");
  }
  process.stdout.write(
    JSON.stringify({
      identities: users.length,
      canonicalObjectives: FINAL_GATE_OBJECTIVES,
      legacyObjective: "UNAVAILABLE",
      handoff: "C03_CANONICAL_TO_C04_CANONICAL_V1",
      providerMappings,
      financialInstructions,
      payoutReceipts,
    }) + "\n",
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "FINAL_GATE_VALIDATION_FAILED",
    );
    process.exitCode = 1;
  });
