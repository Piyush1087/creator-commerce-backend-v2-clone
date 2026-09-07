import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { financialAuthorityHash } from "../utils/collaboration-financial-authority";
import { reconstructFinancialAuthorityInstructionHash } from "../utils/collaboration-financial-authority.persistence";
import {
  CollaborationTrustedConfirmationService,
  trustedEscrowConfirmationSchema,
} from "./collaboration-trusted-confirmation.service";

const ids = {
  collaborationId: "00000000-0000-4000-8000-000000000001",
  escrowLockRef: "00000000-0000-4000-8000-000000000002",
  reserveInstructionId: "00000000-0000-4000-8000-000000000003",
  commercialAgreementId: "00000000-0000-4000-8000-000000000004",
  reserveLedgerTransactionId: "00000000-0000-4000-8000-000000000005",
  brandProfileId: "00000000-0000-4000-8000-000000000006",
  campaignId: "00000000-0000-4000-8000-000000000007",
  creatorProfileId: "00000000-0000-4000-8000-000000000008",
};

function validInput() {
  const input: any = {
    confirmationId: "confirmation-1", bodyDigest: "0".repeat(64), ...ids,
    expectedAggregateVersion: 7, fundingConfirmationRef: "funding-1", confirmedAmount: "125.25",
    currency: "INR", reserveRequestId: "request-1", reserveInstructionVersion: 2,
    reserveInstructionHash: "a".repeat(64), agreementVersion: 3, agreementHash: "b".repeat(64),
    payoutsApprovalRef: "approval-1", reserveExecutionAttemptRef: "attempt-1",
  };
  const tuple = {
    confirmationType: "ESCROW_FUNDING", confirmationId: input.confirmationId,
    fundingConfirmationRef: input.fundingConfirmationRef,
    collaborationId: input.collaborationId, reserveInstructionId: input.reserveInstructionId,
    reserveRequestId: input.reserveRequestId, reserveInstructionVersion: input.reserveInstructionVersion,
    reserveInstructionHash: input.reserveInstructionHash, commercialAgreementId: input.commercialAgreementId,
    agreementVersion: input.agreementVersion, agreementHash: input.agreementHash,
    payoutsApprovalRef: input.payoutsApprovalRef, reserveExecutionAttemptRef: input.reserveExecutionAttemptRef,
    escrowLockId: input.escrowLockRef, reserveLedgerTransactionId: input.reserveLedgerTransactionId,
    brandProfileId: input.brandProfileId, campaignId: input.campaignId, creatorProfileId: input.creatorProfileId,
    confirmedAmount: "125.25", currency: "INR", disposition: "COMPLETED_SUFFICIENT",
  };
  input.bodyDigest = financialAuthorityHash(tuple);
  return { input, tuple };
}

describe("C04 trusted confirmation atomic claim", () => {
  it("reconstructs a persisted canonical Creator-entitlement hash byte-for-byte", () => {
    const persisted = {
      id: ids.reserveInstructionId,
      collaborationId: ids.collaborationId,
      commercialAgreementId: ids.commercialAgreementId,
      agreementVersion: 3,
      agreementHash: "b".repeat(64),
      kind: "CREATOR_ENTITLEMENT",
      instructionVersion: 1,
      amount: "125.25",
      currency: "INR",
      creatorEntitlementEffect: "125.25",
      brandRefundEffect: "0.00",
      settlementEligibleAt: "2026-09-07T00:00:00.000Z",
      resolutionType: "NORMAL_SUCCESS",
      effectScope: "FULL",
      sourceFinancialRef: "resolution-1",
      supersedesInstructionId: null,
      effectiveAt: "2026-09-07T00:00:00.000Z",
      fundingConfirmationId: "confirmation-row-1",
      reserveInstructionId: ids.reserveInstructionId,
    };
    expect(reconstructFinancialAuthorityInstructionHash({ ...persisted }))
      .toBe(financialAuthorityHash(persisted));
  });
  it("inserts final APPLIED shape before mutation and broadcasts once after commit", async () => {
    const { input } = validInput();
    const calls: string[] = [];
    const tx: any = {
      collaborationTrustedConfirmation: {
        create: vi.fn(async () => { calls.push("claim"); return { id: "claim" }; }),
      },
    };
    const prisma: any = { $transaction: (fn: any) => fn(tx) };
    const securement: any = {
      confirmEscrowFunding: vi.fn(async () => { calls.push("mutation"); return {}; }),
      broadcastConfirmationApplied: vi.fn(async () => { calls.push("broadcast"); }),
    };
    const service = new CollaborationTrustedConfirmationService(prisma, securement);
    await expect(service.consumeEscrow(input)).resolves.toMatchObject({ replayed: false });
    expect(calls).toEqual(["claim", "mutation", "broadcast"]);
    expect(securement.confirmEscrowFunding.mock.calls[0][3]).toBe(tx);
  });

  it("rereads an APPLIED exact winner and never invokes securement after P2002", async () => {
    const { input, tuple } = validInput();
    const race = new Prisma.PrismaClientKnownRequestError("race", { code: "P2002", clientVersion: "test", meta: { target: ["confirmation_type", "confirmation_id"] } });
    const prisma: any = {
      $transaction: vi.fn(async () => { throw race; }),
      collaborationTrustedConfirmation: { findUnique: vi.fn(async () => ({ ...tuple, bodyDigest: input.bodyDigest, applicationState: "APPLIED" })) },
    };
    const securement: any = { confirmEscrowFunding: vi.fn(), broadcastConfirmationApplied: vi.fn() };
    const service = new CollaborationTrustedConfirmationService(prisma, securement);
    await expect(service.consumeEscrow(input)).resolves.toEqual({ collaborationId: input.collaborationId, replayed: true });
    expect(securement.confirmEscrowFunding).not.toHaveBeenCalled();
    expect(securement.broadcastConfirmationApplied).not.toHaveBeenCalled();
  });

  it.each([
    "collaborationId", "reserveInstructionId", "reserveRequestId",
    "reserveInstructionVersion", "reserveInstructionHash",
    "commercialAgreementId", "agreementVersion", "agreementHash",
    "payoutsApprovalRef", "reserveExecutionAttemptRef", "escrowLockId",
    "reserveLedgerTransactionId", "brandProfileId", "campaignId",
    "creatorProfileId", "confirmedAmount", "currency", "disposition",
    "fundingConfirmationRef",
  ])(
    "rejects changed replay tuple family %s", async (field) => {
      const { input, tuple } = validInput();
      const race = new Prisma.PrismaClientKnownRequestError("race", { code: "P2002", clientVersion: "test", meta: { target: ["confirmation_type", "confirmation_id"] } });
      const prisma: any = { $transaction: async () => { throw race; }, collaborationTrustedConfirmation: {
        findUnique: async () => ({
          ...tuple,
          [field]: field === "confirmedAmount" ? "125.2600" : "changed",
          bodyDigest: input.bodyDigest,
          applicationState: "APPLIED",
        }),
      } };
      await expect(new CollaborationTrustedConfirmationService(prisma, { confirmEscrowFunding: vi.fn() } as any).consumeEscrow(input))
        .rejects.toBeInstanceOf(ConflictException);
    },
  );

  it("normalizes digest case, rejects mismatch, and rejects noncanonical decimals", async () => {
    const { input } = validInput();
    expect(() => trustedEscrowConfirmationSchema.parse({ ...input, confirmedAmount: 125.25 })).toThrow();
    expect(() => trustedEscrowConfirmationSchema.parse({ ...input, confirmedAmount: "01.00" })).toThrow();
    expect(() => trustedEscrowConfirmationSchema.parse({ ...input, confirmedAmount: "999999999999.99" })).not.toThrow();
    expect(() => trustedEscrowConfirmationSchema.parse({ ...input, confirmedAmount: "1000000000000.00" })).toThrow();
    expect(() => trustedEscrowConfirmationSchema.parse({ ...input, confirmedAmount: "1.001" })).toThrow();
    expect(() => trustedEscrowConfirmationSchema.parse({ ...input, payoutsApprovalRef: "bad/ref" })).toThrow();
    const service = new CollaborationTrustedConfirmationService({} as any, {} as any);
    await expect(service.consumeEscrow({ ...input, bodyDigest: "f".repeat(64) })).rejects.toBeInstanceOf(ConflictException);
  });

  it("never classifies a non-identity unique conflict as replay", async () => {
    const { input } = validInput();
    const conflict = new Prisma.PrismaClientKnownRequestError("race", {
      code: "P2002", clientVersion: "test", meta: { target: ["payouts_approval_ref"] },
    });
    const prisma: any = { $transaction: async () => { throw conflict; }, collaborationTrustedConfirmation: { findUnique: vi.fn() } };
    const securement: any = { confirmEscrowFunding: vi.fn(), broadcastConfirmationApplied: vi.fn() };
    await expect(new CollaborationTrustedConfirmationService(prisma, securement).consumeEscrow(input))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.collaborationTrustedConfirmation.findUnique).not.toHaveBeenCalled();
    expect(securement.confirmEscrowFunding).not.toHaveBeenCalled();
    expect(securement.broadcastConfirmationApplied).not.toHaveBeenCalled();
  });
});
