import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { GatekeeperRecoveryRequestType, Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { GatekeeperRecoveryRequestDto } from "../dto/gatekeeper-recovery-request.dto";
import { GatekeeperPersistenceService } from "./gatekeeper-persistence.service";
import type {
  GatekeeperRecoveryAction,
  GatekeeperStructuredResult,
} from "./gatekeeper-v1.types";

const RECOVERY_CONTEXT_VERSION = "gatekeeper_recovery_context_v1" as const;

type RecoveryRequestContext = {
  authenticatedUserId?: string;
  sessionId?: string;
};

type RecoveryRequestResponse = {
  request: {
    id: string;
    type: GatekeeperRecoveryRequestType;
    status: "RECEIVED";
    discoveryLeadId: string;
    normalizedDomain: string;
    submittedAt: string;
  };
};

@Injectable()
export class GatekeeperRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly persistence: GatekeeperPersistenceService,
  ) {}

  async requestOrganizationAccess(
    leadId: string,
    dto: GatekeeperRecoveryRequestDto,
    context: RecoveryRequestContext,
  ): Promise<RecoveryRequestResponse> {
    const gatekeeper = await this.persistence.getGatekeeperResult(leadId);
    this.assertRecoveryAction(gatekeeper, "ORG_CLAIMED", "REQUEST_ORG_ACCESS");

    const target = await this.prisma.brandProfile.findFirst({
      where: {
        isVerified: true,
        organizationId: { not: null },
        OR: [
          { domain: gatekeeper.submission.normalized_domain },
          { domain: gatekeeper.submission.normalized_url },
        ],
      },
      select: { organizationId: true },
    });
    if (!target?.organizationId) {
      throw new ConflictException({
        code: "GATEKEEPER_ORGANIZATION_CONTEXT_STALE",
        message: "The claimed organization can no longer be resolved.",
      });
    }

    return this.persistRequest(
      GatekeeperRecoveryRequestType.REQUEST_ORG_ACCESS,
      leadId,
      dto,
      context,
      gatekeeper,
      target.organizationId,
    );
  }

  async requestClassificationReview(
    leadId: string,
    dto: GatekeeperRecoveryRequestDto,
    context: RecoveryRequestContext,
  ): Promise<RecoveryRequestResponse> {
    const gatekeeper = await this.persistence.getGatekeeperResult(leadId);
    const decision = gatekeeper.decision;
    const eligibleOutcome =
      decision.outcome === "CLASSIFICATION_UNCERTAIN" ||
      decision.outcome === "UNSUPPORTED";
    if (
      !eligibleOutcome ||
      decision.manual_review_eligible !== true ||
      !decision.recovery_actions.includes("REQUEST_CLASSIFICATION_REVIEW")
    ) {
      throw new BadRequestException({
        code: "GATEKEEPER_CLASSIFICATION_REVIEW_NOT_ELIGIBLE",
        message:
          "The current Gatekeeper state does not permit a classification review request.",
      });
    }

    return this.persistRequest(
      GatekeeperRecoveryRequestType.REQUEST_CLASSIFICATION_REVIEW,
      leadId,
      dto,
      context,
      gatekeeper,
      null,
    );
  }

  private assertRecoveryAction(
    gatekeeper: GatekeeperStructuredResult,
    expectedOutcome: GatekeeperStructuredResult["decision"]["outcome"],
    action: GatekeeperRecoveryAction,
  ): void {
    if (
      gatekeeper.decision.outcome !== expectedOutcome ||
      !gatekeeper.decision.recovery_actions.includes(action)
    ) {
      throw new BadRequestException({
        code: "GATEKEEPER_RECOVERY_ACTION_NOT_PERMITTED",
        message: "The current Gatekeeper state does not permit this action.",
      });
    }
  }

  private async persistRequest(
    requestType: GatekeeperRecoveryRequestType,
    leadId: string,
    dto: GatekeeperRecoveryRequestDto,
    context: RecoveryRequestContext,
    gatekeeper: GatekeeperStructuredResult,
    targetOrganizationId: string | null,
  ): Promise<RecoveryRequestResponse> {
    const record = await this.prisma.gatekeeperRecoveryRequest.upsert({
      where: {
        requestType_discoveryLeadId_requesterEmail: {
          requestType,
          discoveryLeadId: leadId,
          requesterEmail: dto.requesterEmail,
        },
      },
      create: {
        requestType,
        discoveryLeadId: leadId,
        normalizedDomain: gatekeeper.submission.normalized_domain,
        requesterEmail: dto.requesterEmail,
        requesterName: dto.requesterName,
        requesterNote: dto.requesterNote,
        requesterUserId: context.authenticatedUserId,
        targetOrganizationId,
        sessionReference: context.sessionId,
        contextVersion: RECOVERY_CONTEXT_VERSION,
        gatekeeperContext: this.gatekeeperContext(
          requestType,
          gatekeeper,
          dto.authorizedRepresentativeAttested,
        ) as unknown as Prisma.InputJsonValue,
      },
      update: {},
      select: {
        id: true,
        requestType: true,
        normalizedDomain: true,
        createdAt: true,
      },
    });

    return {
      request: {
        id: record.id,
        type: record.requestType,
        status: "RECEIVED",
        discoveryLeadId: leadId,
        normalizedDomain: record.normalizedDomain,
        submittedAt: record.createdAt.toISOString(),
      },
    };
  }

  private gatekeeperContext(
    requestType: GatekeeperRecoveryRequestType,
    gatekeeper: GatekeeperStructuredResult,
    authorizedRepresentativeAttested: true,
  ) {
    return {
      version: RECOVERY_CONTEXT_VERSION,
      source: "GATEKEEPER_V1",
      requested_action: requestType,
      authorized_representative_attested: authorizedRepresentativeAttested,
      gatekeeper_result_version: gatekeeper.version,
      outcome: gatekeeper.decision.outcome,
      reason_code: gatekeeper.decision.reason_code,
      manual_review_eligible: gatekeeper.decision.manual_review_eligible,
      assessed_industry:
        gatekeeper.assessment?.provisional_industry ??
        gatekeeper.confirmation.assessed_industry,
      confirmed_industry: gatekeeper.confirmation.confirmed_industry,
      industry_disagreement_flag:
        gatekeeper.confirmation.industry_disagreement_flag,
    };
  }
}
