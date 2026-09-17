import { PrismaClient } from "@prisma/client";
import { writeFile } from "node:fs/promises";

import {
  requireDisposableFinalGateDatabase,
  requireRunArtifactPath,
} from "./guard";

const prisma = new PrismaClient();

async function main() {
  requireDisposableFinalGateDatabase();
  const snapshot = {
    providerMappings:
      await prisma.creatorPayoutDestinationProviderMapping.count(),
    financialAuthorityInstructions:
      await prisma.collaborationFinancialAuthorityInstruction.count(),
    payoutReceipts: await prisma.payoutReconciledReceipt.count(),
    collaborations: await prisma.collaboration.count(),
    applications: await prisma.uceApplication.count(),
    campaigns: await prisma.uceCampaign.count(),
  };
  await writeFile(
    requireRunArtifactPath("financial-provider-audit.json"),
    JSON.stringify(
      {
        allowedWriteClasses: [
          "CANONICAL_CAMPAIGN_CREATE",
          "C03_APPLICATION",
          "C04_HANDOFF",
        ],
        prohibitedWriteCounts: {
          providerMappings: snapshot.providerMappings,
          financialAuthorityInstructions:
            snapshot.financialAuthorityInstructions,
          payoutReceipts: snapshot.payoutReceipts,
        },
        snapshot,
      },
      null,
      2,
    ),
    "utf8",
  );
  if (
    snapshot.providerMappings +
      snapshot.financialAuthorityInstructions +
      snapshot.payoutReceipts !==
    0
  )
    throw new Error("UNAUTHORIZED_FINANCIAL_OR_PROVIDER_WRITE");
  process.stdout.write(JSON.stringify(snapshot) + "\n");
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "FINAL_GATE_AUDIT_FAILED",
    );
    process.exitCode = 1;
  });
