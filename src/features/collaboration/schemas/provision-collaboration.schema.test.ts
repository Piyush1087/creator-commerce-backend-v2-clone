import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  CollaborationEventKind,
  CollaborationFulfillmentState,
  CollaborationNegotiationState,
  CollaborationPublishingState,
  CollaborationSecurementState,
  UceCompensationType,
} from "@prisma/client";

import { resolveProvisioningNegotiationState } from "../utils/collaboration-provisioning-initialization";
import { provisionCollaborationSchema } from "./provision-collaboration.schema";

const applicationId = "11111111-1111-4111-8111-111111111111";
const deliverableId = "22222222-2222-4222-8222-222222222222";

test("requires explicit publishing applicability", () => {
  assert.equal(
    provisionCollaborationSchema.safeParse({
      sourceApplicationId: applicationId,
      deliverablePublishingApplicability: [],
    }).success,
    false,
  );
});

test("requires publishingRequired instead of defaulting it", () => {
  assert.equal(
    provisionCollaborationSchema.safeParse({
      sourceApplicationId: applicationId,
      deliverablePublishingApplicability: [
        { sourceBriefDeliverableId: deliverableId },
      ],
    }).success,
    false,
  );
});

test("rejects duplicate source Deliverable resolutions", () => {
  assert.equal(
    provisionCollaborationSchema.safeParse({
      sourceApplicationId: applicationId,
      deliverablePublishingApplicability: [
        { sourceBriefDeliverableId: deliverableId, publishingRequired: true },
        { sourceBriefDeliverableId: deliverableId, publishingRequired: false },
      ],
    }).success,
    false,
  );
});

test("rejects backend-owned workflow fields", () => {
  assert.equal(
    provisionCollaborationSchema.safeParse({
      sourceApplicationId: applicationId,
      deliverablePublishingApplicability: [
        { sourceBriefDeliverableId: deliverableId, publishingRequired: true },
      ],
      lifecycle: "COMPLETED",
    }).success,
    false,
  );
});

test("Prisma identity is Application-based and publishingRequired has no default", () => {
  const schema = readFileSync(
    join(process.cwd(), "prisma", "schema.prisma"),
    "utf8",
  );
  const collaborationModel = schema.match(
    /model Collaboration \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(collaborationModel);
  assert.match(collaborationModel, /sourceApplicationId String\? @unique/);
  assert.doesNotMatch(
    collaborationModel,
    /@@unique\(\[campaignId, creatorUserId\]\)/,
  );
  assert.match(
    schema,
    /publishingRequired Boolean @map\("publishing_required"\)/,
  );
});

test("uses the frozen canonical Collaboration enum vocabulary", () => {
  assert.deepEqual(Object.values(CollaborationNegotiationState), [
    "NOT_REQUIRED",
    "AWAITING_BRAND_DECISION",
    "AWAITING_CREATOR_DECISION",
    "LOCKED",
    "FAILED",
  ]);
  assert.deepEqual(Object.values(CollaborationSecurementState), [
    "NOT_REQUIRED",
    "AWAITING_ESCROW_FUNDING",
    "PROCESSING_FUNDING",
    "AWAITING_PAYOUT_DETAILS",
    "AWAITING_BRAND_PAYMENT",
    "AWAITING_CREATOR_CONFIRMATION",
    "PAYMENT_DISPUTED",
    "COMPLETED",
    "BLOCKED",
  ]);
  assert.ok(Object.values(CollaborationFulfillmentState).includes("HARD_STOP"));
  assert.ok(Object.values(CollaborationFulfillmentState).includes("SKIPPED"));
  assert.ok(
    Object.values(CollaborationPublishingState).includes("COMPLIANCE_VERIFIED"),
  );
  assert.deepEqual(Object.values(CollaborationEventKind), [
    "DOMAIN",
    "AUDIT",
    "INTEGRATION",
  ]);
});

test("does not impose Collaboration product policy on Campaign advance percentages", () => {
  const schema = readFileSync(
    join(
      process.cwd(),
      "src/features/collaboration/services/collaboration-provision.service.ts",
    ),
    "utf8",
  );

  assert.match(schema, /Number\.isInteger\(advancePercentage\)/);
  assert.match(schema, /advancePercentage < 0/);
  assert.match(schema, /advancePercentage > 100/);
  assert.doesNotMatch(schema, /\[0,\s*25,\s*50,\s*75,\s*100\]/);
  assert.doesNotMatch(schema, /UceAdvancePaymentPercentageSchema/);
});

test("skips Negotiation for fixed compensation and waits for Brand on negotiable", () => {
  assert.equal(
    resolveProvisioningNegotiationState(UceCompensationType.FIXED_FEE),
    CollaborationNegotiationState.NOT_REQUIRED,
  );
  assert.equal(
    resolveProvisioningNegotiationState(UceCompensationType.NEGOTIABLE),
    CollaborationNegotiationState.AWAITING_BRAND_DECISION,
  );
});

test("does not retain generated pnpm workspace configuration", () => {
  assert.equal(existsSync(join(process.cwd(), "pnpm-workspace.yaml")), false);
});
