import {
  GatekeeperRecoveryRequestType,
  IndustryVertical,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import { GatekeeperPersistenceService } from "./gatekeeper-persistence.service";
import type { GatekeeperPolicyVersionService } from "./gatekeeper-policy-version.service";
import { GatekeeperRecoveryService } from "./gatekeeper-recovery.service";
import {
  GATEKEEPER_RESULT_VERSION,
  type GatekeeperStructuredResult,
} from "./gatekeeper-v1.types";

const databaseEnabled = process.env.GATEKEEPER_DATABASE_TEST === "true";

function result(
  outcome: "ORG_CLAIMED" | "UNSUPPORTED",
): GatekeeperStructuredResult {
  const review = outcome === "UNSUPPORTED";
  return {
    version: GATEKEEPER_RESULT_VERSION,
    submission: {
      normalized_url: `https://${outcome.toLowerCase()}.example/`,
      normalized_domain: `${outcome.toLowerCase()}.example`,
    },
    assessment: review
      ? {
          provisional_industry: IndustryVertical.MEDIA,
          provisional_sub_industry: "Media",
          entity_category: "BRAND",
          english_evidence_status: "SUFFICIENT",
          creator_marketing_applicability: "APPLICABLE",
          commercial_destination_types: ["WEBSITE"],
          assessment_confidence: "HIGH",
        }
      : null,
    decision: {
      outcome,
      reason_code: review
        ? "UNSUPPORTED_INDUSTRY"
        : "ORGANIZATION_ALREADY_CLAIMED",
      recovery_actions: review
        ? ["JOIN_WAITLIST", "REQUEST_CLASSIFICATION_REVIEW"]
        : ["REQUEST_ORG_ACCESS"],
      manual_review_eligible: review,
    },
    confirmation: {
      assessed_industry: review ? IndustryVertical.MEDIA : null,
      confirmed_industry: null,
      confirmation_source: null,
      industry_disagreement_flag: false,
      surface_eligible: false,
    },
    handoff: {
      gatekeeper_completed: true,
      confirmed_industry_required: false,
    },
    execution: {
      primary: "NOT_RUN",
      parallel: "NOT_RUN",
      reassessment: "NOT_RUN",
      openai: "NOT_RUN",
    },
  };
}

describe.skipIf(!databaseEnabled)("Gatekeeper recovery database", () => {
  const prisma = new PrismaClient();
  const organizationId = randomUUID();
  const orgLeadId = randomUUID();
  const reviewLeadId = randomUUID();
  const profileId = randomUUID();
  const persistence = new GatekeeperPersistenceService(
    prisma as unknown as PrismaService,
    {} as GatekeeperPolicyVersionService,
  );
  const service = new GatekeeperRecoveryService(
    prisma as unknown as PrismaService,
    persistence,
  );
  const dto = {
    requesterEmail: "database-requester@example.com",
    authorizedRepresentativeAttested: true as const,
  };

  beforeAll(async () => {
    const orgResult = result("ORG_CLAIMED");
    const reviewResult = result("UNSUPPORTED");
    await prisma.organization.create({
      data: { id: organizationId, name: "Gatekeeper database test" },
    });
    await prisma.brandProfile.create({
      data: {
        id: profileId,
        organizationId,
        domain: orgResult.submission.normalized_domain,
        name: "Gatekeeper database test",
        industry: IndustryVertical.D2C,
        brandValues: [],
        policyFlags: [],
        targetAudience: {},
        isVerified: true,
      },
    });
    await prisma.discoveryLead.createMany({
      data: [
        {
          id: orgLeadId,
          rawUrl: orgResult.submission.normalized_url,
          normalizedUrl: orgResult.submission.normalized_url,
          temporaryPayload: {
            gatekeeper: orgResult,
          } as unknown as Prisma.InputJsonValue,
        },
        {
          id: reviewLeadId,
          rawUrl: reviewResult.submission.normalized_url,
          normalizedUrl: reviewResult.submission.normalized_url,
          temporaryPayload: {
            gatekeeper: reviewResult,
          } as unknown as Prisma.InputJsonValue,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.gatekeeperRecoveryRequest.deleteMany({
      where: { requesterEmail: dto.requesterEmail },
    });
    await prisma.discoveryLead.deleteMany({
      where: { id: { in: [orgLeadId, reviewLeadId] } },
    });
    await prisma.brandProfile.deleteMany({ where: { id: profileId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("persists distinct requests and converges duplicate retries", async () => {
    const first = await service.requestOrganizationAccess(orgLeadId, dto, {
      sessionId: "database-session",
    });
    const retry = await service.requestOrganizationAccess(orgLeadId, dto, {
      sessionId: "database-session",
    });
    const review = await service.requestClassificationReview(
      reviewLeadId,
      dto,
      {},
    );

    expect(retry.request.id).toBe(first.request.id);
    expect(review.request.type).toBe(
      GatekeeperRecoveryRequestType.REQUEST_CLASSIFICATION_REVIEW,
    );
    await expect(
      prisma.gatekeeperRecoveryRequest.count({
        where: {
          discoveryLeadId: { in: [orgLeadId, reviewLeadId] },
        },
      }),
    ).resolves.toBe(2);

    const organizationRequest =
      await prisma.gatekeeperRecoveryRequest.findUniqueOrThrow({
        where: { id: first.request.id },
      });
    expect(organizationRequest.targetOrganizationId).toBe(organizationId);
    expect(organizationRequest.contextVersion).toBe(
      "gatekeeper_recovery_context_v1",
    );
  });
});
