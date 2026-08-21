import { Injectable, NotFoundException } from "@nestjs/common";
import { DiscoveryLeadStatus, IndustryVertical, Prisma } from "@prisma/client";
import { addDays } from "date-fns";

import { PrismaService } from "../../../prisma/prisma.service";
import { BRAND_RESUME_PROFILE_MAX_AGE_DAYS } from "../brand-scan-gate.config";
import type { DiscoverValidateRequestDto } from "../dto/discover-validate-request.dto";
import { GatekeeperPolicyVersionService } from "./gatekeeper-policy-version.service";
import type { GatekeeperStructuredResult } from "./gatekeeper-v1.types";

type SubmissionContext = {
  authenticatedUserId?: string;
  sessionId?: string;
  acceptanceTimestamp?: Date;
};

function jsonObject(
  value: Prisma.JsonValue | null | undefined,
): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class GatekeeperPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: GatekeeperPolicyVersionService,
  ) {}

  async persistResult(
    dto: DiscoverValidateRequestDto,
    context: SubmissionContext,
    result: GatekeeperStructuredResult,
  ): Promise<{ leadId: string | null }> {
    const policy = this.policies.authoritativeVersions();
    const acceptedAt = context.acceptanceTimestamp ?? new Date();
    const persistLead = result.decision.outcome !== "DOMAIN_INVALID";

    return this.prisma.$transaction(async (tx) => {
      let leadId: string | null = null;
      if (persistLead) {
        const existing = await tx.discoveryLead.findUnique({
          where: { normalizedUrl: result.submission.normalized_url },
          select: { temporaryPayload: true },
        });
        const previous = jsonObject(existing?.temporaryPayload);
        const temporaryPayload = {
          ...previous,
          gatekeeper: result,
          submissionControl: {
            ownershipAuthorizationAttested: dto.ownershipAuthorizationAttested,
            termsAccepted: dto.termsAccepted,
            privacyPolicyAccepted: dto.privacyPolicyAccepted,
            termsVersion: policy.termsVersion,
            privacyPolicyVersion: policy.privacyPolicyVersion,
            acceptedAt: acceptedAt.toISOString(),
            userId: context.authenticatedUserId ?? null,
            sessionId: context.sessionId ?? null,
          },
        } as unknown as Prisma.InputJsonValue;
        const supported = result.decision.outcome === "ADMITTED";
        const lead = await tx.discoveryLead.upsert({
          where: { normalizedUrl: result.submission.normalized_url },
          create: {
            rawUrl: dto.url.trim(),
            normalizedUrl: result.submission.normalized_url,
            status: supported
              ? DiscoveryLeadStatus.IDENTIFIED
              : DiscoveryLeadStatus.REJECTED,
            isSupported: supported,
            industry:
              result.assessment?.provisional_industry ??
              IndustryVertical.UNKNOWN,
            subIndustry: result.assessment?.provisional_sub_industry ?? null,
            securityScore: 0,
            temporaryPayload,
            expiresAt: addDays(new Date(), BRAND_RESUME_PROFILE_MAX_AGE_DAYS),
            signupCompleted: false,
            classificationEvidence: this.summary(result),
            userId: context.authenticatedUserId,
          },
          update: {
            rawUrl: dto.url.trim(),
            status: supported
              ? DiscoveryLeadStatus.IDENTIFIED
              : DiscoveryLeadStatus.REJECTED,
            isSupported: supported,
            industry:
              result.assessment?.provisional_industry ??
              IndustryVertical.UNKNOWN,
            subIndustry: result.assessment?.provisional_sub_industry ?? null,
            temporaryPayload,
            expiresAt: addDays(new Date(), BRAND_RESUME_PROFILE_MAX_AGE_DAYS),
            classificationEvidence: this.summary(result),
            ...(context.authenticatedUserId
              ? { userId: context.authenticatedUserId }
              : {}),
          },
        });
        leadId = lead.id;
      }

      // Append-only legal/application audit. This service intentionally exposes
      // no update/delete operation for acceptance records.
      await tx.gatekeeperSubmissionAudit.create({
        data: {
          rawUrl: dto.url.trim(),
          normalizedUrl: result.submission.normalized_url || null,
          normalizedDomain: result.submission.normalized_domain || null,
          ownershipAuthorizationAttested: dto.ownershipAuthorizationAttested,
          termsAccepted: dto.termsAccepted,
          privacyPolicyAccepted: dto.privacyPolicyAccepted,
          termsVersion: policy.termsVersion,
          privacyPolicyVersion: policy.privacyPolicyVersion,
          acceptedAt,
          userId: context.authenticatedUserId,
          sessionReference: context.sessionId,
          discoveryLeadId: leadId,
        },
      });
      return { leadId };
    });
  }

  async getGatekeeperResult(
    leadId: string,
  ): Promise<GatekeeperStructuredResult> {
    const lead = await this.prisma.discoveryLead.findUnique({
      where: { id: leadId },
      select: { temporaryPayload: true },
    });
    const gatekeeper = jsonObject(lead?.temporaryPayload).gatekeeper;
    if (!lead || !gatekeeper || typeof gatekeeper !== "object") {
      throw new NotFoundException(
        "Gatekeeper result not found for DiscoveryLead",
      );
    }
    return gatekeeper as GatekeeperStructuredResult;
  }

  async persistConfirmation(
    leadId: string,
    result: GatekeeperStructuredResult,
  ): Promise<void> {
    const existing = await this.prisma.discoveryLead.findUnique({
      where: { id: leadId },
      select: { temporaryPayload: true },
    });
    if (!existing) throw new NotFoundException("DiscoveryLead not found");
    const previous = jsonObject(existing.temporaryPayload);
    const supported = result.confirmation.surface_eligible;
    await this.prisma.discoveryLead.update({
      where: { id: leadId },
      data: {
        industry:
          result.confirmation.confirmed_industry ??
          result.assessment?.provisional_industry ??
          IndustryVertical.UNKNOWN,
        isSupported: supported,
        status: supported
          ? DiscoveryLeadStatus.IDENTIFIED
          : DiscoveryLeadStatus.REJECTED,
        temporaryPayload: {
          ...previous,
          gatekeeper: result,
        } as unknown as Prisma.InputJsonValue,
        classificationEvidence: this.summary(result),
      },
    });
  }

  private summary(result: GatekeeperStructuredResult): string {
    const assessed = result.assessment?.provisional_industry ?? "NONE";
    const confirmed = result.confirmation.confirmed_industry ?? "NONE";
    return `Gatekeeper v1 ${result.decision.outcome}; assessed=${assessed}; confirmed=${confirmed}; reason=${result.decision.reason_code ?? "NONE"}`.slice(
      0,
      250,
    );
  }
}
