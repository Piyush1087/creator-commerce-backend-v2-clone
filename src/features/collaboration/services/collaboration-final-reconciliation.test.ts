import assert from "node:assert/strict";
import { test } from "vitest";

import {
  CollaborationPayoutMode,
  Prisma,
  UceMilestoneStage,
  UserRole,
} from "@prisma/client";

import { CoPilotHitlService } from "../../co-pilot/services/co-pilot-hitl.service";
import { CollaborationService } from "./collaboration.service";

const collaborationId = "10000000-0000-4000-8000-000000000001";
const brand = {
  id: "brand-user",
  email: "brand@example.com",
  role: UserRole.BRAND,
} as any;
const creator = {
  id: "creator-user",
  email: "creator@example.com",
  role: UserRole.CREATOR,
} as any;

function legacyService(sourceApplicationId: string | null) {
  const row: any = {
    id: collaborationId,
    sourceApplicationId,
    campaignId: "campaign-1",
    currentStage: UceMilestoneStage.STAGE_1_NEGOTIATION,
    payoutMode: CollaborationPayoutMode.ESCROW,
    negotiationRound: 0,
    commercials: {
      initialQuote: new Prisma.Decimal(1000),
      brandCounterOffer: null,
      finalQuote: null,
      productRetailValue: new Prisma.Decimal(0),
    },
  };
  let legacyMutationCount = 0;
  const tx: any = {
    collaborationCommercial: {
      update: async () => {
        legacyMutationCount += 1;
      },
    },
    collaboration: { update: async () => undefined },
    collaborationMessage: { create: async () => undefined },
  };
  const prisma: any = {
    uceCampaignCommercials: {
      findUnique: async () => ({ advancePaymentPercentage: 25 }),
    },
    $transaction: async (callback: any) => callback(tx),
  };
  const service = new CollaborationService(
    prisma,
    { assertThreadForUser: async () => row } as any,
    { broadcast: async () => undefined } as any,
    {
      enqueueWithinTransaction: async () => ({ job_id: "job-1" }),
      dispatch: async () => ({ job_id: "job-1" }),
    } as any,
  );
  (service as any).broadcastAndReturnThread = async () => row;
  return { service, getLegacyMutationCount: () => legacyMutationCount };
}

test("leftover commercial mutations fail-close before Prisma", async () => {
  const h = legacyService("application-1");
  const expected = (error: any) =>
    error?.response?.code === "LEGACY_COLLABORATION_AGGREGATE_WRITE_RETIRED";

  await assert.rejects(
    () =>
      h.service.submitCreatorQuote(creator, collaborationId, {
        total_quote: 1000,
      }),
    expected,
  );
  await assert.rejects(
    () =>
      h.service.brandCounterOffer(brand, collaborationId, {
        counter_offer: 900,
      }),
    expected,
  );
  await assert.rejects(
    () => h.service.acceptCommercials(brand, collaborationId, {}),
    expected,
  );
  await assert.rejects(
    () => h.service.fundEscrow(brand, collaborationId, {}),
    expected,
  );
  assert.equal(h.getLegacyMutationCount(), 0);
});

test("leftover compatibility rows also fail-close leftover commercial writes", async () => {
  const h = legacyService(null);
  await assert.rejects(
    () =>
      h.service.brandCounterOffer(brand, collaborationId, {
        counter_offer: 900,
      }),
    (error: any) =>
      error?.response?.code === "LEGACY_COLLABORATION_AGGREGATE_WRITE_RETIRED",
  );
  assert.equal(h.getLegacyMutationCount(), 0);
});

test("Co-Pilot commercial intents are retired and do not dispatch leftover or canonical collab writes", async () => {
  let canonicalCalls = 0;
  let acceptCalls = 0;
  let securementCalls = 0;
  let legacyCalls = 0;
  let currentStage: UceMilestoneStage = UceMilestoneStage.STAGE_1_NEGOTIATION;
  const prisma: any = {
    user: { findUnique: async () => brand },
    collaboration: {
      findUniqueOrThrow: async ({ select }: any) =>
        "aggregateVersion" in select
          ? { sourceApplicationId: "application-1", aggregateVersion: 7 }
          : {
              sourceApplicationId: "application-1",
              canonicalStage: "NEGOTIATION",
              currentStage: UceMilestoneStage.STAGE_1_NEGOTIATION,
              campaign: { name: "Campaign" },
              creatorUser: {
                name: "Creator",
                email: "creator@example.com",
                creatorProfile: null,
              },
            },
    },
  };
  const collaboration: any = {
    getThread: async () => ({
      thread: { currentStage },
    }),
    brandCounterOffer: async () => {
      legacyCalls += 1;
    },
  };
  const negotiation: any = {
    counterOffer: async (_user: any, id: string, command: any) => {
      canonicalCalls += 1;
      assert.equal(id, collaborationId);
      assert.deepEqual(command, {
        commandId: "copilot-command-1",
        expectedAggregateVersion: 7,
        counterFee: 900,
      });
    },
    acceptProposedFee: async () => {
      acceptCalls += 1;
    },
  };
  const securement: any = {
    requestEscrowFunding: async () => {
      securementCalls += 1;
    },
  };
  const hitl = new CoPilotHitlService(
    prisma,
    { clearSession: async () => undefined } as any,
    { persistHitlResolution: async () => undefined } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    collaboration,
    negotiation,
    securement,
    {} as any,
    { rememberSelectedCollaboration: () => undefined } as any,
  );

  await assert.rejects(
    () =>
      (hitl as any).confirmCollabCounterOffer(
        { userId: brand.id, threadId: "thread-1" },
        {
          collaboration_id: collaborationId,
          counter_offer: 900,
          idempotencyKey: "copilot-command-1",
        },
      ),
    (error: any) =>
      error?.response?.code === "OUT_OF_MVP_COMPETING_TRANSITION_RETIRED",
  );
  assert.equal(canonicalCalls, 0);
  assert.equal(acceptCalls, 0);
  assert.equal(securementCalls, 0);
  assert.equal(legacyCalls, 0);
});
