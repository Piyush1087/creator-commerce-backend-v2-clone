import assert from "node:assert/strict";
import test from "node:test";

import {
  CollaborationActorClass,
  CollaborationDeliverableState,
  CollaborationLifecycle,
  CollaborationPublicationAuthorizationState,
  CollaborationPublishingState,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import {
  authorizePublishingSchema,
  blockPublishingComplianceSchema,
  submitPublishingEvidenceSchema,
  verifyPublishingSchema,
} from "../schemas/collaboration-publishing-command.schema";
import { resolveBrandDeclinedPublicationFinancialOutcome } from "../utils/collaboration-financial-resolution.policy";
import {
  deriveActionRequiredBy,
  deriveAvailableActions,
} from "../utils/collaboration-thread.mapper";
import { CollaborationPublishingService } from "./collaboration-publishing.service";

const collaborationId = "10000000-0000-4000-8000-000000000001";
const deliverableAId = "20000000-0000-4000-8000-000000000001";
const deliverableBId = "20000000-0000-4000-8000-000000000002";
const evidenceAId = "30000000-0000-4000-8000-000000000001";
const brand = { id: "brand-1", role: UserRole.BRAND } as any;
const creator = { id: "creator-1", role: UserRole.CREATOR } as any;
const d = (value: number) => new Prisma.Decimal(value);

function clone<T>(value: T): T {
  if (value instanceof Date) return new Date(value) as T;
  if (Prisma.Decimal.isDecimal(value))
    return new Prisma.Decimal(value.toString()) as T;
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)]),
    ) as T;
  }
  return value;
}

function publishingDeliverable(
  id: string,
  options: {
    production?: CollaborationDeliverableState;
    required?: boolean;
    authorization?: CollaborationPublicationAuthorizationState;
    state?: CollaborationPublishingState;
  } = {},
) {
  const required = options.required ?? true;
  return {
    id,
    collaborationId,
    sourceBriefDeliverableId: `source:${id}`,
    displayOrder: id === deliverableAId ? 1 : 2,
    definitionSnapshot: { format: "provider-neutral" },
    state: options.production ?? CollaborationDeliverableState.AUTO_APPROVED,
    revisionRequestCount: 0,
    publishingRequired: required,
    approvedAt: null,
    autoApprovedAt: new Date("2026-08-13T09:00:00.000Z"),
    hardStoppedAt: null,
    submissions: [],
    publishing: {
      id: `publishing:${id}`,
      deliverableExecutionId: id,
      state:
        options.state ??
        (required
          ? CollaborationPublishingState.AWAITING_PUBLISHING
          : CollaborationPublishingState.PUBLISHING_NOT_REQUIRED),
      authorizationState:
        options.authorization ??
        (required
          ? CollaborationPublicationAuthorizationState.NOT_AUTHORIZED
          : CollaborationPublicationAuthorizationState.NOT_REQUIRED),
      authorizedAt: null,
      authorizedByUserId: null,
      complianceVerifiedAt: null,
      blockedReason: null,
      evidenceHistory: [] as any[],
    },
  };
}

function harness(options: { failEvent?: boolean } = {}) {
  const row: any = {
    id: collaborationId,
    sourceApplicationId: "application-1",
    lifecycle: CollaborationLifecycle.ACTIVE,
    canonicalStage: CollaborationStage.PUBLISHING_SETTLEMENT,
    currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
    currentStage: "STAGE_5_PUBLISHING",
    aggregateVersion: 1,
    isPaused: false,
    deliverables: [
      publishingDeliverable(deliverableAId),
      publishingDeliverable(deliverableBId, { required: false }),
    ],
    commercialAgreement: {
      agreedCreatorFee: d(10_000),
      advancePercentageSnapshot: 40,
      advanceAmount: d(4_000),
      currency: "INR",
      platformCommissionRateSnapshot: d(7),
      platformCommissionAmount: d(700),
      platformCommissionGstRateSnapshot: d(18),
      platformCommissionGstAmount: d(126),
    },
    financialResolution: null,
  };
  const events: any[] = [];
  let evidenceSequence = 1;
  const tx: any = {
    collaboration: {
      findUniqueOrThrow: async () => row,
      updateMany: async ({ where, data }: any) => {
        if (row.aggregateVersion !== where.aggregateVersion)
          return { count: 0 };
        Object.assign(row, data);
        row.aggregateVersion = where.aggregateVersion + 1;
        return { count: 1 };
      },
    },
    collaborationEvent: {
      findFirst: async ({ where }: any) =>
        events.find((event) => event.commandId === where.commandId) ?? null,
      create: async ({ data }: any) => {
        if (options.failEvent) throw new Error("forced event failure");
        events.push(data);
        return data;
      },
    },
    collaborationPublishingExecution: {
      update: async ({ where, data }: any) => {
        const item = row.deliverables.find(
          (value: any) => value.publishing.id === where.id,
        );
        Object.assign(item.publishing, data);
        return item.publishing;
      },
    },
    collaborationPublishingEvidence: {
      create: async ({ data }: any) => {
        const item = row.deliverables.find(
          (value: any) => value.publishing.id === data.publishingExecutionId,
        );
        const evidence = {
          id:
            evidenceSequence === 1
              ? evidenceAId
              : `30000000-0000-4000-8000-${String(evidenceSequence).padStart(12, "0")}`,
          ...data,
        };
        evidenceSequence += 1;
        item.publishing.evidenceHistory.push(evidence);
        return evidence;
      },
      update: async ({ where, data }: any) => {
        const evidence = row.deliverables
          .flatMap((item: any) => item.publishing.evidenceHistory)
          .find((item: any) => item.id === where.id);
        Object.assign(evidence, data);
        return evidence;
      },
    },
    collaborationFinancialResolution: {
      upsert: async ({ create }: any) => {
        row.financialResolution = create;
        return create;
      },
    },
  };
  const prisma: any = {
    $transaction: async (callback: any) => {
      const snapshot = clone(row);
      const eventSnapshot = clone(events);
      try {
        return await callback(tx);
      } catch (error) {
        for (const key of Object.keys(row)) delete row[key];
        Object.assign(row, snapshot);
        events.splice(0, events.length, ...eventSnapshot);
        throw error;
      }
    },
  };
  const service = new CollaborationPublishingService(
    prisma,
    { assertThreadForUser: async () => row } as any,
    { broadcast: async () => undefined } as any,
  );
  (service as any).result = async () => row;
  return { service, row, events };
}

const command = (commandId: string, version: number, extra = {}) => ({
  commandId,
  expectedAggregateVersion: version,
  deliverableExecutionId: deliverableAId,
  ...extra,
});

test("Publishing schemas require exact identities and reject backend-owned state", () => {
  assert.ok(
    authorizePublishingSchema.safeParse(command("authorize", 1)).success,
  );
  assert.ok(
    !authorizePublishingSchema.safeParse({
      ...command("authorize", 1),
      authorizationState: "AUTHORIZED",
    }).success,
  );
  assert.ok(
    submitPublishingEvidenceSchema.safeParse({
      ...command("evidence", 1),
      evidenceRef: "ipfs://provider-neutral-reference",
    }).success,
  );
  assert.ok(!verifyPublishingSchema.safeParse(command("verify", 1)).success);
  assert.ok(
    blockPublishingComplianceSchema.safeParse({
      ...command("block", 1),
      collaborationId,
      blockedReason: "External compliance review required",
    }).success,
  );
});

test("auto-approved Deliverable requires Brand authorization before provider-neutral evidence", async () => {
  const h = harness();
  await assert.rejects(() =>
    h.service.submitEvidence(creator, collaborationId, {
      ...command("too-early", 1),
      evidenceRef: "https://independent.example/post/1",
    }),
  );
  await h.service.authorize(brand, collaborationId, command("authorize", 1));
  assert.equal(
    h.row.deliverables[0].publishing.authorizationState,
    "AUTHORIZED",
  );
  assert.equal(h.row.deliverables[0].publishing.authorizedByUserId, brand.id);
  await h.service.submitEvidence(creator, collaborationId, {
    ...command("evidence", 2),
    evidenceRef: "https://independent.example/post/1",
    platform: "IndependentNetwork",
    evidenceMetadata: { postId: "one" },
  });
  assert.equal(h.row.deliverables[0].publishing.state, "EVIDENCE_SUBMITTED");
  assert.equal(h.row.deliverables[0].publishing.evidenceHistory.length, 1);
  assert.equal(
    h.row.deliverables[0].publishing.evidenceHistory[0].evidenceRef,
    "https://independent.example/post/1",
  );
  assert.equal((h.row as any).finalization?.livePostUrl, undefined);
});

test("correction appends evidence history and exact active evidence verification is settlement-passive", async () => {
  const h = harness();
  await h.service.authorize(brand, collaborationId, command("authorize", 1));
  await h.service.submitEvidence(creator, collaborationId, {
    ...command("evidence-v1", 2),
    evidenceRef: "evidence:v1",
  });
  await h.service.requestCorrection(brand, collaborationId, {
    ...command("correction", 3),
    publishingEvidenceId: evidenceAId,
    correctionReason: "Disclosure must be more prominent",
  });
  assert.equal(h.row.deliverables[0].publishing.state, "CORRECTION_REQUIRED");
  await h.service.submitCorrectedEvidence(creator, collaborationId, {
    ...command("evidence-v2", 4),
    evidenceRef: "evidence:v2",
  });
  const history = h.row.deliverables[0].publishing.evidenceHistory;
  assert.equal(history.length, 2);
  assert.equal(
    history[0].correctionReason,
    "Disclosure must be more prominent",
  );
  assert.equal(history[0].evidenceRef, "evidence:v1");
  await assert.rejects(() =>
    h.service.verify(brand, collaborationId, {
      ...command("stale-verify", 5),
      publishingEvidenceId: evidenceAId,
    }),
  );
  await h.service.verify(brand, collaborationId, {
    ...command("verify", 5),
    publishingEvidenceId: history[1].id,
    complianceEvidenceRef: "compliance:brand-check",
  });
  assert.equal(h.row.deliverables[0].publishing.state, "COMPLIANCE_VERIFIED");
  assert.equal(h.row.lifecycle, CollaborationLifecycle.ACTIVE);
  assert.equal(h.row.canonicalStage, CollaborationStage.PUBLISHING_SETTLEMENT);
  assert.equal(h.row.financialResolution, null);
  assert.equal((h.row as any).escrowStatus, undefined);
  assert.equal(h.events.at(-1).payload.settlementEligible, true);
});

test("evidence replay and review races cannot duplicate or resolve twice", async () => {
  const h = harness();
  await h.service.authorize(brand, collaborationId, command("authorize", 1));
  const evidenceCommand = {
    ...command("evidence", 2),
    evidenceRef: "evidence:once",
  };
  await h.service.submitEvidence(creator, collaborationId, evidenceCommand);
  await h.service.submitEvidence(creator, collaborationId, evidenceCommand);
  assert.equal(h.row.deliverables[0].publishing.evidenceHistory.length, 1);
  assert.equal(
    h.events.filter((event) => event.commandId === "evidence").length,
    1,
  );
  await h.service.verify(brand, collaborationId, {
    ...command("verify", 3),
    publishingEvidenceId: evidenceAId,
  });
  await assert.rejects(() =>
    h.service.requestCorrection(brand, collaborationId, {
      ...command("losing-correction", 3),
      publishingEvidenceId: evidenceAId,
      correctionReason: "Concurrent losing decision",
    }),
  );
  assert.equal(h.row.deliverables[0].publishing.state, "COMPLIANCE_VERIFIED");
});

test("DeclinePublishing is Brand-attributed but SYSTEM-decided protected-Advance resolution", async () => {
  const h = harness();
  await h.service.decline(brand, collaborationId, command("decline", 1));
  assert.equal(h.row.lifecycle, CollaborationLifecycle.TERMINATED);
  assert.notEqual(h.row.lifecycle, CollaborationLifecycle.PAUSED);
  assert.equal(h.row.endedFromStage, CollaborationStage.PUBLISHING_SETTLEMENT);
  assert.equal(h.row.endedReasonCode, "BRAND_DECLINED_PUBLICATION");
  assert.equal(h.row.endedByActorClass, CollaborationActorClass.BRAND);
  assert.equal(h.row.endedByUserId, brand.id);
  assert.equal(
    h.row.financialResolution.outcome,
    "BRAND_PROTECTED_POST_SECUREMENT_EXIT",
  );
  assert.equal(h.row.financialResolution.decidedByActorClass, "SYSTEM");
  assert.equal(
    h.row.financialResolution.creatorGrossEntitlementAmount.toNumber(),
    4_000,
  );
  assert.equal(
    h.row.financialResolution.platformCommissionRetainedAmount.toNumber(),
    280,
  );
  assert.equal(
    h.row.financialResolution.platformCommissionGstRetainedAmount.toNumber(),
    50.4,
  );
  assert.equal(
    h.row.financialResolution.brandCommercialRefundEntitlementAmount.toNumber(),
    6_495.6,
  );
  assert.equal(h.events[0].actorClass, "BRAND");
  assert.ok(!("gatewayProcessingCharge" in h.row.financialResolution));
  assert.ok(!("tds" in h.row.financialResolution));
  assert.equal((h.row as any).payoutExecution, undefined);
});

test("DeclinePublishing is atomic and authorize/decline race has one winner", async () => {
  const rollback = harness({ failEvent: true });
  await assert.rejects(
    () =>
      rollback.service.decline(brand, collaborationId, command("decline", 1)),
    /forced event failure/,
  );
  assert.equal(rollback.row.lifecycle, CollaborationLifecycle.ACTIVE);
  assert.equal(rollback.row.financialResolution, null);
  assert.equal(rollback.row.aggregateVersion, 1);

  const race = harness();
  await race.service.authorize(brand, collaborationId, command("winner", 1));
  await assert.rejects(() =>
    race.service.decline(brand, collaborationId, command("loser", 1)),
  );
  assert.equal(race.row.lifecycle, CollaborationLifecycle.ACTIVE);
  assert.equal(race.row.financialResolution, null);
});

test("trusted block is non-terminal, non-financial, SYSTEM-attributed and hidden from users", async () => {
  const h = harness();
  await h.service.blockCompliance({
    ...command("block", 1),
    collaborationId,
    blockedReason: "External compliance review required",
    evidenceRef: "audit:reference",
  });
  assert.equal(h.row.deliverables[0].publishing.state, "BLOCKED");
  assert.equal(h.row.currentStageStatus, CollaborationStageStatus.BLOCKED);
  assert.equal(h.row.lifecycle, CollaborationLifecycle.ACTIVE);
  assert.equal(h.row.financialResolution, null);
  assert.equal(h.events[0].actorClass, CollaborationActorClass.SYSTEM);
  assert.ok(
    !deriveAvailableActions(h.row, "BRAND").some(
      (action) => (action as string) === "BlockPublishingCompliance",
    ),
  );
});

test("read ownership and actions remain per-Deliverable with no Settlement command", () => {
  const h = harness();
  const target = h.row.deliverables[0];
  target.publishing.authorizationState =
    CollaborationPublicationAuthorizationState.AUTHORIZED;
  assert.equal(deriveActionRequiredBy(h.row), "CREATOR");
  assert.ok(
    deriveAvailableActions(h.row, "CREATOR").includes(
      "SubmitPublishingEvidence",
    ),
  );
  target.publishing.state = CollaborationPublishingState.COMPLIANCE_VERIFIED;
  target.publishing.complianceVerifiedAt = new Date("2026-08-14T09:00:00.000Z");
  assert.equal(deriveActionRequiredBy(h.row), "NONE");
  assert.ok(
    !deriveAvailableActions(h.row, "BRAND").some((action) =>
      (action as string).includes("Settlement"),
    ),
  );
});

test("financial helper uses configurable locked Advance and shared proportional decomposition", () => {
  const result = resolveBrandDeclinedPublicationFinancialOutcome({
    agreedCreatorFee: d(20_000),
    advanceAmount: d(5_000),
    currency: "INR",
    platformCommissionRateSnapshot: d(7),
    platformCommissionAmount: d(1_400),
    platformCommissionGstRateSnapshot: d(18),
    platformCommissionGstAmount: d(252),
  });
  assert.equal(result.creatorGrossEntitlementAmount.toNumber(), 5_000);
  assert.equal(result.platformCommissionRetainedAmount.toNumber(), 350);
  assert.equal(result.platformCommissionGstRetainedAmount.toNumber(), 63);
  assert.equal(
    result.brandCommercialRefundEntitlementAmount.toNumber(),
    16_239,
  );
});
