import assert from "node:assert/strict";
import test from "node:test";

import {
  CollaborationActorClass,
  CollaborationFulfillmentState,
  CollaborationLifecycle,
  CollaborationNegotiationState,
  CollaborationPaymentRail,
  CollaborationSecurementState,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
  UceMilestoneStage,
  UserRole,
} from "@prisma/client";

import { CollaborationNegotiationService } from "./collaboration-negotiation.service";
import { CollaborationSecurementService } from "./collaboration-securement.service";

const brandUser = {
  id: "brand-user",
  email: "brand@example.com",
  name: "Brand",
  role: UserRole.BRAND,
  organizationId: "org-1",
};
const creatorUser = {
  id: "creator-1",
  email: "creator@example.com",
  name: "Creator",
  role: UserRole.CREATOR,
  organizationId: null,
};
const fundingSystem = { actorClass: CollaborationActorClass.SYSTEM } as const;

function makeRow(): any {
  return {
    id: "collaboration-1",
    sourceApplicationId: "application-1",
    brandProfileId: "brand-1",
    creatorUserId: "creator-1",
    campaignId: "campaign-1",
    briefId: "brief-1",
    productId: "asset-1",
    ucePipelineCollaborationId: null,
    campaignCreatorId: "campaign-creator-1",
    campaignAssetId: "asset-1",
    lifecycle: CollaborationLifecycle.ACTIVE,
    canonicalStage: CollaborationStage.NEGOTIATION,
    currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
    aggregateVersion: 1,
    endedFromStage: null,
    endedReasonCode: null,
    endedReasonText: null,
    endedByActorClass: null,
    endedByUserId: null,
    endedAt: null,
    completedAt: null,
    currentStage: UceMilestoneStage.STAGE_1_NEGOTIATION,
    payoutMode: "ESCROW",
    industry: "D2C_ECOMMERCE",
    negotiationRound: 0,
    fulfillmentIssueCount: 0,
    revisionCount: 0,
    unreadCountBrand: 0,
    unreadCountCreator: 0,
    lastMessageSnippet: null,
    lastMessageAt: null,
    stageUpdatedAt: new Date("2026-08-10T00:00:00Z"),
    isPaused: false,
    isTerminated: false,
    createdAt: new Date("2026-08-10T00:00:00Z"),
    updatedAt: new Date("2026-08-10T00:00:00Z"),
    campaign: { name: "Campaign", brandProfileId: "brand-1" },
    brief: { internalTitle: "Brief", creativeGuidelines: "Guidance" },
    product: {
      id: "asset-1",
      productName: "Product",
      assetType: "INDIVIDUAL_PRODUCT_SKU",
      skuCode: null,
      imageUrl: null,
    },
    brandProfile: { id: "brand-1", name: "Brand", countryCode: "IN" },
    creatorUser: {
      id: "creator-1",
      name: "Creator",
      email: "creator@example.com",
      creatorProfile: {
        id: "creator-profile-1",
        displayName: "Creator",
        instagramHandle: "creator",
      },
    },
    snapshot: null,
    commercials: null,
    logistics: null,
    finalization: null,
    media: [],
    commercialAgreement: {
      id: "agreement-1",
      collaborationId: "collaboration-1",
      negotiationState: CollaborationNegotiationState.AWAITING_BRAND_DECISION,
      applicationProposedFee: new Prisma.Decimal(1000),
      brandCounterFee: null,
      agreedCreatorFee: null,
      currency: "USD",
      advancePercentageSnapshot: 40,
      advanceAmount: null,
      balanceAmount: null,
      nonCashConsideration: null,
      paymentRail: CollaborationPaymentRail.PLATFORM_ESCROW,
      securementState: null,
      requiredSecuredAmount: null,
      confirmedSecuredAmount: null,
      fundingInstructionRef: null,
      fundingConfirmationRef: null,
      manualPaymentEvidenceRef: null,
      manualCreatorConfirmedAt: null,
      paymentDisputeRef: null,
      termsLockedAt: null,
      securementCompletedAt: null,
    },
    fulfillment: {
      id: "fulfillment-1",
      collaborationId: "collaboration-1",
      state: CollaborationFulfillmentState.SKIPPED,
      issueCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    financialResolution: null,
    deliverables: [],
  };
}

function harness(
  options: {
    manualEnabled?: boolean;
    payoutProfile?: boolean;
    reserveSucceeds?: boolean;
  } = {},
) {
  const row = makeRow();
  const events: Array<Record<string, any>> = [];
  let fundingRequests = 0;
  let fundingUsedTransaction = false;
  let commissionRate = 7;
  const tx: any = {
    collaboration: {
      findUniqueOrThrow: async () => row,
      updateMany: async ({ where, data }: any) => {
        if (where.aggregateVersion !== row.aggregateVersion)
          return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          if (key === "aggregateVersion") row.aggregateVersion += 1;
          else (row as any)[key] = value;
        }
        return { count: 1 };
      },
    },
    collaborationCommercialAgreement: {
      update: async ({ data }: any) => {
        Object.assign(row.commercialAgreement, data);
        return row.commercialAgreement;
      },
    },
    collaborationFulfillment: {
      update: async ({ data }: any) => {
        Object.assign(row.fulfillment, data);
        return row.fulfillment;
      },
    },
    collaborationFinancialResolution: {
      upsert: async ({ create }: any) => {
        row.financialResolution = create;
        return create;
      },
    },
    collaborationEvent: {
      findFirst: async ({ where }: any) =>
        events.find(
          (event) =>
            event.collaborationId === where.collaborationId &&
            event.commandId === where.commandId,
        ) ?? null,
      create: async ({ data }: any) => {
        events.push(data);
        return data;
      },
    },
    creatorSettlementProfile: {
      findUnique: async () =>
        options.payoutProfile ? { id: "settlement-profile-1" } : null,
    },
    collaborationEscrowLock: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        collaborationId: row.id,
        brandProfileId: row.brandProfileId,
        totalEscrowLockedAmount: new Prisma.Decimal(
          where.id === "lock-partial" ? 500 : 1082.6,
        ),
      }),
    },
  };
  const prisma: any = {
    ...tx,
    $transaction: async (callback: any) => callback(tx),
  };
  const access: any = { assertThreadForUser: async () => row };
  const realtime: any = { broadcast: async () => undefined };
  const capabilities: any = {
    manualEnabledForNewObligations: () => options.manualEnabled ?? false,
  };
  const funding: any = {
    reserveFunds: async (transaction: any) => {
      fundingRequests += 1;
      fundingUsedTransaction = transaction === tx;
      if (options.reserveSucceeds) {
        return {
          status: "RESERVED",
          escrowLockRef: "lock-reserved",
          confirmedAmount: new Prisma.Decimal(1082.6),
        };
      }
      return {
        status: "INSUFFICIENT_AVAILABLE_BALANCE",
        availableAmount: new Prisma.Decimal(0),
        shortfallAmount: new Prisma.Decimal(1082.6),
      };
    },
  };
  const planPolicies: any = {
    resolveForBrand: async () => ({
      tier: "FOUNDERS_BETA",
      policyVersion: "subscription-commercial-v1:FOUNDERS_BETA",
      platformCommissionRate: new Prisma.Decimal(commissionRate),
    }),
  };
  const geographyPolicies: any = {
    resolve: () => ({
      countryCode: "IN",
      policyVersion: "IN-MVP-2026-01",
      platformCommissionGstRate: new Prisma.Decimal(18),
    }),
  };
  return {
    row,
    events,
    fundingRequests: () => fundingRequests,
    fundingUsedTransaction: () => fundingUsedTransaction,
    setCommissionRate: (value: number) => {
      commissionRate = value;
    },
    negotiation: new CollaborationNegotiationService(
      prisma,
      access,
      realtime,
      capabilities,
      planPolicies,
      geographyPolicies,
    ),
    securement: new CollaborationSecurementService(
      prisma,
      access,
      realtime,
      funding,
    ),
  };
}

test("Brand accepts proposal once, locks snapshotted commercial arithmetic, and replays idempotently", async () => {
  const h = harness();
  const command = { commandId: "accept-1", expectedAggregateVersion: 1 };
  await h.negotiation.acceptProposedFee(brandUser, h.row.id, command);

  assert.equal(h.row.commercialAgreement.negotiationState, "LOCKED");
  assert.equal(h.row.commercialAgreement.agreedCreatorFee?.toNumber(), 1000);
  assert.equal(h.row.commercialAgreement.advanceAmount?.toNumber(), 400);
  assert.equal(h.row.commercialAgreement.balanceAmount?.toNumber(), 600);
  assert.equal(
    h.row.commercialAgreement.requiredSecuredAmount?.toNumber(),
    1082.6,
  );
  assert.equal(h.row.canonicalStage, CollaborationStage.SECUREMENT);
  assert.equal(h.row.aggregateVersion, 2);
  assert.equal(
    h.row.commercialAgreement.platformCommissionRateSnapshot?.toNumber(),
    7,
  );
  assert.equal(
    h.row.commercialAgreement.platformCommissionAmount?.toNumber(),
    70,
  );
  assert.equal(
    h.row.commercialAgreement.platformCommissionGstAmount?.toNumber(),
    12.6,
  );
  assert.equal(h.events.length, 1);

  h.setCommissionRate(9);
  assert.equal(
    h.row.commercialAgreement.platformCommissionRateSnapshot?.toNumber(),
    7,
  );

  await h.negotiation.acceptProposedFee(brandUser, h.row.id, command);
  assert.equal(h.row.aggregateVersion, 2);
  assert.equal(h.events.length, 1);
  await assert.rejects(
    () =>
      h.negotiation.acceptProposedFee(brandUser, h.row.id, {
        commandId: "stale-accept",
        expectedAggregateVersion: 1,
      }),
    (error: any) =>
      error.response?.code === "STALE_AGGREGATE_VERSION" ||
      error.response?.code === "NEGOTIATION_ALREADY_LOCKED" ||
      error.response?.code === "INVALID_STAGE",
  );
});

test("stale aggregate version is rejected before a Negotiation transition commits", async () => {
  const h = harness();
  await assert.rejects(
    () =>
      h.negotiation.counterOffer(brandUser, h.row.id, {
        commandId: "stale-counter",
        expectedAggregateVersion: 99,
        counterFee: 800,
      }),
    (error: any) => error.response?.code === "STALE_AGGREGATE_VERSION",
  );
  assert.equal(h.row.aggregateVersion, 1);
  assert.equal(h.events.length, 0);
});

test("Brand gets one counter and Creator can accept it", async () => {
  const h = harness();
  await h.negotiation.counterOffer(brandUser, h.row.id, {
    commandId: "counter-1",
    expectedAggregateVersion: 1,
    counterFee: 800,
  });
  assert.equal(
    h.row.commercialAgreement.negotiationState,
    "AWAITING_CREATOR_DECISION",
  );
  await assert.rejects(
    () =>
      h.negotiation.counterOffer(brandUser, h.row.id, {
        commandId: "counter-2",
        expectedAggregateVersion: 2,
        counterFee: 700,
      }),
    (error: any) => error.response?.code === "COUNTER_OFFER_ALREADY_USED",
  );
  await h.negotiation.acceptCounterOffer(creatorUser, h.row.id, {
    commandId: "accept-counter",
    expectedAggregateVersion: 2,
  });
  assert.equal(h.row.commercialAgreement.agreedCreatorFee?.toNumber(), 800);
  assert.equal(h.row.commercialAgreement.advanceAmount?.toNumber(), 320);
  assert.equal(h.row.commercialAgreement.balanceAmount?.toNumber(), 480);
});

test("Negotiation decline cancels without inventing Creator entitlement", async () => {
  const h = harness();
  await h.negotiation.decline(brandUser, h.row.id, {
    commandId: "decline-1",
    expectedAggregateVersion: 1,
    reasonCode: "BRAND_DECLINED",
  });
  assert.equal(h.row.lifecycle, CollaborationLifecycle.CANCELLED);
  assert.equal(h.row.commercialAgreement.negotiationState, "FAILED");
  assert.equal(
    (h.row.financialResolution as any).creatorEntitlementAmount.toNumber(),
    0,
  );
});

test("Manual-disabled capability prevents a new Manual obligation but existing Manual Securement remains operable", async () => {
  const h = harness({ manualEnabled: false });
  h.row.commercialAgreement.paymentRail = CollaborationPaymentRail.MANUAL;
  await assert.rejects(
    () =>
      h.negotiation.acceptProposedFee(brandUser, h.row.id, {
        commandId: "manual-lock",
        expectedAggregateVersion: 1,
      }),
    (error: any) => error.response?.code === "MANUAL_PAYMENT_DISABLED",
  );
  assert.equal(h.row.aggregateVersion, 1);
  assert.equal(h.events.length, 0);

  h.row.canonicalStage = CollaborationStage.SECUREMENT;
  h.row.commercialAgreement.negotiationState =
    CollaborationNegotiationState.LOCKED;
  h.row.commercialAgreement.securementState =
    CollaborationSecurementState.AWAITING_BRAND_PAYMENT;
  h.row.commercialAgreement.requiredSecuredAmount = new Prisma.Decimal(1000);
  await h.securement.reportManualPayment(brandUser, h.row.id, {
    commandId: "manual-evidence",
    expectedAggregateVersion: 1,
    paymentEvidenceRef: "evidence-1",
  });
  assert.equal(
    h.row.commercialAgreement.securementState,
    "AWAITING_CREATOR_CONFIRMATION",
  );
});

test("Escrow request is not confirmation; only trusted confirmation can complete 100% Securement", async () => {
  const h = harness();
  h.row.canonicalStage = CollaborationStage.SECUREMENT;
  h.row.commercialAgreement.negotiationState =
    CollaborationNegotiationState.LOCKED;
  h.row.commercialAgreement.agreedCreatorFee = new Prisma.Decimal(1000);
  h.row.commercialAgreement.platformCommissionAmount = new Prisma.Decimal(70);
  h.row.commercialAgreement.platformCommissionGstAmount = new Prisma.Decimal(
    12.6,
  );
  h.row.commercialAgreement.requiredSecuredAmount = new Prisma.Decimal(1082.6);
  h.row.commercialAgreement.confirmedSecuredAmount = new Prisma.Decimal(0);
  h.row.commercialAgreement.securementState =
    CollaborationSecurementState.AWAITING_ESCROW_FUNDING;

  await h.securement.requestEscrowFunding(brandUser, h.row.id, {
    commandId: "fund-request",
    expectedAggregateVersion: 1,
  });
  assert.equal(h.fundingRequests(), 1);
  assert.equal(
    h.row.commercialAgreement.securementState,
    "AWAITING_ESCROW_FUNDING",
  );
  assert.equal(h.row.commercialAgreement.confirmedSecuredAmount?.toNumber(), 0);
  await assert.rejects(
    () =>
      h.securement.confirmEscrowFunding(
        { actorClass: CollaborationActorClass.BRAND } as any,
        h.row.id,
        {
          commandId: "brand-confirm",
          expectedAggregateVersion: 2,
          fundingConfirmationRef: "confirmation-brand",
          escrowLockRef: "lock-full",
          confirmedAmount: 1082.6,
          currency: "USD",
        },
      ),
    (error: any) => error.response?.code === "UNAUTHORIZED_ACTOR",
  );
  await h.securement.confirmEscrowFunding(fundingSystem, h.row.id, {
    commandId: "partial-confirm",
    expectedAggregateVersion: 2,
    fundingConfirmationRef: "confirmation-500",
    escrowLockRef: "lock-partial",
    confirmedAmount: 500,
    currency: "USD",
  });
  assert.equal(h.row.commercialAgreement.securementState, "PROCESSING_FUNDING");
  await h.securement.confirmEscrowFunding(fundingSystem, h.row.id, {
    commandId: "full-confirm",
    expectedAggregateVersion: 3,
    fundingConfirmationRef: "confirmation-1000",
    escrowLockRef: "lock-full",
    confirmedAmount: 1082.6,
    currency: "USD",
  });
  assert.equal(h.row.commercialAgreement.securementState, "COMPLETED");
  assert.equal(h.row.canonicalStage, CollaborationStage.PRODUCTION);
});

test("stale Escrow command is rejected before reserve and successful reserve shares the Collaboration transaction", async () => {
  const stale = harness({ reserveSucceeds: true });
  stale.row.canonicalStage = CollaborationStage.SECUREMENT;
  stale.row.commercialAgreement.negotiationState =
    CollaborationNegotiationState.LOCKED;
  stale.row.commercialAgreement.agreedCreatorFee = new Prisma.Decimal(1000);
  stale.row.commercialAgreement.platformCommissionAmount = new Prisma.Decimal(
    70,
  );
  stale.row.commercialAgreement.platformCommissionGstAmount =
    new Prisma.Decimal(12.6);
  stale.row.commercialAgreement.requiredSecuredAmount = new Prisma.Decimal(
    1082.6,
  );
  stale.row.commercialAgreement.securementState =
    CollaborationSecurementState.AWAITING_ESCROW_FUNDING;
  await assert.rejects(
    () =>
      stale.securement.requestEscrowFunding(brandUser, stale.row.id, {
        commandId: "stale-funding",
        expectedAggregateVersion: 99,
      }),
    (error: any) => error.response?.code === "STALE_AGGREGATE_VERSION",
  );
  assert.equal(stale.fundingRequests(), 0);
  assert.equal(stale.events.length, 0);

  await stale.securement.requestEscrowFunding(brandUser, stale.row.id, {
    commandId: "atomic-funding",
    expectedAggregateVersion: 1,
  });
  assert.equal(stale.fundingRequests(), 1);
  assert.equal(stale.fundingUsedTransaction(), true);
  assert.equal(stale.row.commercialAgreement.escrowLockRef, "lock-reserved");
  assert.equal(stale.row.commercialAgreement.securementState, "COMPLETED");
  assert.equal(stale.row.canonicalStage, CollaborationStage.PRODUCTION);
  assert.equal(stale.row.aggregateVersion, 2);
  assert.equal(stale.events.length, 1);
});

test("Manual evidence requires Creator confirmation and dispute blocks Securement", async () => {
  const confirmed = harness();
  confirmed.row.canonicalStage = CollaborationStage.SECUREMENT;
  confirmed.row.commercialAgreement.paymentRail =
    CollaborationPaymentRail.MANUAL;
  confirmed.row.commercialAgreement.securementState =
    CollaborationSecurementState.AWAITING_BRAND_PAYMENT;
  confirmed.row.commercialAgreement.requiredSecuredAmount = new Prisma.Decimal(
    1000,
  );
  await confirmed.securement.reportManualPayment(brandUser, confirmed.row.id, {
    commandId: "manual-report",
    expectedAggregateVersion: 1,
    paymentEvidenceRef: "manual-evidence",
  });
  assert.notEqual(
    confirmed.row.commercialAgreement.securementState,
    "COMPLETED",
  );
  await confirmed.securement.confirmManualPayment(
    creatorUser,
    confirmed.row.id,
    {
      commandId: "manual-confirm",
      expectedAggregateVersion: 2,
    },
  );
  assert.equal(confirmed.row.commercialAgreement.securementState, "COMPLETED");

  const disputed = harness();
  disputed.row.canonicalStage = CollaborationStage.SECUREMENT;
  disputed.row.commercialAgreement.paymentRail =
    CollaborationPaymentRail.MANUAL;
  disputed.row.commercialAgreement.securementState =
    CollaborationSecurementState.AWAITING_CREATOR_CONFIRMATION;
  await disputed.securement.disputeManualPayment(creatorUser, disputed.row.id, {
    commandId: "manual-dispute",
    expectedAggregateVersion: 1,
    reasonText: "Not received",
  });
  assert.equal(
    disputed.row.commercialAgreement.securementState,
    "PAYMENT_DISPUTED",
  );
  assert.equal(
    disputed.row.currentStageStatus,
    CollaborationStageStatus.BLOCKED,
  );
});
