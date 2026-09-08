import "reflect-metadata";

import { randomUUID } from "node:crypto";
import { ForbiddenException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  applicationHarness,
  brandFixture,
  campaignFixture,
  creatorFixture,
  teamFixture,
} from "../../../test/fixtures/c03-application-fixtures";
import type { PrismaService } from "../../prisma/prisma.service";
import { CollaborationEscrowReserveService } from "../brand-escrow/services/collaboration-escrow-reserve.service";
import { EscrowFinancialAllocationService } from "../brand-escrow/services/escrow-financial-allocation.service";
import { EscrowFundingAttributionService } from "../brand-escrow/services/escrow-funding-attribution.service";
import { CollaborationSecurementService } from "../collaboration/services/collaboration-securement.service";
import { CollaborationTrustedConfirmationService } from "../collaboration/services/collaboration-trusted-confirmation.service";
import { PrismaCreatorPayoutMethodSummaryService } from "../creator-settings/payouts/prisma-creator-payout-method-summary.service";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { FinancialReserveService } from "../brand-payouts/services/financial-reserve.service";
import { PayoutObligationIntakeService } from "../brand-payouts/services/payout-obligation-intake.service";
import { CreatorPayoutsAuthorizationService } from "./services/creator-payouts-authorization.service";
import { CreatorPayoutsObligationProjectionService } from "./services/creator-payouts-obligation-projection.service";

describe.skipIf(process.env.C06_PAYOUTS_DATABASE_TEST !== "true")(
  "C06 creator payouts PostgreSQL projection",
  () => {
    const db = new PrismaClient({
      transactionOptions: { timeout: 30_000, maxWait: 10_000 },
    });
    const attribution = new EscrowFundingAttributionService();
    const allocations = new EscrowFinancialAllocationService();
    const securement = new CollaborationSecurementService(
      db as PrismaService,
      {} as never,
      { broadcast: vi.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      {} as never,
    );
    const confirmations = new CollaborationTrustedConfirmationService(
      db as PrismaService,
      securement,
    );

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "c06-recovery-r0-pg16"].includes(
          url.hostname,
        ) ||
        url.pathname !== "/c06_recovery"
      ) {
        throw new Error("C06_DISPOSABLE_DATABASE_REQUIRED");
      }
      await db.$connect();
      const [proof] = await db.$queryRaw<
        Array<{ major: number; timezone: string }>
      >`SELECT current_setting('server_version_num')::int / 10000 AS major, current_setting('TimeZone') AS timezone`;
      expect(proof).toEqual({ major: 16, timezone: "UTC" });
    });

    afterAll(() => db.$disconnect());

    it("proves actor isolation and exact canonical read truth without provider actions", async () => {
      const owner = await creatorFixture(db);
      const manager = await teamFixture(db, owner, "MANAGER");
      const assistant = await teamFixture(db, owner, "ASSISTANT");
      const outsider = await creatorFixture(db);
      const brand = await brandFixture(db);
      const campaign = await campaignFixture(db, brand.brand.id);
      const h = applicationHarness(db);
      const application = await h.submit.submit(
        owner.user,
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
          requestId: `c06-reserve:${randomUUID()}`,
          collaborationId: collaboration.id,
          commercialAgreementId: agreement.id,
          agreementVersion: 1,
          agreementHash,
          instructionVersion: 1,
          instructionHash,
          brandProfileId: brand.brand.id,
          campaignId: campaign.campaign.id,
          creatorProfileId: owner.profile.id,
          currency: "INR",
          creatorFee: 100,
          platformCommissionAmount: 15,
          platformCommissionGstAmount: 3,
          reserveAmount: 118,
          requestedByUserId: brand.user.id,
          status: "REQUESTED",
          idempotencyKey: `c06-reserve-idem:${randomUUID()}`,
        },
      });
      const vault = await db.brandEscrowVault.create({
        data: {
          brandProfileId: brand.brand.id,
          currency: "INR",
          totalPooledBalance: 118,
          availableBalance: 118,
        },
      });
      await db.escrowFundingLot.create({
        data: {
          vaultId: vault.id,
          brandProfileId: brand.brand.id,
          sourceType: "GATEWAY",
          provenanceStatus: "PROVEN_SOURCE",
          currency: "INR",
          requestedPrincipal: 118,
          creditedPrincipal: 118,
          capturedAmount: 118,
          providerRefundableAmount: 118,
          providerPaymentCaptured: true,
          availableAmount: 118,
          economicAt: new Date(),
          creditedAt: new Date(),
        },
      });
      const brandMember = await db.brandTeamMember.findUniqueOrThrow({
        where: {
          brandProfileId_userId: {
            brandProfileId: brand.brand.id,
            userId: brand.user.id,
          },
        },
      });
      const reserve = new FinancialReserveService(
        db as PrismaService,
        {
          resolve: vi.fn().mockResolvedValue({
            kind: "FULL_FINANCIAL",
            brandProfileId: brand.brand.id,
            membershipId: brandMember.id,
            role: "BRAND_OWNER",
          }),
        } as never,
        new CollaborationEscrowReserveService(),
        attribution,
        confirmations,
      );
      const reserved = await reserve.approveAndExecute(brand.user as never, {
        reserve_instruction_id: instruction.id,
        idempotency_key: randomUUID(),
      });
      const eligibleAt = new Date(Date.now() - 8 * 86_400_000);
      const authority =
        await db.collaborationFinancialAuthorityInstruction.create({
          data: {
            collaborationId: collaboration.id,
            commercialAgreementId: agreement.id,
            agreementVersion: 1,
            agreementHash,
            kind: "CREATOR_ENTITLEMENT",
            instructionVersion: 1,
            instructionHash: "c".repeat(64),
            amount: 100,
            currency: "INR",
            creatorEntitlementEffect: 100,
            brandRefundEffect: 0,
            settlementEligibleAt: eligibleAt,
            resolutionType: "NORMAL_SUCCESS",
            effectScope: "FULL",
            effectiveAt: new Date(),
            fundingLineageMode: "CANONICAL_PAYOUTS_V1",
            fundingConfirmationId: reserved.approval.trustedConfirmationId!,
            reserveInstructionId: instruction.id,
          },
        });
      const intake = new PayoutObligationIntakeService(
        db as PrismaService,
        allocations,
        attribution,
      );
      const accepted = await intake.acceptAuthority(authority.id);

      const authorization = new CreatorPayoutsAuthorizationService(
        new CreatorWorkspaceActorService(db as PrismaService),
      );
      const ownerScope = await authorization.resolve(owner.user as never);
      const managerScope = await authorization.resolve(manager.user as never);
      await expect(
        authorization.resolve(assistant.user as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const outsiderScope = await authorization.resolve(outsider.user as never);
      const projection = new CreatorPayoutsObligationProjectionService(
        db as PrismaService,
        {
          decode: vi.fn().mockImplementation(({ requestAsOf }) => ({
            asOf: requestAsOf,
            lastRecordedAt: null,
            lastStableId: null,
          })),
          encode: vi.fn().mockReturnValue("test-signed-cursor"),
        } as never,
      );
      const asOf = new Date();
      for (const scope of [ownerScope, managerScope]) {
        const page = await projection.list({
          authorization: scope,
          asOf,
          limit: 25,
        });
        expect(page.items).toContainEqual(
          expect.objectContaining({
            obligation_id: accepted.obligation.id,
            entitlement_value: { amount: "100.0000", currency: "INR" },
            outstanding_value: { amount: "100.0000", currency: "INR" },
            effective_gate: "PROVIDER_UNAVAILABLE",
            payment_term: "NET_7",
          }),
        );
      }
      const foreign = await projection.list({
        authorization: outsiderScope,
        asOf,
        limit: 25,
      });
      expect(foreign.items).toEqual([]);

      const method = await new PrismaCreatorPayoutMethodSummaryService(
        db as PrismaService,
      ).read(owner.profile.id, true);
      expect(method).toMatchObject({
        status: "NONE",
        manage_settings_href: "/creator/settings/payouts",
      });
      expect(
        await db.routeTransferAttempt.count({
          where: { obligationId: accepted.obligation.id },
        }),
      ).toBe(0);
    }, 60_000);
  },
);
