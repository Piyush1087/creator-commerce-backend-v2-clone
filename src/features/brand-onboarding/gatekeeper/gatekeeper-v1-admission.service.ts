import { Injectable, Logger } from "@nestjs/common";
import {
  DiscoveryLeadStatus,
  IndustryVertical,
  Prisma,
} from "@prisma/client";
import { addDays } from "date-fns";

import { PrismaService } from "../../../prisma/prisma.service";
import { BRAND_RESUME_PROFILE_MAX_AGE_DAYS } from "../brand-scan-gate.config";
import { BrandScanGateService } from "../brand-scan-gate.service";
import { DiscoveryReachabilityService } from "../discovery-reachability.service";
import { gateAndNormalizeBrandUrl } from "../discovery-url.util";
import { maskAdminEmail } from "../mask-admin-email.util";
import type { DiscoverValidateRequestDto } from "../dto/discover-validate-request.dto";
import { GatekeeperAdmissionDecisionService } from "./gatekeeper-admission-decision.service";
import { GatekeeperFallbackOrchestratorService } from "./gatekeeper-fallback-orchestrator.service";
import {
  GATEKEEPER_RESULT_VERSION,
  type GatekeeperDecision,
  type GatekeeperStructuredResult,
} from "./gatekeeper-v1.types";

@Injectable()
export class GatekeeperV1AdmissionService {
  private readonly logger = new Logger(GatekeeperV1AdmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scanGate: BrandScanGateService,
    private readonly reachability: DiscoveryReachabilityService,
    private readonly fallback: GatekeeperFallbackOrchestratorService,
    private readonly decisions: GatekeeperAdmissionDecisionService,
  ) {}

  async validate(
    dto: DiscoverValidateRequestDto,
    ctx: { clientIp: string; authenticatedUserId?: string; sessionId?: string },
  ) {
    const entry = await this.scanGate.evaluateEntry({
      rawUrl: dto.url,
      clientIp: ctx.clientIp,
      authenticatedUserId: ctx.authenticatedUserId,
    });

    if (entry.kind === "url_blocked" && !entry.reason.ok) {
      return this.terminal(dto.url, entry.reason.hostname ?? "", {
        outcome: "DOMAIN_INVALID",
        reason_code: this.mapUrlFailure(entry.reason.reason),
        recovery_actions: ["RETRY"],
        manual_review_eligible: false,
      });
    }
    if (entry.kind === "org_claimed") {
      return {
        gatekeeper_result: await this.persistTerminal(dto, ctx, entry.domain, dto.url, {
          outcome: "ORG_CLAIMED",
          reason_code: "ORGANIZATION_ALREADY_CLAIMED",
          recovery_actions: ["REQUEST_ORG_ACCESS"],
          manual_review_eligible: false,
        }),
        adminEmail: maskAdminEmail(entry.adminEmail),
      };
    }
    if (entry.kind === "brand_active") {
      return {
        gatekeeper_result: await this.persistTerminal(dto, ctx, entry.domain, dto.url, {
          outcome: "EXISTING_BRAND",
          reason_code: "EXISTING_VERIFIED_BRAND",
          recovery_actions: ["SIGN_IN"],
          manual_review_eligible: false,
        }),
      };
    }
    if (entry.kind === "verification_required") {
      return {
        gatekeeper_result: await this.persistTerminal(dto, ctx, entry.domain, dto.url, {
          outcome: "VERIFICATION_REQUIRED",
          reason_code: "DOMAIN_VERIFICATION_REQUIRED",
          recovery_actions: ["VERIFY_DOMAIN"],
          manual_review_eligible: false,
        }),
        brandProfileId: entry.brandProfileId,
      };
    }
    if (entry.kind === "resume") {
      const result = await this.persistTerminal(
        dto,
        ctx,
        entry.domain,
        entry.normalizedUrl,
        {
          outcome: "RESUME_AVAILABLE",
          reason_code: "RECENT_RESUMABLE_SCAN",
          recovery_actions: ["RESUME"],
          manual_review_eligible: false,
        },
      );
      return { gatekeeper_result: result, leadId: entry.leadId, brandProfileId: entry.brandProfileId };
    }

    const gated = gateAndNormalizeBrandUrl(dto.url);
    if (!gated.ok) {
      return this.terminal(dto.url, gated.hostname ?? "", {
        outcome: "DOMAIN_INVALID",
        reason_code: this.mapUrlFailure(gated.reason),
        recovery_actions: ["RETRY"],
        manual_review_eligible: false,
      });
    }

    const reach = await this.reachability.probe(gated.normalizedUrl);
    if (!reach.ok) {
      const reason =
        reach.reason === "redirect_hijack"
          ? "REDIRECT_INTEGRITY_FAILED"
          : "DNS_OR_TIMEOUT";
      return {
        gatekeeper_result: await this.persistTerminal(
          dto,
          ctx,
          gated.hostname,
          gated.normalizedUrl,
          {
            outcome: "DOMAIN_UNREACHABLE",
            reason_code: reason,
            recovery_actions: ["RETRY"],
            manual_review_eligible: false,
          },
        ),
      };
    }

    if (reach.contentSignal === "parked" || reach.contentSignal === "unreadable") {
      return {
        gatekeeper_result: await this.persistTerminal(
          dto,
          ctx,
          gated.hostname,
          gated.normalizedUrl,
          {
            outcome: "UNSUPPORTED",
            reason_code: "PARKED_OR_UNUSABLE_WEBSITE",
            recovery_actions: ["JOIN_WAITLIST", "REQUEST_CLASSIFICATION_REVIEW"],
            manual_review_eligible: true,
          },
        ),
      };
    }

    const execution = await this.fallback.execute({
      normalizedUrl: gated.normalizedUrl,
      normalizedDomain: gated.hostname,
    });

    let decision: GatekeeperDecision;
    if (execution.exhaustedTechnicalFailure) {
      decision = {
        outcome: "TECHNICAL_FAILURE",
        reason_code: "PROVIDER_CHAIN_EXHAUSTED",
        recovery_actions: ["RETRY", "CONTACT_SUPPORT"],
        manual_review_eligible: false,
      };
    } else if (execution.unresolvedSemanticUncertainty || !execution.assessment) {
      decision = {
        outcome: "CLASSIFICATION_UNCERTAIN",
        reason_code: "INSUFFICIENT_EVIDENCE",
        recovery_actions: ["REQUEST_CLASSIFICATION_REVIEW", "RETRY"],
        manual_review_eligible: true,
      };
    } else {
      decision = this.decisions.resolve(execution.assessment);
    }

    const result: GatekeeperStructuredResult = {
      version: GATEKEEPER_RESULT_VERSION,
      submission: {
        normalized_url: gated.normalizedUrl,
        normalized_domain: gated.hostname,
      },
      assessment: execution.assessment,
      decision,
      handoff: {
        gatekeeper_completed: decision.outcome !== "TECHNICAL_FAILURE",
        confirmed_industry_required: decision.outcome === "ADMITTED",
      },
      execution: execution.execution,
    };

    const lead = await this.persistResult(dto, ctx, result);
    return { gatekeeper_result: result, leadId: lead.id };
  }

  private async terminal(rawUrl: string, domain: string, decision: GatekeeperDecision) {
    const gated = gateAndNormalizeBrandUrl(rawUrl);
    if (!gated.ok) {
      return {
        gatekeeper_result: {
          version: GATEKEEPER_RESULT_VERSION,
          submission: { normalized_url: rawUrl.trim(), normalized_domain: domain },
          assessment: null,
          decision,
          handoff: { gatekeeper_completed: true, confirmed_industry_required: false },
          execution: { primary: "NOT_RUN", parallel: "NOT_RUN", openai: "NOT_RUN" },
        } satisfies GatekeeperStructuredResult,
      };
    }
    return { gatekeeper_result: await this.persistTerminal({ url: rawUrl } as DiscoverValidateRequestDto, {}, domain, gated.normalizedUrl, decision) };
  }

  private async persistTerminal(
    dto: DiscoverValidateRequestDto,
    ctx: { authenticatedUserId?: string; sessionId?: string },
    domain: string,
    normalizedUrl: string,
    decision: GatekeeperDecision,
  ): Promise<GatekeeperStructuredResult> {
    const result: GatekeeperStructuredResult = {
      version: GATEKEEPER_RESULT_VERSION,
      submission: { normalized_url: normalizedUrl, normalized_domain: domain },
      assessment: null,
      decision,
      handoff: { gatekeeper_completed: true, confirmed_industry_required: false },
      execution: { primary: "NOT_RUN", parallel: "NOT_RUN", openai: "NOT_RUN" },
    };
    await this.persistResult(dto, ctx, result);
    return result;
  }

  private async persistResult(
    dto: DiscoverValidateRequestDto,
    ctx: { authenticatedUserId?: string; sessionId?: string },
    result: GatekeeperStructuredResult,
  ) {
    const existing = await this.prisma.discoveryLead.findUnique({
      where: { normalizedUrl: result.submission.normalized_url },
      select: { temporaryPayload: true },
    });
    const previous =
      existing?.temporaryPayload && typeof existing.temporaryPayload === "object" && !Array.isArray(existing.temporaryPayload)
        ? (existing.temporaryPayload as Record<string, unknown>)
        : {};
    const payload: Prisma.InputJsonValue = {
      ...previous,
      gatekeeper: result as unknown as Prisma.InputJsonValue,
      submissionControl: {
        ownershipAuthorizationAttested: dto.ownershipAuthorizationAttested,
        termsAccepted: dto.termsAccepted,
        privacyPolicyAccepted: dto.privacyPolicyAccepted,
        termsVersion: dto.termsVersion,
        privacyPolicyVersion: dto.privacyPolicyVersion,
        acceptedAt: new Date().toISOString(),
        userId: ctx.authenticatedUserId ?? null,
        sessionId: ctx.sessionId ?? null,
      },
    };
    const provisional = result.assessment?.provisional_industry ?? IndustryVertical.UNKNOWN;
    const supported = result.decision.outcome === "ADMITTED";
    const status = supported ? DiscoveryLeadStatus.IDENTIFIED : DiscoveryLeadStatus.REJECTED;
    const expiresAt = addDays(new Date(), BRAND_RESUME_PROFILE_MAX_AGE_DAYS);

    const lead = await this.prisma.discoveryLead.upsert({
      where: { normalizedUrl: result.submission.normalized_url },
      create: {
        rawUrl: dto.url.trim(),
        normalizedUrl: result.submission.normalized_url,
        status,
        isSupported: supported,
        industry: provisional,
        subIndustry: result.assessment?.provisional_sub_industry ?? null,
        securityScore: 0,
        temporaryPayload: payload,
        expiresAt,
        signupCompleted: false,
        classificationEvidence: this.summary(result),
        userId: ctx.authenticatedUserId,
      },
      update: {
        rawUrl: dto.url.trim(),
        status,
        isSupported: supported,
        industry: provisional,
        subIndustry: result.assessment?.provisional_sub_industry ?? null,
        temporaryPayload: payload,
        expiresAt,
        classificationEvidence: this.summary(result),
        ...(ctx.authenticatedUserId ? { userId: ctx.authenticatedUserId } : {}),
      },
    });
    this.logger.log(
      `gatekeeper.v1 persisted lead=${lead.id} outcome=${result.decision.outcome} domain=${result.submission.normalized_domain}`,
    );
    return lead;
  }

  private summary(result: GatekeeperStructuredResult): string {
    const industry = result.assessment?.provisional_industry ?? "NONE";
    return `Gatekeeper v1 ${result.decision.outcome}; assessed=${industry}; reason=${result.decision.reason_code ?? "NONE"}`.slice(0, 250);
  }

  private mapUrlFailure(reason: string): GatekeeperDecision["reason_code"] {
    if (reason === "BLOCKED_PRIVATE_HOST") return "PRIVATE_OR_LOCAL_HOST";
    if (reason === "BLOCKED_SOCIAL_HOST") return "PROHIBITED_URL";
    if (reason === "BLOCKED_TLD" || reason === "BLOCKED_RESTRICTED_SEGMENT") {
      return "BLOCKED_DOMAIN_OR_TLD";
    }
    return "INVALID_URL";
  }
}
