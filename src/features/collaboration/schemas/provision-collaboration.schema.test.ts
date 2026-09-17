import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "vitest";
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
const ACTIVE_SECUREMENT_STATES = [
  "NOT_REQUIRED",
  "AWAITING_ESCROW_FUNDING",
  "PROCESSING_FUNDING",
  "AWAITING_PAYOUT_DETAILS",
  "COMPLETED",
  "BLOCKED",
] as const;
const LEGACY_SECUREMENT_STATES = [
  "AWAITING_BRAND_PAYMENT",
  "AWAITING_CREATOR_CONFIRMATION",
  "PAYMENT_DISPUTED",
] as const;

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
  assert.match(collaborationModel, /sourceApplicationId\s+String\?\s+@unique/);
  assert.doesNotMatch(
    collaborationModel,
    /@@unique\(\[campaignId, creatorUserId\]\)/,
  );
  assert.match(
    schema,
    /publishingRequired\s+Boolean\s+@map\("publishing_required"\)/,
  );
});

test("distinguishes active C04 securement vocabulary from legacy compatibility", () => {
  assert.deepEqual(Object.values(CollaborationNegotiationState), [
    "NOT_REQUIRED",
    "AWAITING_CREATOR_PROPOSAL",
    "AWAITING_BRAND_DECISION",
    "AWAITING_CREATOR_DECISION",
    "LOCKED",
    "FAILED",
  ]);
  assert.deepEqual(Object.values(CollaborationSecurementState), [
    ...ACTIVE_SECUREMENT_STATES,
    ...LEGACY_SECUREMENT_STATES,
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

test("active C04 commands cannot emit legacy securement or provider-payment authority", () => {
  const activeSources = [
    "src/features/collaboration/services/collaboration-provision.service.ts",
    "src/features/collaboration/services/collaboration-negotiation.service.ts",
    "src/features/collaboration/services/collaboration-securement.service.ts",
  ].map((path) => readFileSync(join(process.cwd(), path), "utf8"));
  for (const source of activeSources) {
    for (const legacy of LEGACY_SECUREMENT_STATES) {
      assert.doesNotMatch(
        source,
        new RegExp(`CollaborationSecurementState\\.${legacy}\\b`, "u"),
      );
    }
  }
  const securement = activeSources[2];
  assert.match(securement, /MANUAL_PAYMENT_DISABLED/u);
  assert.doesNotMatch(
    securement,
    /stripe|adyen|paypal|razorpay|payoutProvider|executePayout/iu,
  );
});

test("does not impose Collaboration product policy on Campaign advance percentages", () => {
  const schema = readFileSync(
    join(
      process.cwd(),
      "src/features/collaboration/services/collaboration-provision.service.ts",
    ),
    "utf8",
  );

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
