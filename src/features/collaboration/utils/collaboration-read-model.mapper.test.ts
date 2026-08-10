import assert from "node:assert/strict";
import test from "node:test";

import {
  CollaborationDeliverableState,
  CollaborationFulfillmentState,
  CollaborationLifecycle,
  CollaborationNegotiationState,
  CollaborationPaymentRail,
  CollaborationPublicationAuthorizationState,
  CollaborationPublishingState,
  CollaborationSecurementState,
  CollaborationStage,
  CollaborationStageStatus,
  UceMilestoneStage,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import {
  projectCanonicalCollaborationDetail,
  projectCanonicalCollaborationThreadRow,
  type CollaborationReadSource,
} from "./collaboration-thread.mapper";

function canonicalRow(
  overrides: Record<string, unknown> = {},
): CollaborationReadSource {
  return {
    id: "collaboration-1",
    brandProfileId: "brand-1",
    creatorUserId: "creator-1",
    campaignId: "campaign-1",
    briefId: "brief-1",
    productId: "asset-1",
    ucePipelineCollaborationId: "legacy-pipeline-1",
    sourceApplicationId: "application-1",
    campaignCreatorId: "campaign-creator-1",
    campaignAssetId: "asset-1",
    lifecycle: CollaborationLifecycle.ACTIVE,
    canonicalStage: CollaborationStage.NEGOTIATION,
    currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
    aggregateVersion: 1,
    currentStage: UceMilestoneStage.STAGE_6_FEEDBACK_SYNC,
    payoutMode: "ESCROW",
    industry: "D2C_ECOMMERCE",
    negotiationRound: 99,
    fulfillmentIssueCount: 99,
    revisionCount: 99,
    unreadCountBrand: 4,
    unreadCountCreator: 2,
    lastMessageSnippet: "Canonical message",
    lastMessageAt: new Date("2026-08-10T10:00:00.000Z"),
    stageUpdatedAt: new Date("2026-08-10T09:00:00.000Z"),
    isPaused: true,
    isTerminated: true,
    createdAt: new Date("2026-08-10T08:00:00.000Z"),
    updatedAt: new Date("2026-08-10T10:00:00.000Z"),
    campaign: { name: "Launch", brandProfileId: "brand-1" },
    brief: { internalTitle: "Launch brief", creativeGuidelines: "Be clear" },
    product: {
      id: "asset-1",
      productName: "Creator Kit",
      assetType: "INDIVIDUAL_PRODUCT_SKU",
      skuCode: "KIT-1",
      imageUrl: "https://assets.example/kit.png",
    },
    brandProfile: { id: "brand-1", name: "Example Brand" },
    creatorUser: {
      id: "creator-1",
      name: "Creator Name",
      email: "creator@example.com",
      creatorProfile: {
        displayName: "Creator Display",
        instagramHandle: "creatorhandle",
      },
    },
    commercials: null,
    logistics: null,
    finalization: null,
    media: [],
    snapshot: {
      id: "snapshot-1",
      collaborationId: "collaboration-1",
      campaignContext: { name: "Launch" },
      campaignAssetContext: { productName: "Creator Kit" },
      briefContext: { internalTitle: "Launch brief" },
      applicationContext: { proposedFee: 1000 },
      creatorContext: { id: "creator-1" },
      brandContext: { id: "brand-1" },
      usageRights: { duration: "12 months" },
      creatorRequirements: "One reel",
      receivesBrandSupport: true,
      brandSupportType: "PRODUCT",
      brandSupportEstimatedValue: new Decimal(200),
      campaignCommercialContext: { compensationType: "NEGOTIABLE" },
      advancePercentageSnapshot: 40,
      commercialCurrency: "USD",
      lockedAt: new Date("2026-08-10T08:00:00.000Z"),
    },
    commercialAgreement: {
      id: "agreement-1",
      collaborationId: "collaboration-1",
      negotiationState: CollaborationNegotiationState.AWAITING_BRAND_DECISION,
      applicationProposedFee: new Decimal(1000),
      brandCounterFee: null,
      agreedCreatorFee: null,
      currency: "USD",
      advancePercentageSnapshot: 40,
      advanceAmount: null,
      balanceAmount: null,
      nonCashConsideration: { product: "Creator Kit" },
      paymentRail: CollaborationPaymentRail.PLATFORM_ESCROW,
      securementState: null,
      requiredSecuredAmount: null,
      confirmedSecuredAmount: null,
      termsLockedAt: null,
    },
    fulfillment: {
      id: "fulfillment-1",
      collaborationId: "collaboration-1",
      state: CollaborationFulfillmentState.NOT_STARTED,
      issueCount: 0,
      createdAt: new Date("2026-08-10T08:00:00.000Z"),
      updatedAt: new Date("2026-08-10T08:00:00.000Z"),
    },
    deliverables: [
      {
        id: "deliverable-execution-1",
        collaborationId: "collaboration-1",
        sourceBriefDeliverableId: "brief-deliverable-1",
        displayOrder: 1,
        definitionSnapshot: { format: "REEL" },
        state: CollaborationDeliverableState.AWAITING_SUBMISSION,
        revisionRequestCount: 0,
        publishingRequired: true,
        createdAt: new Date("2026-08-10T08:00:00.000Z"),
        updatedAt: new Date("2026-08-10T08:00:00.000Z"),
        publishing: {
          id: "publishing-1",
          deliverableExecutionId: "deliverable-execution-1",
          state: CollaborationPublishingState.AWAITING_PUBLISHING,
          authorizationState:
            CollaborationPublicationAuthorizationState.NOT_AUTHORIZED,
          createdAt: new Date("2026-08-10T08:00:00.000Z"),
          updatedAt: new Date("2026-08-10T08:00:00.000Z"),
        },
      },
    ],
    ...overrides,
  } as unknown as CollaborationReadSource;
}

test("projects canonical Brand and Creator inbox rows with actor-specific counterpart and unread state", () => {
  const row = canonicalRow();
  const brand = projectCanonicalCollaborationThreadRow(row, "BRAND");
  const creator = projectCanonicalCollaborationThreadRow(row, "CREATOR");

  assert.equal(brand.counterpart.kind, "CREATOR");
  assert.equal(brand.counterpart.id, "creator-1");
  assert.equal(brand.inbox.unreadCount, 4);
  assert.equal(creator.counterpart.kind, "BRAND");
  assert.equal(creator.counterpart.id, "brand-1");
  assert.equal(creator.inbox.unreadCount, 2);
  assert.deepEqual(brand.workflow.availableActions, [
    "PostCollaborationMessage",
  ]);
  assert.deepEqual(creator.workflow.availableActions, [
    "PostCollaborationMessage",
  ]);
});

test("canonical fields override contradictory legacy workflow fields", () => {
  const projected = projectCanonicalCollaborationThreadRow(
    canonicalRow(),
    "BRAND",
  );

  assert.equal(projected.projectionSource, "CANONICAL");
  assert.equal(projected.lifecycle, CollaborationLifecycle.ACTIVE);
  assert.equal(projected.workflow.stage, CollaborationStage.NEGOTIATION);
  assert.equal(projected.workflow.status, CollaborationStageStatus.IN_PROGRESS);
  assert.equal(projected.workflow.actionRequiredBy, "BRAND");
  assert.equal(projected.legacyCompatibility, null);
});

test("actionRequiredBy follows canonical negotiable actor state without advertising future commands", () => {
  const row = canonicalRow({
    commercialAgreement: {
      ...canonicalRow().commercialAgreement,
      negotiationState: CollaborationNegotiationState.AWAITING_CREATOR_DECISION,
    },
  });
  const brand = projectCanonicalCollaborationThreadRow(row, "BRAND");
  const creator = projectCanonicalCollaborationThreadRow(row, "CREATOR");

  assert.equal(brand.workflow.actionRequiredBy, "CREATOR");
  assert.equal(creator.workflow.actionRequiredBy, "CREATOR");
  assert.deepEqual(brand.workflow.availableActions, [
    "PostCollaborationMessage",
  ]);
  assert.deepEqual(creator.workflow.availableActions, [
    "PostCollaborationMessage",
  ]);
  assert.ok(
    !brand.workflow.availableActions.includes("AcceptBrandCounter" as never),
  );
});

test("detail reconstructs Application identity, locked context, commercials, Deliverables and publishing", () => {
  const detail = projectCanonicalCollaborationDetail(canonicalRow(), "CREATOR");

  assert.equal(detail.identity.sourceApplicationId, "application-1");
  assert.equal(
    detail.sourceContext.executionSnapshot?.lockedAt,
    "2026-08-10T08:00:00.000Z",
  );
  assert.equal(detail.commercial?.applicationProposedFee, 1000);
  assert.equal(detail.commercial?.advancePercentage, 40);
  assert.equal(detail.securement?.paymentRail, "PLATFORM_ESCROW");
  assert.equal(
    detail.deliverables[0].deliverableExecutionId,
    "deliverable-execution-1",
  );
  assert.equal(detail.deliverables[0].publishingRequired, true);
  assert.deepEqual(detail.deliverables[0].submissionVersions, []);
  assert.equal(detail.publishing[0].state, "AWAITING_PUBLISHING");
  assert.equal(detail.settlement, null);
  assert.equal(detail.resolution, null);
});

test("fixed commercial terms project locked amounts and securement without fixed 30/70 semantics", () => {
  const row = canonicalRow({
    canonicalStage: CollaborationStage.SECUREMENT,
    commercialAgreement: {
      ...canonicalRow().commercialAgreement,
      negotiationState: CollaborationNegotiationState.NOT_REQUIRED,
      agreedCreatorFee: new Decimal(1000),
      advanceAmount: new Decimal(400),
      balanceAmount: new Decimal(600),
      securementState: CollaborationSecurementState.AWAITING_ESCROW_FUNDING,
      requiredSecuredAmount: new Decimal(1000),
      confirmedSecuredAmount: new Decimal(0),
      termsLockedAt: new Date("2026-08-10T08:00:00.000Z"),
    },
  });
  const detail = projectCanonicalCollaborationDetail(row, "BRAND");

  assert.equal(detail.workflow.actionRequiredBy, "BRAND");
  assert.equal(detail.commercial?.agreedCreatorFee, 1000);
  assert.equal(detail.commercial?.advanceAmount, 400);
  assert.equal(detail.commercial?.balanceAmount, 600);
  assert.equal(detail.securement?.requiredSecuredAmount, 1000);
  assert.ok(!("advance30Amount" in (detail.commercial ?? {})));
});

test("terminal lifecycle remains distinct and readable", () => {
  for (const lifecycle of [
    CollaborationLifecycle.PAUSED,
    CollaborationLifecycle.COMPLETED,
    CollaborationLifecycle.CANCELLED,
    CollaborationLifecycle.TERMINATED,
  ]) {
    const projected = projectCanonicalCollaborationDetail(
      canonicalRow({ lifecycle }),
      "BRAND",
    );
    assert.equal(projected.lifecycle.state, lifecycle);
    assert.equal(projected.workflow.actionRequiredBy, "NONE");
    assert.equal(projected.identity.collaborationId, "collaboration-1");
  }
});

test("legacy fallback is explicit and does not expose legacy commercial/media records as canonical truth", () => {
  const row = canonicalRow({
    sourceApplicationId: null,
    snapshot: null,
    commercialAgreement: null,
    fulfillment: null,
    deliverables: [],
    isPaused: false,
    isTerminated: true,
    currentStage: UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
  });
  const detail = projectCanonicalCollaborationDetail(row, "CREATOR");

  assert.equal(detail.projectionSource, "LEGACY_COMPATIBILITY");
  assert.equal(detail.lifecycle.state, CollaborationLifecycle.TERMINATED);
  assert.equal(detail.workflow.stage, CollaborationStage.PRODUCTION);
  assert.equal(detail.commercial, null);
  assert.deepEqual(detail.deliverables, []);
  assert.equal(
    detail.legacyCompatibility?.reason,
    "MISSING_SOURCE_APPLICATION",
  );
});

test("HTTP projector reconstruction has no socket or realtime input", () => {
  const first = projectCanonicalCollaborationDetail(canonicalRow(), "BRAND");
  const reentered = projectCanonicalCollaborationDetail(
    canonicalRow(),
    "BRAND",
  );
  assert.deepEqual(reentered, first);
});
