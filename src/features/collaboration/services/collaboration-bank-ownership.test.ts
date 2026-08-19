import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { CreatorBankVerificationStatus, UserRole } from "@prisma/client";

import { CreatorSettingsService } from "../../creator-settings/services/creator-settings.service";

/**
 * G1C bank ownership: Settings/Payout upsert must create CreatorSettlementProfile
 * so Collaboration securement can leave AWAITING_PAYOUT_DETAILS.
 * Collaboration no longer owns a bank mutation endpoint.
 */
test("Settings payout bank write creates settlement profile used by securement readiness", async () => {
  const profile = { id: "creator-profile-1", userId: "creator-user" };
  let settlementUpsert: any = null;
  let bankCreated: any = null;

  const prisma: any = {
    creatorBankDetails: {
      updateMany: async () => ({ count: 1 }),
      create: async ({ data }: any) => {
        bankCreated = { id: "bank-1", ...data };
        return bankCreated;
      },
    },
    creatorSettlementProfile: {
      upsert: async (args: any) => {
        settlementUpsert = args;
        return { id: "settlement-1", ...args.create };
      },
    },
  };

  const access: any = {
    resolveCreatorProfile: async () => profile,
    resolveWorkspace: async () => ({ id: "ws-1" }),
    resolveWorkspaceRole: async () => "OWNER",
    assertPayoutMutation: () => undefined,
    isAssistantReadOnly: () => false,
  };

  const service = new CreatorSettingsService(prisma, access);
  const creator: any = {
    id: "creator-user",
    role: UserRole.CREATOR,
    email: "creator@example.com",
  };

  const result = await service.upsertPayoutBank(creator, {
    beneficiaryLegalName: "Creator One",
    accountNumber: "1234567890",
    confirmAccountNumber: "1234567890",
    routingIfscSwift: "HDFC0001234",
  });

  assert.equal(
    result.verification_status,
    CreatorBankVerificationStatus.PENDING,
  );
  assert.ok(bankCreated);
  assert.equal(bankCreated.isPrimary, true);
  assert.ok(settlementUpsert);
  assert.equal(settlementUpsert.where.creatorProfileId, profile.id);
  assert.equal(settlementUpsert.create.accountHolderName, "Creator One");
  assert.equal(settlementUpsert.create.ifscCode, "HDFC0001234");
});

test("Collaboration controller no longer exposes POST creator/bank-details", () => {
  const controllerPath = join(__dirname, "../collaboration.controller.ts");
  const source = readFileSync(controllerPath, "utf8");
  assert.equal(source.includes("creator/bank-details"), false);
  assert.equal(source.includes("upsertBankDetails"), false);
});

test("Collaboration creator profile service no longer mutates bank details", () => {
  const servicePath = join(
    __dirname,
    "./collaboration-creator-profile.service.ts",
  );
  const source = readFileSync(servicePath, "utf8");
  assert.equal(source.includes("upsertBankDetails"), false);
  assert.equal(source.includes("creatorBankDetails.create"), false);
});
