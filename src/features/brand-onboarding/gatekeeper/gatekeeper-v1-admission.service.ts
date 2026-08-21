import { Injectable } from "@nestjs/common";

import { BrandScanGateService } from "../brand-scan-gate.service";
import { DiscoveryReachabilityService } from "../discovery-reachability.service";
import { gateAndNormalizeBrandUrl } from "../discovery-url.util";
import type { DiscoverValidateRequestDto } from "../dto/discover-validate-request.dto";
import { maskAdminEmail } from "../mask-admin-email.util";
import { GatekeeperAdmissionDecisionService } from "./gatekeeper-admission-decision.service";
import { GatekeeperPersistenceService } from "./gatekeeper-persistence.service";
import { GatekeeperPolicyVersionService } from "./gatekeeper-policy-version.service";
import { GatekeeperRuntimeOrchestratorService } from "./runtime/gatekeeper-runtime-orchestrator.service";
import {
  GATEKEEPER_RESULT_VERSION,
  type GatekeeperDecision,
  type GatekeeperStructuredResult,
} from "./gatekeeper-v1.types";

type ValidationContext = {
  clientIp: string;
  authenticatedUserId?: string;
  sessionId?: string;
  acceptanceTimestamp?: Date;
};

@Injectable()
export class GatekeeperV1AdmissionService {
  constructor(
    private readonly scanGate: BrandScanGateService,
    private readonly reachability: DiscoveryReachabilityService,
    private readonly runtime: GatekeeperRuntimeOrchestratorService,
    private readonly decisions: GatekeeperAdmissionDecisionService,
    private readonly persistence: GatekeeperPersistenceService,
    private readonly policies: GatekeeperPolicyVersionService,
  ) {}

  async validate(dto: DiscoverValidateRequestDto, context: ValidationContext) {
    // Fail before provider work when the server cannot authoritatively bind the
    // accepted policy versions. Client-supplied policy strings are not inputs.
    this.policies.authoritativeVersions();
    context = { ...context, acceptanceTimestamp: new Date() };

    const entry = await this.scanGate.evaluateEntry({
      rawUrl: dto.url,
      clientIp: context.clientIp,
      authenticatedUserId: context.authenticatedUserId,
    });

    if (entry.kind === "url_blocked" && !entry.reason.ok) {
      return this.terminal(
        dto,
        context,
        dto.url.trim(),
        entry.reason.hostname ?? "",
        {
          outcome: "DOMAIN_INVALID",
          reason_code: this.mapUrlFailure(entry.reason.reason),
          recovery_actions: ["RETRY"],
          manual_review_eligible: false,
        },
      );
    }

    const normalized = gateAndNormalizeBrandUrl(dto.url);
    if (!normalized.ok) {
      return this.terminal(
        dto,
        context,
        dto.url.trim(),
        normalized.hostname ?? "",
        {
          outcome: "DOMAIN_INVALID",
          reason_code: this.mapUrlFailure(normalized.reason),
          recovery_actions: ["RETRY"],
          manual_review_eligible: false,
        },
      );
    }

    if (entry.kind === "org_claimed") {
      return {
        ...(await this.terminal(
          dto,
          context,
          normalized.normalizedUrl,
          entry.domain,
          {
            outcome: "ORG_CLAIMED",
            reason_code: "ORGANIZATION_ALREADY_CLAIMED",
            recovery_actions: ["REQUEST_ORG_ACCESS"],
            manual_review_eligible: false,
          },
        )),
        adminEmail: maskAdminEmail(entry.adminEmail),
      };
    }
    if (entry.kind === "brand_active") {
      return this.terminal(
        dto,
        context,
        normalized.normalizedUrl,
        entry.domain,
        {
          outcome: "EXISTING_BRAND",
          reason_code: "EXISTING_VERIFIED_BRAND",
          recovery_actions: ["SIGN_IN"],
          manual_review_eligible: false,
        },
      );
    }
    if (entry.kind === "verification_required") {
      return {
        ...(await this.terminal(
          dto,
          context,
          normalized.normalizedUrl,
          entry.domain,
          {
            outcome: "VERIFICATION_REQUIRED",
            reason_code: "DOMAIN_VERIFICATION_REQUIRED",
            recovery_actions: ["VERIFY_DOMAIN"],
            manual_review_eligible: false,
          },
        )),
        brandProfileId: entry.brandProfileId,
      };
    }
    if (entry.kind === "resume") {
      return {
        ...(await this.terminal(
          dto,
          context,
          entry.normalizedUrl,
          entry.domain,
          {
            outcome: "RESUME_AVAILABLE",
            reason_code: "RECENT_RESUMABLE_SCAN",
            recovery_actions: ["RESUME"],
            manual_review_eligible: false,
          },
        )),
        leadId: entry.leadId,
        brandProfileId: entry.brandProfileId,
      };
    }

    const reach = await this.reachability.probe(normalized.normalizedUrl);
    if (!reach.ok) {
      return this.terminal(
        dto,
        context,
        normalized.normalizedUrl,
        normalized.hostname,
        {
          outcome: "DOMAIN_UNREACHABLE",
          reason_code:
            reach.reason === "redirect_hijack"
              ? "REDIRECT_INTEGRITY_FAILED"
              : "DNS_OR_TIMEOUT",
          recovery_actions: ["RETRY"],
          manual_review_eligible: false,
        },
      );
    }
    if (
      reach.contentSignal === "parked" ||
      reach.contentSignal === "unreadable"
    ) {
      return this.terminal(
        dto,
        context,
        normalized.normalizedUrl,
        normalized.hostname,
        {
          outcome: "UNSUPPORTED",
          reason_code: "PARKED_OR_UNUSABLE_WEBSITE",
          recovery_actions: ["JOIN_WAITLIST", "REQUEST_CLASSIFICATION_REVIEW"],
          manual_review_eligible: true,
        },
      );
    }
    if (reach.contentSignal === "foreign_language") {
      return this.terminal(
        dto,
        context,
        normalized.normalizedUrl,
        normalized.hostname,
        {
          outcome: "UNSUPPORTED_LANGUAGE",
          reason_code: "INSUFFICIENT_ENGLISH_EVIDENCE",
          recovery_actions: ["JOIN_WAITLIST"],
          manual_review_eligible: false,
        },
      );
    }

    const execution = await this.runtime.execute({
      normalizedUrl: normalized.normalizedUrl,
      normalizedDomain: normalized.hostname,
    });
    const decision: GatekeeperDecision = execution.exhaustedTechnicalFailure
      ? {
          outcome: "TECHNICAL_FAILURE",
          reason_code: "PROVIDER_CHAIN_EXHAUSTED",
          recovery_actions: ["RETRY", "CONTACT_SUPPORT"],
          manual_review_eligible: false,
        }
      : execution.unresolvedSemanticUncertainty || !execution.assessment
        ? {
            outcome: "CLASSIFICATION_UNCERTAIN",
            reason_code: "INSUFFICIENT_EVIDENCE",
            recovery_actions: ["REQUEST_CLASSIFICATION_REVIEW", "RETRY"],
            manual_review_eligible: true,
          }
        : this.decisions.resolve(execution.assessment);

    const result = this.result(
      normalized.normalizedUrl,
      normalized.hostname,
      decision,
      execution.assessment,
      execution.execution,
    );
    const persisted = await this.persistence.persistResult(
      dto,
      context,
      result,
    );
    return {
      gatekeeper_result: result,
      ...(persisted.leadId ? { leadId: persisted.leadId } : {}),
    };
  }

  private async terminal(
    dto: DiscoverValidateRequestDto,
    context: ValidationContext,
    normalizedUrl: string,
    normalizedDomain: string,
    decision: GatekeeperDecision,
  ) {
    const result = this.result(
      normalizedUrl,
      normalizedDomain,
      decision,
      null,
      {
        primary: "NOT_RUN",
        parallel: "NOT_RUN",
        reassessment: "NOT_RUN",
        openai: "NOT_RUN",
      },
    );
    const persisted = await this.persistence.persistResult(
      dto,
      context,
      result,
    );
    return {
      gatekeeper_result: result,
      ...(persisted.leadId ? { leadId: persisted.leadId } : {}),
    };
  }

  private result(
    normalizedUrl: string,
    normalizedDomain: string,
    decision: GatekeeperDecision,
    assessment: GatekeeperStructuredResult["assessment"],
    execution: GatekeeperStructuredResult["execution"],
  ): GatekeeperStructuredResult {
    return {
      version: GATEKEEPER_RESULT_VERSION,
      submission: {
        normalized_url: normalizedUrl,
        normalized_domain: normalizedDomain,
      },
      assessment,
      decision,
      confirmation: {
        assessed_industry: assessment?.provisional_industry ?? null,
        confirmed_industry: null,
        confirmation_source: null,
        industry_disagreement_flag: false,
        surface_eligible: false,
      },
      handoff: {
        gatekeeper_completed: decision.outcome !== "TECHNICAL_FAILURE",
        confirmed_industry_required: decision.outcome === "ADMITTED",
      },
      execution,
    };
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
