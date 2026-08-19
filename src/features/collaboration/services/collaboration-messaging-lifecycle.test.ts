import assert from "node:assert/strict";
import test from "node:test";

import {
  CollaborationLifecycle,
  CollaborationMessageKind,
  CollaborationNegotiationState,
  CollaborationStage,
  CollaborationStageStatus,
  UceMilestoneStage,
  UserRole,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import {
  deriveAvailableActions,
  type CollaborationReadSource,
} from "../utils/collaboration-thread.mapper";
import { CollaborationService } from "./collaboration.service";

const collaborationId = "collaboration-msg-1";

function canonicalRow(
  lifecycle: CollaborationLifecycle,
): CollaborationReadSource {
  return {
    id: collaborationId,
    brandProfileId: "brand-1",
    creatorUserId: "creator-1",
    campaignId: "campaign-1",
    briefId: "brief-1",
    productId: "asset-1",
    ucePipelineCollaborationId: "legacy-pipeline-1",
    sourceApplicationId: "application-1",
    campaignCreatorId: "campaign-creator-1",
    campaignAssetId: "asset-1",
    lifecycle,
    canonicalStage: CollaborationStage.NEGOTIATION,
    currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
    aggregateVersion: 1,
    currentStage: UceMilestoneStage.STAGE_1_NEGOTIATION,
    payoutMode: "ESCROW",
    industry: "D2C_ECOMMERCE",
    negotiationRound: 0,
    fulfillmentIssueCount: 0,
    revisionCount: 0,
    unreadCountBrand: 0,
    unreadCountCreator: 0,
    lastMessageSnippet: "Hello",
    lastMessageAt: new Date("2026-08-10T10:00:00.000Z"),
    stageUpdatedAt: new Date("2026-08-10T09:00:00.000Z"),
    isPaused: false,
    isTerminated: false,
    createdAt: new Date("2026-08-10T08:00:00.000Z"),
    updatedAt: new Date("2026-08-10T10:00:00.000Z"),
    endedFromStage: null,
    endedReasonCode: null,
    endedReasonText: null,
    endedByActorClass: null,
    endedByUserId: null,
    endedAt: null,
    completedAt:
      lifecycle === CollaborationLifecycle.COMPLETED
        ? new Date("2026-08-11T00:00:00.000Z")
        : null,
    campaign: { name: "Launch", brandProfileId: "brand-1" },
    brief: { internalTitle: "Launch brief", creativeGuidelines: "Be clear" },
    product: {
      id: "asset-1",
      productName: "Creator Kit",
      assetType: "INDIVIDUAL_PRODUCT_SKU",
      skuCode: "KIT-1",
      imageUrl: null,
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
    feedbackWindow: null,
    feedback: [],
    media: [],
    snapshot: null,
    commercialAgreement: {
      id: "agreement-1",
      collaborationId,
      negotiationState: CollaborationNegotiationState.AWAITING_BRAND_DECISION,
      applicationProposedFee: new Decimal(1000),
      brandCounterFee: null,
      agreedCreatorFee: null,
      currency: "USD",
      advancePercentageSnapshot: 40,
      advanceAmount: null,
      balanceAmount: null,
      nonCashConsideration: null,
      termsLocked: false,
      lockedAt: null,
    },
    securement: null,
    fulfillment: null,
    deliverables: [],
    settlement: null,
    financialResolution: null,
  } as CollaborationReadSource;
}

test("ACTIVE projects PostCollaborationMessage; non-ACTIVE lifecycles do not", () => {
  assert.ok(
    deriveAvailableActions(
      canonicalRow(CollaborationLifecycle.ACTIVE),
      "BRAND",
    ).includes("PostCollaborationMessage"),
  );
  assert.ok(
    deriveAvailableActions(
      canonicalRow(CollaborationLifecycle.ACTIVE),
      "CREATOR",
    ).includes("PostCollaborationMessage"),
  );
  for (const lifecycle of [
    CollaborationLifecycle.PAUSED,
    CollaborationLifecycle.COMPLETED,
    CollaborationLifecycle.CANCELLED,
    CollaborationLifecycle.TERMINATED,
  ] as const) {
    assert.ok(
      !deriveAvailableActions(canonicalRow(lifecycle), "BRAND").includes(
        "PostCollaborationMessage",
      ),
      `${lifecycle} must not project PostCollaborationMessage for Brand`,
    );
    assert.ok(
      !deriveAvailableActions(canonicalRow(lifecycle), "CREATOR").includes(
        "PostCollaborationMessage",
      ),
      `${lifecycle} must not project PostCollaborationMessage for Creator`,
    );
  }
});

function postMessageHarness(lifecycle: CollaborationLifecycle) {
  const row: any = canonicalRow(lifecycle);
  const messages: any[] = [
    {
      id: "msg-existing",
      collaborationId,
      senderUserId: "creator-1",
      kind: CollaborationMessageKind.USER,
      body: "History remains",
      systemEventTag: null,
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
    },
  ];
  const prisma: any = {
    collaborationMessage: {
      findMany: async () => messages,
      create: async ({ data }: any) => {
        const created = {
          id: `msg-${messages.length + 1}`,
          ...data,
          systemEventTag: null,
          createdAt: new Date(),
        };
        messages.push(created);
        return created;
      },
    },
    collaboration: {
      update: async ({ data }: any) => {
        Object.assign(row, {
          lastMessageSnippet: data.lastMessageSnippet,
          lastMessageAt: data.lastMessageAt,
        });
        return row;
      },
    },
    $transaction: async (fn: any) =>
      fn({
        collaborationMessage: prisma.collaborationMessage,
        collaboration: prisma.collaboration,
      }),
  };
  const access: any = {
    assertThreadForUser: async () => row,
  };
  const realtime: any = { broadcast: async () => undefined };
  const service = new CollaborationService(prisma, access, realtime);
  return { service, row, messages };
}

const brandUser: any = {
  id: "brand-user",
  role: UserRole.BRAND,
  email: "brand@example.com",
  name: "Brand",
  organizationId: "org-1",
};

test("ACTIVE message POST succeeds", async () => {
  const h = postMessageHarness(CollaborationLifecycle.ACTIVE);
  const result = await h.service.postMessage(brandUser, collaborationId, {
    body: "Hello from brand",
  });
  assert.equal(result.body, "Hello from brand");
  assert.equal(h.messages.length, 2);
});

test("direct POST message in non-ACTIVE lifecycle is rejected", async () => {
  for (const lifecycle of [
    CollaborationLifecycle.PAUSED,
    CollaborationLifecycle.COMPLETED,
    CollaborationLifecycle.CANCELLED,
    CollaborationLifecycle.TERMINATED,
  ] as const) {
    const h = postMessageHarness(lifecycle);
    await assert.rejects(
      () =>
        h.service.postMessage(brandUser, collaborationId, {
          body: "Should fail",
        }),
      (error: any) => error?.response?.code === "INVALID_STATE",
    );
    assert.equal(h.messages.length, 1);
  }
});

test("message history reads remain available in terminal lifecycle", async () => {
  const h = postMessageHarness(CollaborationLifecycle.COMPLETED);
  const listed = await h.service.listMessages(brandUser, collaborationId);
  assert.equal(listed.messages.length, 1);
  assert.equal(listed.messages[0].body, "History remains");
});
