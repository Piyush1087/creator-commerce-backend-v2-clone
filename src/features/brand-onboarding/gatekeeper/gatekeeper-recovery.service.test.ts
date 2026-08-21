import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  GatekeeperRecoveryRequestType,
  IndustryVertical,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { GatekeeperPersistenceService } from "./gatekeeper-persistence.service";
import { GatekeeperRecoveryService } from "./gatekeeper-recovery.service";
import {
  GATEKEEPER_RESULT_VERSION,
  type GatekeeperStructuredResult,
} from "./gatekeeper-v1.types";

function gatekeeper(
  overrides: Partial<GatekeeperStructuredResult["decision"]> = {},
): GatekeeperStructuredResult {
  return {
    version: GATEKEEPER_RESULT_VERSION,
    submission: {
      normalized_url: "https://example.com/",
      normalized_domain: "example.com",
    },
    assessment: {
      provisional_industry: IndustryVertical.UNKNOWN,
      provisional_sub_industry: null,
      entity_category: "UNKNOWN",
      english_evidence_status: "UNCERTAIN",
      creator_marketing_applicability: "UNCERTAIN",
      commercial_destination_types: ["WEBSITE"],
      assessment_confidence: "LOW",
    },
    decision: {
      outcome: "ORG_CLAIMED",
      reason_code: "ORGANIZATION_ALREADY_CLAIMED",
      recovery_actions: ["REQUEST_ORG_ACCESS"],
      manual_review_eligible: false,
      ...overrides,
    },
    confirmation: {
      assessed_industry: IndustryVertical.UNKNOWN,
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

describe("GatekeeperRecoveryService", () => {
  const getGatekeeperResult = vi.fn();
  const findBrandProfile = vi.fn();
  const upsertRecoveryRequest = vi.fn();
  const prisma = {
    brandProfile: { findFirst: findBrandProfile },
    gatekeeperRecoveryRequest: { upsert: upsertRecoveryRequest },
  } as unknown as PrismaService;
  const persistence = {
    getGatekeeperResult,
  } as unknown as GatekeeperPersistenceService;
  const service = new GatekeeperRecoveryService(prisma, persistence);
  const dto = {
    requesterEmail: "requester@example.com",
    authorizedRepresentativeAttested: true as const,
    requesterName: "Requester",
    requesterNote: "Please route this request to the organization admin.",
  };
  const createdAt = new Date("2026-08-21T12:00:00.000Z");

  beforeEach(() => {
    getGatekeeperResult.mockReset();
    findBrandProfile.mockReset();
    upsertRecoveryRequest.mockReset();
    getGatekeeperResult.mockResolvedValue(gatekeeper());
    findBrandProfile.mockResolvedValue({ organizationId: "org-1" });
    upsertRecoveryRequest.mockImplementation(
      async (args: {
        create: {
          requestType: GatekeeperRecoveryRequestType;
          discoveryLeadId: string;
          normalizedDomain: string;
        };
      }) => ({
        id: "request-1",
        requestType: args.create.requestType,
        discoveryLeadId: args.create.discoveryLeadId,
        normalizedDomain: args.create.normalizedDomain,
        createdAt,
      }),
    );
  });

  it("persists an organization-access request without granting access", async () => {
    const response = await service.requestOrganizationAccess("lead-1", dto, {
      authenticatedUserId: "user-1",
      sessionId: "session-1",
    });

    expect(findBrandProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isVerified: true }),
      }),
    );
    expect(upsertRecoveryRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          requestType: GatekeeperRecoveryRequestType.REQUEST_ORG_ACCESS,
          discoveryLeadId: "lead-1",
          targetOrganizationId: "org-1",
          requesterUserId: "user-1",
          sessionReference: "session-1",
          gatekeeperContext: expect.objectContaining({
            requested_action: "REQUEST_ORG_ACCESS",
            authorized_representative_attested: true,
          }),
        }),
        update: {},
      }),
    );
    expect(response.request).toEqual({
      id: "request-1",
      type: "REQUEST_ORG_ACCESS",
      status: "RECEIVED",
      discoveryLeadId: "lead-1",
      normalizedDomain: "example.com",
      submittedAt: createdAt.toISOString(),
    });
  });

  it("uses the compound identity for retry-safe organization access", async () => {
    await service.requestOrganizationAccess("lead-1", dto, {});

    expect(upsertRecoveryRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          requestType_discoveryLeadId_requesterEmail: {
            requestType: GatekeeperRecoveryRequestType.REQUEST_ORG_ACCESS,
            discoveryLeadId: "lead-1",
            requesterEmail: "requester@example.com",
          },
        },
      }),
    );
  });

  it("rejects organization access when the authoritative state no longer permits it", async () => {
    getGatekeeperResult.mockResolvedValue(
      gatekeeper({
        outcome: "ADMITTED",
        recovery_actions: ["CONTINUE"],
      }),
    );

    await expect(
      service.requestOrganizationAccess("lead-1", dto, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsertRecoveryRequest).not.toHaveBeenCalled();
  });

  it("rejects organization access when the claimed organization is stale", async () => {
    findBrandProfile.mockResolvedValue(null);

    await expect(
      service.requestOrganizationAccess("lead-1", dto, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(upsertRecoveryRequest).not.toHaveBeenCalled();
  });

  it("persists only an explicitly invoked eligible classification review", async () => {
    getGatekeeperResult.mockResolvedValue(
      gatekeeper({
        outcome: "CLASSIFICATION_UNCERTAIN",
        reason_code: "INSUFFICIENT_EVIDENCE",
        recovery_actions: ["REQUEST_CLASSIFICATION_REVIEW", "RETRY"],
        manual_review_eligible: true,
      }),
    );

    const response = await service.requestClassificationReview(
      "lead-1",
      dto,
      {},
    );

    expect(upsertRecoveryRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          requestType:
            GatekeeperRecoveryRequestType.REQUEST_CLASSIFICATION_REVIEW,
          targetOrganizationId: null,
          gatekeeperContext: expect.objectContaining({
            outcome: "CLASSIFICATION_UNCERTAIN",
            reason_code: "INSUFFICIENT_EVIDENCE",
            manual_review_eligible: true,
            industry_disagreement_flag: false,
          }),
        }),
      }),
    );
    expect(response.request.type).toBe("REQUEST_CLASSIFICATION_REVIEW");
  });

  it("does not turn supported-Industry disagreement into a review request", async () => {
    const supportedOverride = gatekeeper({
      outcome: "ADMITTED",
      reason_code: null,
      recovery_actions: ["CONTINUE"],
      manual_review_eligible: false,
    });
    supportedOverride.confirmation = {
      assessed_industry: IndustryVertical.D2C,
      confirmed_industry: IndustryVertical.SAAS_AI,
      confirmation_source: "USER_CONFIRMED_OVERRIDE",
      industry_disagreement_flag: true,
      surface_eligible: true,
    };
    getGatekeeperResult.mockResolvedValue(supportedOverride);

    await expect(
      service.requestClassificationReview("lead-1", dto, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsertRecoveryRequest).not.toHaveBeenCalled();
  });

  it("requires both eligibility metadata and the explicit recovery action", async () => {
    getGatekeeperResult.mockResolvedValue(
      gatekeeper({
        outcome: "UNSUPPORTED",
        reason_code: "UNSUPPORTED_INDUSTRY",
        recovery_actions: ["JOIN_WAITLIST"],
        manual_review_eligible: true,
      }),
    );

    await expect(
      service.requestClassificationReview("lead-1", dto, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsertRecoveryRequest).not.toHaveBeenCalled();
  });
});
