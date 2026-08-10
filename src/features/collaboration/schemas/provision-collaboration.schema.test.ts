import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

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
