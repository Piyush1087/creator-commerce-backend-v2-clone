import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  applicationHarness,
  brandFixture,
  campaignFixture,
} from "../../../../test/fixtures/c03-application-fixtures";
import type { portfolioTestOwner } from "./portfolio.fixture";
/** Disposable fixture only: canonical application approval provisions C04;
 * terminal completed/published/UGC records then seed this read-adapter test.
 * No Portfolio production writer participates in C04 lifecycle. */
export async function portfolioC04Fixture(
  db: PrismaClient,
  owner: Awaited<ReturnType<typeof portfolioTestOwner>>,
  destination = "https://www.instagram.com/p/media-0/",
  publishingRequired = true,
) {
  await db.creatorProfile.update({
    where: { id: owner.profile.id },
    data: { followerCount: 12000 },
  });
  const h = applicationHarness(db),
    brand = await brandFixture(db),
    campaign = await campaignFixture(db, brand.brand.id, 1);
  const application = await h.submit.submit(
    owner.owner.auth,
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
  const collaboration = await db.collaboration.update({
    where: { sourceApplicationId: application.applicationId },
    data: {
      lifecycle: "COMPLETED",
      completedAt: new Date(),
      canonicalStage: "PUBLISHING_SETTLEMENT",
    },
  });
  const brief = await db.canonicalBriefDeliverable.findFirstOrThrow({
    where: { briefId: campaign.briefs[0].id },
    orderBy: { displayOrder: "asc" },
  });
  const execution = await db.collaborationDeliverableExecution.update({
    where: {
      collaborationId_sourceBriefDeliverableId: {
        collaborationId: collaboration.id,
        sourceBriefDeliverableId: brief.id,
      },
    },
    select: { id: true, collaborationId: true },
    data: {
      state: "APPROVED",
      publishingRequired,
      approvedAt: new Date(),
    },
  });
  if (publishingRequired) {
    const publishing = await db.collaborationPublishingExecution.upsert({
      where: { deliverableExecutionId: execution.id },
      update: {
        state: "COMPLIANCE_VERIFIED",
        authorizationState: "AUTHORIZED",
        authorizedAt: new Date(),
        complianceVerifiedAt: new Date(),
      },
      create: {
        deliverableExecutionId: execution.id,
        state: "COMPLIANCE_VERIFIED",
        authorizationState: "AUTHORIZED",
        authorizedAt: new Date(),
        complianceVerifiedAt: new Date(),
      },
    });
    const evidence = await db.collaborationPublishingEvidence.create({
      data: {
        publishingExecutionId: publishing.id,
        sequence: 1,
        evidenceRef: destination,
        platform: "INSTAGRAM",
        submittedByUserId: owner.actor.actorUserId,
        verifiedAt: new Date(),
      },
    });
    return { collaboration, execution, evidence };
  }
  const evidence = await db.collaborationSubmissionVersion.create({
    data: {
      deliverableExecutionId: execution.id,
      versionNumber: 1,
      assetRef: destination,
      submittedByUserId: owner.actor.actorUserId,
      reviewDeadlineAt: new Date(),
      reviewState: "APPROVED",
      reviewedAt: new Date(),
    },
  });
  return { collaboration, execution, evidence };
}
