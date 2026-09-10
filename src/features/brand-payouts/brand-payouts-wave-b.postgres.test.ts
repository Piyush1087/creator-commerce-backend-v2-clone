import "reflect-metadata";

import { randomUUID } from "node:crypto";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  applicationHarness,
  brandFixture,
  campaignFixture,
  creatorFixture,
} from "../../../test/fixtures/c03-application-fixtures";
import type { PrismaService } from "../../prisma/prisma.service";
import { CollaborationEscrowReserveService } from "../brand-escrow/services/collaboration-escrow-reserve.service";
import { EscrowFinancialAllocationService } from "../brand-escrow/services/escrow-financial-allocation.service";
import { EscrowFundingAttributionService } from "../brand-escrow/services/escrow-funding-attribution.service";
import { CollaborationSecurementService } from "../collaboration/services/collaboration-securement.service";
import { CollaborationTrustedConfirmationService } from "../collaboration/services/collaboration-trusted-confirmation.service";
import type { CreatorPayoutProviderPort } from "./ports/creator-payout-provider.port";
import { FinancialReserveService } from "./services/financial-reserve.service";
import { FailClosedCreatorPayoutProviderService } from "./services/fail-closed-creator-payout-provider.service";
import { PayoutObligationIntakeService } from "./services/payout-obligation-intake.service";
import { PrismaCreatorPayoutReadinessService } from "./services/prisma-creator-payout-readiness.service";
import { ProviderNeutralPayoutService } from "./services/provider-neutral-payout.service";
import { BrandPayoutsQueryService } from "./services/brand-payouts-query.service";

describe.skipIf(process.env.BRAND_PAYOUTS_WAVE_B_DATABASE_TEST !== "true")(
  "Brand Payouts Wave B PostgreSQL normal path",
  () => {
    const db = new PrismaClient({
      transactionOptions: { timeout: 30_000, maxWait: 10_000 },
    });
    const attribution = new EscrowFundingAttributionService();
    const allocations = new EscrowFinancialAllocationService();
    const realtime = { broadcast: vi.fn().mockResolvedValue(undefined) };
    const securement = new CollaborationSecurementService(
      db as PrismaService,
      {} as never,
      realtime as never,
      {} as never,
      {} as never,
    );
    const confirmations = new CollaborationTrustedConfirmationService(
      db as PrismaService,
      securement,
    );

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (url.hostname !== "localhost" || url.pathname !== "/waveb_runtime")
        throw new Error("WAVE_B_DISPOSABLE_LOOPBACK_DATABASE_REQUIRED");
      await db.$connect();
    });
    afterAll(() => db.$disconnect());

    async function canonicalFixture(available = 118) {
      const h = applicationHarness(db);
      const creator = await creatorFixture(db);
      const brand = await brandFixture(db);
      const campaign = await campaignFixture(db, brand.brand.id);
      const application = await h.submit.submit(
        creator.user,
        campaign.campaign.id,
        campaign.selection(),
        randomUUID(),
      );
      await h.terminal.decide(
        brand.user,
        campaign.campaign.id,
        application.applicationId,
        "APPROVE",
        randomUUID(),
      );
      const collaboration = await db.collaboration.findUniqueOrThrow({
        where: { sourceApplicationId: application.applicationId },
        include: { commercialAgreement: true },
      });
      const agreementHash = "a".repeat(64);
      const instructionHash = "b".repeat(64);
      await db.collaboration.update({
        where: { id: collaboration.id },
        data: {
          canonicalStage: "SECUREMENT",
          currentStageStatus: "IN_PROGRESS",
        },
      });
      const agreement = await db.collaborationCommercialAgreement.update({
        where: { collaborationId: collaboration.id },
        data: {
          negotiationState: "LOCKED",
          agreedCreatorFee: 100,
          currency: "INR",
          paymentRail: "PLATFORM_ESCROW",
          securementState: "AWAITING_ESCROW_FUNDING",
          requiredSecuredAmount: 118,
          platformCommissionAmount: 15,
          platformCommissionGstAmount: 3,
          agreementHash,
          agreementVersion: 1,
          campaignPaymentTermSnapshot: "NET_7",
          termsLockedAt: new Date(),
        },
      });
      const instruction = await db.collaborationReserveInstruction.create({
        data: {
          requestId: `reserve-request:${randomUUID()}`,
          collaborationId: collaboration.id,
          commercialAgreementId: agreement.id,
          agreementVersion: 1,
          agreementHash,
          instructionVersion: 1,
          instructionHash,
          brandProfileId: brand.brand.id,
          campaignId: campaign.campaign.id,
          creatorProfileId: creator.profile.id,
          currency: "INR",
          creatorFee: 100,
          platformCommissionAmount: 15,
          platformCommissionGstAmount: 3,
          reserveAmount: 118,
          requestedByUserId: brand.user.id,
          status: "REQUESTED",
          idempotencyKey: `reserve:${randomUUID()}`,
        },
      });
      const vault = await db.brandEscrowVault.create({
        data: {
          brandProfileId: brand.brand.id,
          currency: "INR",
          totalPooledBalance: available,
          availableBalance: available,
        },
      });
      await db.escrowFundingLot.create({
        data: {
          vaultId: vault.id,
          brandProfileId: brand.brand.id,
          sourceType: "GATEWAY",
          provenanceStatus: "PROVEN_SOURCE",
          currency: "INR",
          requestedPrincipal: available,
          creditedPrincipal: available,
          capturedAmount: available,
          providerRefundableAmount: available,
          providerPaymentCaptured: true,
          availableAmount: available,
          economicAt: new Date(),
          creditedAt: new Date(),
        },
      });
      const membership = await db.brandTeamMember.findUniqueOrThrow({
        where: {
          brandProfileId_userId: {
            brandProfileId: brand.brand.id,
            userId: brand.user.id,
          },
        },
      });
      return {
        creator,
        brand,
        campaign,
        collaboration,
        agreement,
        instruction,
        vault,
        membership,
      };
    }

    function reserveService(
      f: Awaited<ReturnType<typeof canonicalFixture>>,
      scope = f.brand.brand.id,
    ) {
      const authorization = {
        resolve: vi.fn().mockResolvedValue({
          kind: "FULL_FINANCIAL",
          brandProfileId: scope,
          membershipId: f.membership.id,
          role: "BRAND_OWNER",
        }),
      };
      return new FinancialReserveService(
        db as PrismaService,
        authorization as never,
        new CollaborationEscrowReserveService(),
        attribution,
        confirmations,
      );
    }

    function reserveQuery() {
      return new BrandPayoutsQueryService(
        db as PrismaService,
        {
          decode: vi.fn().mockImplementation(({ requestAsOf }) => ({
            asOf: requestAsOf,
            lastRecordedAt: null,
            lastStableId: null,
          })),
          encode: vi.fn().mockReturnValue("test-only-signed-cursor"),
        } as never,
        { assertDatabaseUtc: vi.fn().mockResolvedValue(undefined) } as never,
        {} as never,
        {} as never,
      );
    }

    it("serializes same-command replay to exactly one reserve effect and rejects changed/cross-Brand commands", async () => {
      const f = await canonicalFixture();
      const asOf = new Date(Date.now() + 1_000);
      for (const role of ["BRAND_OWNER", "FINANCE_ADMIN"] as const) {
        const read = await reserveQuery().listReserveRequests({
          authorization: {
            kind: "FULL_FINANCIAL",
            brandProfileId: f.brand.brand.id,
            membershipId: f.membership.id,
            role,
            authorizedAsOf: asOf,
            authorizationVersion: "membership:test",
          },
          asOf,
          limit: 25,
        });
        expect(read.sections[0].payload).toContainEqual(
          expect.objectContaining({
            reserve_request_id: f.instruction.requestId,
            reserve_instruction_id: f.instruction.id,
            public_reference: `reserve-request:${f.instruction.requestId}`,
            status: "APPROVAL_REQUIRED",
            approval_required: true,
            reserve_value: { amount: "118.0000", currency: "INR" },
          }),
        );
        expect(read.sections[0].available_actions).toContainEqual(
          expect.objectContaining({
            action: "APPROVE_RESERVE",
            resource_reference: f.instruction.id,
          }),
        );
      }
      const crossBrandRead = await reserveQuery().listReserveRequests({
        authorization: {
          kind: "FULL_FINANCIAL",
          brandProfileId: randomUUID(),
          membershipId: randomUUID(),
          role: "BRAND_OWNER",
          authorizedAsOf: asOf,
          authorizationVersion: "membership:cross-brand",
        },
        asOf,
        limit: 25,
      });
      expect(crossBrandRead.sections[0].payload).toEqual([]);
      const service = reserveService(f);
      const command = {
        reserve_instruction_id: f.instruction.id,
        idempotency_key: `approval:${randomUUID()}`,
      };
      const results = await Promise.all([
        service.approveAndExecute(f.brand.user as never, command),
        service.approveAndExecute(f.brand.user as never, command),
      ]);
      expect(results.filter((row) => row.replayed)).toHaveLength(1);
      expect(
        await db.financialReserveApproval.count({
          where: { reserveInstructionId: f.instruction.id },
        }),
      ).toBe(1);
      expect(
        await db.financialReserveExecutionAttempt.count({
          where: {
            approval: { reserveInstructionId: f.instruction.id },
            outcome: "SUCCEEDED",
          },
        }),
      ).toBe(1);
      expect(
        await db.escrowTransactionLedger.count({
          where: {
            collaborationId: f.collaboration.id,
            transactionType: "CONTRACT_LOCK_RESERVE",
          },
        }),
      ).toBe(1);
      await expect(
        service.approveAndExecute(f.brand.user as never, {
          ...command,
          reserve_instruction_id: randomUUID(),
        }),
      ).rejects.toBeDefined();
      await expect(
        reserveService(f, randomUUID()).approveAndExecute(
          f.brand.user as never,
          { ...command, idempotency_key: `cross:${randomUUID()}` },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("fails closed for Campaign Manager authority and insufficient balance without financial allocation", async () => {
      const f = await canonicalFixture(117);
      const denied = new FinancialReserveService(
        db as PrismaService,
        {
          resolve: vi.fn().mockResolvedValue({ kind: "NO_FINANCIAL_ROWS" }),
        } as never,
        new CollaborationEscrowReserveService(),
        attribution,
        confirmations,
      );
      await expect(
        denied.approveAndExecute(f.brand.user as never, {
          reserve_instruction_id: f.instruction.id,
          idempotency_key: randomUUID(),
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const result = await reserveService(f).approveAndExecute(
        f.brand.user as never,
        {
          reserve_instruction_id: f.instruction.id,
          idempotency_key: randomUUID(),
        },
      );
      expect(result.approval.status).toBe("AWAITING_FUNDS");
      expect(
        await db.collaborationEscrowLock.count({
          where: { collaborationId: f.collaboration.id },
        }),
      ).toBe(0);
      expect(
        await db.collaborationFundingLotAllocation.count({
          where: { collaborationId: f.collaboration.id },
        }),
      ).toBe(0);
    });

    it("creates one exact C04 obligation, fences C05, and settles once through a deterministic test provider", async () => {
      const f = await canonicalFixture();
      const reserved = await reserveService(f).approveAndExecute(
        f.brand.user as never,
        {
          reserve_instruction_id: f.instruction.id,
          idempotency_key: randomUUID(),
        },
      );
      const confirmationId = reserved.approval.trustedConfirmationId!;
      const authority =
        await db.collaborationFinancialAuthorityInstruction.create({
          data: {
            collaborationId: f.collaboration.id,
            commercialAgreementId: f.agreement.id,
            agreementVersion: 1,
            agreementHash: "a".repeat(64),
            kind: "CREATOR_ENTITLEMENT",
            instructionVersion: 1,
            instructionHash: "c".repeat(64),
            amount: 100,
            currency: "INR",
            creatorEntitlementEffect: 100,
            brandRefundEffect: 0,
            settlementEligibleAt: new Date(Date.now() - 8 * 86_400_000),
            resolutionType: "NORMAL_SUCCESS",
            effectScope: "FULL",
            effectiveAt: new Date(),
            fundingLineageMode: "CANONICAL_PAYOUTS_V1",
            fundingConfirmationId: confirmationId,
            reserveInstructionId: f.instruction.id,
          },
        });
      const intake = new PayoutObligationIntakeService(
        db as PrismaService,
        allocations,
        attribution,
      );
      const first = await intake.acceptAuthority(authority.id);
      const replay = await intake.acceptAuthority(authority.id);
      expect(first.replayed).toBe(false);
      expect(replay).toMatchObject({
        replayed: true,
        obligation: { id: first.obligation.id },
      });
      const disabledProvider = new FailClosedCreatorPayoutProviderService();
      const disabledPath = new ProviderNeutralPayoutService(
        db as PrismaService,
        new PrismaCreatorPayoutReadinessService(db as PrismaService),
        disabledProvider,
        attribution,
      );
      await expect(
        disabledPath.executeDue(
          first.obligation.id,
          `disabled:${randomUUID()}`,
        ),
      ).resolves.toMatchObject({ outcome: "UNAVAILABLE", attempt: null });
      expect(disabledProvider.methodCounts).toEqual({
        readCapabilities: 1,
        createTransfer: 0,
        readTransfer: 0,
        requestReversal: 0,
      });
      expect(
        await db.routeTransferAttempt.count({
          where: { obligationId: first.obligation.id },
        }),
      ).toBe(0);
      await db.creatorPayoutObligation.update({
        where: { id: first.obligation.id },
        data: {
          status: "ELIGIBLE",
          lifecycle: "SCHEDULED",
          currentGate: "NOT_YET_DUE",
          blockedReason: null,
        },
      });
      const profile = await db.creatorPayoutProfile.update({
        where: { creatorProfileId: f.creator.profile.id },
        data: {
          bankStatus: "BANK_VALIDATED",
          operationalEligibility: "ELIGIBLE_FOR_TRANSFER",
          stateVersion: 7,
        },
      });
      const destination = await db.creatorPayoutDestination.create({
        data: {
          creatorProfileId: f.creator.profile.id,
          payeeType: "INDIVIDUAL",
          beneficiaryName: "Test Creator",
          destinationType: "BANK_ACCOUNT",
          countryCode: "IN",
          currencyCode: "INR",
          secretPayloadEncrypted: "test-only-encrypted",
          maskedDisplay: "bank •••• 4242",
          version: 3,
        },
      });
      await db.creatorPayoutDestinationProviderMapping.create({
        data: {
          destinationId: destination.id,
          destinationVersion: destination.version,
          provider: "DETERMINISTIC_TEST",
          providerReference: "test-destination",
        },
      });
      const counts = { create: 0, read: 0, reversal: 0 };
      const provider: CreatorPayoutProviderPort = {
        readCapabilities: async () => ({
          availability: "AVAILABLE",
          transferCreate: true,
          transferRead: true,
          reversalRequest: false,
          observedAt: new Date(),
          limitationReasonCode: null,
        }),
        createTransfer: async (request) => {
          counts.create += 1;
          return {
            outcome: "ACCEPTED",
            executionReference: `test-transfer:${request.attemptId}`,
            observedState: "PROCESSING",
            observedAt: new Date(),
          };
        },
        readTransfer: async (request) => {
          counts.read += 1;
          return {
            outcome: "FOUND",
            executionReference: request.executionReference,
            observedState: "SETTLED",
            observedAt: new Date(),
            evidenceReference: `test-settled:${request.attemptId}`,
          };
        },
        requestReversal: async () => {
          counts.reversal += 1;
          return {
            outcome: "UNAVAILABLE",
            reversalExecutionReference: null,
            reasonCode: "DEFERRED",
            observedAt: new Date(),
          };
        },
      };
      const payout = new ProviderNeutralPayoutService(
        db as PrismaService,
        new PrismaCreatorPayoutReadinessService(db as PrismaService),
        provider,
        attribution,
      );
      const commandKey = `transfer:${randomUUID()}`;
      const created = await payout.executeDue(first.obligation.id, commandKey);
      const replayed = await payout.executeDue(first.obligation.id, commandKey);
      expect(created.outcome).toBe("ACCEPTED");
      expect(replayed.outcome).toBe("REPLAYED");
      expect(counts.create).toBe(1);
      await payout.observeAndSettle(created.attempt!.id);
      await payout.observeAndSettle(created.attempt!.id);
      expect(counts).toEqual({ create: 1, read: 2, reversal: 0 });
      expect(
        await db.escrowTransactionLedger.count({
          where: {
            collaborationId: f.collaboration.id,
            transactionType: "CREATOR_PAYOUT_SETTLEMENT",
          },
        }),
      ).toBe(1);
      await expect(
        db.routeTransferAttempt.update({
          where: { id: created.attempt!.id },
          data: { destinationVersion: 4 },
        }),
      ).rejects.toBeDefined();
      await expect(
        db.payoutReconciledReceipt.deleteMany({
          where: { obligationId: first.obligation.id },
        }),
      ).rejects.toBeDefined();
      expect(profile.stateVersion).toBe(7);
    });
  },
);
