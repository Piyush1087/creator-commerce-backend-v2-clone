import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  DiscoveryLeadStatus,
  IndustryVertical,
  MarketIntelRejectionType,
  Prisma,
} from "@prisma/client";
import { addDays } from "date-fns";

import { PrismaService } from "../../prisma/prisma.service";
import { BRAND_RESUME_PROFILE_MAX_AGE_DAYS } from "./brand-scan-gate.config";
import { BrandScanGateService } from "./brand-scan-gate.service";
import type { DiscoverWaitlistRequestDto } from "./dto/discover-waitlist-request.dto";
import { stubClassifyIndustry } from "./discovery-industry.stub";
import { DiscoveryReachabilityService } from "./discovery-reachability.service";
import { redactUrlForLogs } from "./discovery-redaction";
import {
  gateAndNormalizeBrandUrl,
  type UrlGateFailureReason,
} from "./discovery-url.util";
import { maskAdminEmail } from "./mask-admin-email.util";
import {
  INDUSTRY_CLASSIFIER,
  type IndustryClassifier,
} from "./industry/industry-classifier.token";
import type { IndustryClassification } from "./industry/industry.types";
import { WaitlistReason } from "@prisma/client";

export type DiscoverValidateSuccess = {
  outcome: "success";
  leadId: string;
  normalizedUrl: string;
  industry: IndustryVertical;
};

export type WaitlistReasonCode =
  | "UNSUPPORTED_INDUSTRY"
  | "FOREIGN_LANGUAGE"
  | "CONTENT_UNREADABLE"
  | "PARKED_DOMAIN";

export type DiscoverValidateWaitlist = {
  outcome: "waitlist";
  logId: string;
  leadId: string;
  normalizedUrl: string;
  domain: string;
  industry: IndustryVertical;
  reason: WaitlistReasonCode;
  message?: string;
};

export type DiscoverValidateBlocked = {
  outcome: "blocked";
  code:
    | "INVALID_URL"
    | "SOCIAL_OR_MARKETPLACE"
    | "PRIVATE_OR_LOCAL_HOST"
    | "BLOCKED_TLD"
    | "BLOCKED_INDUSTRY";
  message: string;
  logId?: string;
};

export type DiscoverValidateOrgClaimed = {
  outcome: "org_claimed";
  message: string;
  domain: string;
  adminEmail: string;
};

export type DiscoverValidateBrandActive = {
  outcome: "brand_active";
  message: string;
  domain: string;
};

export type DiscoverValidateVerificationRequired = {
  outcome: "verification_required";
  message: string;
  domain: string;
  brandProfileId: string;
  reason: "DOMAIN_LIMIT" | "IP_LIMIT";
};

export type DiscoverValidateInfrastructureError = {
  outcome: "infrastructure_error";
  reason: "http_status" | "dns_or_timeout" | "redirect_hijack";
  httpStatus?: number;
  message: string;
  domain: string;
  normalizedUrl: string;
};

export type DiscoverValidateResult =
  | DiscoverValidateSuccess
  | DiscoverValidateWaitlist
  | DiscoverValidateBlocked
  | DiscoverValidateOrgClaimed
  | DiscoverValidateBrandActive
  | DiscoverValidateVerificationRequired
  | DiscoverValidateInfrastructureError;

/** Read-only Step 1 entry check: no `discovery_leads` rows are created here. */
export type DiscoveryResolveResume = {
  outcome: "resume";
  leadId: string;
  normalizedUrl: string;
  industry: IndustryVertical;
  brandProfileId: string;
  domain: string;
};

/**
 * Client should call `POST /api/v1/discovery/validate` next to persist triage and
 * create a lead when appropriate.
 */
export type DiscoveryResolveProceed = {
  outcome: "proceed";
  normalizedUrl: string;
  domain: string;
  industry: IndustryVertical;
};

export type DiscoveryResolveBrandActive = DiscoverValidateBrandActive;
export type DiscoveryResolveVerificationRequired =
  DiscoverValidateVerificationRequired;

export type DiscoveryResolveResult =
  | DiscoveryResolveResume
  | DiscoveryResolveProceed
  | DiscoverValidateBlocked
  | DiscoverValidateOrgClaimed
  | DiscoveryResolveBrandActive
  | DiscoveryResolveVerificationRequired;

@Injectable()
export class BrandOnboardingService {
  private readonly logger = new Logger(BrandOnboardingService.name);
  private readonly industryClassifyCache = new Map<
    string,
    { expiresAt: number; value: IndustryClassification }
  >();
  private static readonly INDUSTRY_CLASSIFY_CACHE_MS = 15 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scanGate: BrandScanGateService,
    private readonly reachability: DiscoveryReachabilityService,
    @Inject(INDUSTRY_CLASSIFIER)
    private readonly industryClassifier: IndustryClassifier,
  ) {}

  /**
   * Lightweight entry resolver for shell routing. Does **not** write gate-failure
   * intel rows (unlike `validateUrl`) to avoid noise from speculative checks.
   */
  async resolveUrl(
    rawUrl: string,
    ctx: { clientIp: string; authenticatedUserId?: string },
  ): Promise<DiscoveryResolveResult> {
    const safe = redactUrlForLogs(rawUrl);
    this.logger.log(
      `discovery.resolve safeUrl=${safe} ip=${this.redactIp(ctx.clientIp)}`,
    );

    const entry = await this.scanGate.evaluateEntry({
      rawUrl,
      clientIp: ctx.clientIp,
      authenticatedUserId: ctx.authenticatedUserId,
    });

    if (entry.kind === "url_blocked" && !entry.reason.ok) {
      return this.mapGateFailure(entry.reason.reason);
    }
    if (entry.kind === "org_claimed") {
      return {
        outcome: "org_claimed",
        message: entry.message,
        domain: entry.domain,
        adminEmail: maskAdminEmail(entry.adminEmail),
      };
    }
    if (entry.kind === "brand_active") {
      return { outcome: "brand_active", ...entry };
    }
    if (entry.kind === "verification_required") {
      return { outcome: "verification_required", ...entry };
    }
    if (entry.kind === "resume") {
      return {
        outcome: "resume",
        leadId: entry.leadId,
        normalizedUrl: entry.normalizedUrl,
        industry: entry.industry,
        brandProfileId: entry.brandProfileId,
        domain: entry.domain,
      };
    }

    if (entry.kind !== "allow") {
      return this.mapGateFailure("INVALID_SYNTAX");
    }

    // Routing-only hint — full Parallel+Gemini gate runs in validateUrl (once).
    const stub = stubClassifyIndustry(entry.hostname);

    return {
      outcome: "proceed",
      normalizedUrl: entry.normalizedUrl,
      domain: entry.domain,
      industry: stub.industry,
    };
  }

  async validateUrl(
    rawUrl: string,
    ctx: { clientIp: string; authenticatedUserId?: string },
  ): Promise<DiscoverValidateResult> {
    const safe = redactUrlForLogs(rawUrl);
    this.logger.log(
      `discovery.validate safeUrl=${safe} ip=${this.redactIp(ctx.clientIp)}`,
    );

    const entry = await this.scanGate.evaluateEntry({
      rawUrl,
      clientIp: ctx.clientIp,
      authenticatedUserId: ctx.authenticatedUserId,
    });

    if (entry.kind === "url_blocked" && !entry.reason.ok) {
      const logId = await this.recordGateFailureIntel(
        entry.reason.reason,
        entry.reason.hostname,
        rawUrl,
      );
      return this.mapGateFailure(entry.reason.reason, logId);
    }
    if (entry.kind === "org_claimed") {
      return {
        outcome: "org_claimed",
        message: entry.message,
        domain: entry.domain,
        adminEmail: maskAdminEmail(entry.adminEmail),
      };
    }
    if (entry.kind === "brand_active") {
      return { outcome: "brand_active", ...entry };
    }
    if (entry.kind === "verification_required") {
      return { outcome: "verification_required", ...entry };
    }

    const gated = gateAndNormalizeBrandUrl(rawUrl);
    if (!gated.ok) {
      const logId = await this.recordGateFailureIntel(
        gated.reason,
        gated.hostname,
        rawUrl,
      );
      return this.mapGateFailure(gated.reason, logId);
    }

    const reach = await this.reachability.probe(gated.normalizedUrl);
    if (!reach.ok) {
      return {
        outcome: "infrastructure_error",
        reason: reach.reason,
        httpStatus: reach.httpStatus,
        message: reach.message,
        domain: gated.hostname,
        normalizedUrl: gated.normalizedUrl,
      };
    }

    if (reach.contentSignal === "parked") {
      return this.emitContentWaitlist({
        rawUrl,
        gated,
        industry: IndustryVertical.UNKNOWN,
        subIndustry: "Parked Domain",
        reason: "PARKED_DOMAIN",
        message:
          "We found a parked or coming-soon page at this address. Leave your email and we'll notify you when storefront evaluation is available for this domain.",
      });
    }
    if (reach.contentSignal === "unreadable") {
      return this.emitContentWaitlist({
        rawUrl,
        gated,
        industry: IndustryVertical.UNKNOWN,
        subIndustry: "Unreadable Content",
        reason: "CONTENT_UNREADABLE",
        message:
          "We couldn't evaluate enough storefront content on this site. Leave your email for updates when content-level scanning improves.",
      });
    }
    if (reach.contentSignal === "foreign_language") {
      return this.emitContentWaitlist({
        rawUrl,
        gated,
        industry: IndustryVertical.UNKNOWN,
        subIndustry: "Foreign Language Storefront",
        reason: "FOREIGN_LANGUAGE",
        message:
          "We've identified a non-English storefront. Creator's Shop currently focuses on English-language brands — leave your email for localization early access.",
      });
    }

    const classified = await this.classifyIndustryCached({
      hostname: gated.hostname,
      normalizedUrl: gated.normalizedUrl,
    });

    const sub = (classified.subIndustry ?? "").toLowerCase();
    if (
      classified.industry === IndustryVertical.UNKNOWN &&
      (sub.includes("foreign") || sub.includes("language"))
    ) {
      return this.emitContentWaitlist({
        rawUrl,
        gated,
        industry: classified.industry,
        subIndustry: classified.subIndustry ?? "Foreign Language Storefront",
        reason: "FOREIGN_LANGUAGE",
        message:
          "We've identified a non-English storefront. Creator's Shop currently focuses on English-language brands — leave your email for localization early access.",
      });
    }
    if (
      classified.industry === IndustryVertical.UNKNOWN &&
      (sub.includes("parked") ||
        sub.includes("unreadable") ||
        sub.includes("coming soon"))
    ) {
      return this.emitContentWaitlist({
        rawUrl,
        gated,
        industry: classified.industry,
        subIndustry: classified.subIndustry ?? "Unreadable Content",
        reason: sub.includes("parked")
          ? "PARKED_DOMAIN"
          : "CONTENT_UNREADABLE",
        message:
          "We couldn't evaluate storefront components for this domain. Leave your email and we'll follow up.",
      });
    }

    if (classified.bucket === "supported") {
      const lead = await this.upsertDiscoveryLeadSession({
        rawUrl: rawUrl.trim(),
        normalizedUrl: gated.normalizedUrl,
        industry: classified.industry,
        subIndustry: classified.subIndustry ?? null,
        isSupported: true,
        status: DiscoveryLeadStatus.IDENTIFIED,
        temporaryPayload: {
          bucket: "supported",
          industry: classified.industry,
          subIndustry: classified.subIndustry ?? null,
          confidence: classified.confidence ?? null,
          classifier: "stage0_gatekeeper",
          pipelineVersion: "stage0_gatekeeper_v1",
        },
        classificationEvidence: `Supported vertical: ${classified.industry}${classified.subIndustry ? ` / ${classified.subIndustry}` : ""}`,
      });
      return {
        outcome: "success",
        leadId: lead.id,
        normalizedUrl: lead.normalizedUrl,
        industry: classified.industry,
      };
    }

    if (classified.bucket === "regret") {
      const log = await this.upsertMarketIntel({
        domainName: gated.hostname,
        industry: classified.industry,
        rejectionType: MarketIntelRejectionType.UNSUPPORTED_NICHE,
      });
      const lead = await this.upsertDiscoveryLeadSession({
        rawUrl: rawUrl.trim(),
        normalizedUrl: gated.normalizedUrl,
        industry: classified.industry,
        subIndustry: classified.subIndustry ?? null,
        isSupported: false,
        status: DiscoveryLeadStatus.REJECTED,
        temporaryPayload: {
          bucket: "regret",
          reason: "UNSUPPORTED_INDUSTRY",
          industry: classified.industry,
          subIndustry: classified.subIndustry ?? null,
          confidence: classified.confidence ?? null,
          marketIntelligenceLogId: log.id,
          classifier: "stage0_gatekeeper",
          pipelineVersion: "stage0_gatekeeper_v1",
        },
        classificationEvidence: `Regret vertical: ${classified.industry}`,
      });
      return {
        outcome: "waitlist",
        logId: log.id,
        leadId: lead.id,
        normalizedUrl: gated.normalizedUrl,
        domain: gated.hostname,
        industry: classified.industry,
        reason: "UNSUPPORTED_INDUSTRY",
      };
    }

    const log = await this.upsertMarketIntel({
      domainName: gated.hostname,
      industry: classified.industry,
      rejectionType: MarketIntelRejectionType.BLOCKED_PLATFORM,
    });
    return {
      outcome: "blocked",
      code: "BLOCKED_INDUSTRY",
      message:
        "This vertical is blocked for automated onboarding. Contact support if you believe this is a mistake.",
      logId: log.id,
    };
  }

  async joinWaitlist(
    dto: DiscoverWaitlistRequestDto,
    ctx: { clientIp: string },
  ): Promise<{ id: string }> {
    const safeSource = dto.sourceUrl
      ? redactUrlForLogs(dto.sourceUrl)
      : undefined;
    this.logger.log(
      `discovery.waitlist email=[redacted] industry=${dto.industry} reason=${dto.reason ?? "-"} domain=${dto.domain ?? "-"} ip=${this.redactIp(ctx.clientIp)}${safeSource ? ` source=${safeSource}` : ""}`,
    );

    if (dto.discoveryLeadId) {
      const lead = await this.prisma.discoveryLead.findUnique({
        where: { id: dto.discoveryLeadId },
        select: { id: true },
      });
      if (!lead) {
        throw new BadRequestException("discoveryLeadId not found");
      }
    }
    if (dto.marketIntelligenceLogId) {
      const log = await this.prisma.marketIntelligenceLog.findUnique({
        where: { id: dto.marketIntelligenceLogId },
        select: { id: true },
      });
      if (!log) {
        throw new BadRequestException("marketIntelligenceLogId not found");
      }
    }

    const row = await this.prisma.waitlistLead.create({
      data: {
        email: dto.email,
        industryInterest: dto.industry,
        domain: dto.domain?.trim() || null,
        reason: dto.reason
          ? (dto.reason as WaitlistReason)
          : WaitlistReason.UNSUPPORTED_INDUSTRY,
        discoveryLeadId: dto.discoveryLeadId,
        marketIntelligenceLogId: dto.marketIntelligenceLogId,
      },
    });
    return { id: row.id };
  }

  private async emitContentWaitlist(args: {
    rawUrl: string;
    gated: { normalizedUrl: string; hostname: string };
    industry: IndustryVertical;
    subIndustry: string;
    reason: WaitlistReasonCode;
    message: string;
  }): Promise<DiscoverValidateWaitlist> {
    const log = await this.upsertMarketIntel({
      domainName: args.gated.hostname,
      industry: args.industry,
      rejectionType: MarketIntelRejectionType.UNSUPPORTED_NICHE,
    });
    const lead = await this.upsertDiscoveryLeadSession({
      rawUrl: args.rawUrl.trim(),
      normalizedUrl: args.gated.normalizedUrl,
      industry: args.industry,
      subIndustry: args.subIndustry,
      isSupported: false,
      status: DiscoveryLeadStatus.REJECTED,
      temporaryPayload: {
        bucket: "regret",
        reason: args.reason,
        industry: args.industry,
        subIndustry: args.subIndustry,
        marketIntelligenceLogId: log.id,
        classifier: "stage0_reachability",
        pipelineVersion: "stage0_gatekeeper_v1",
      },
      classificationEvidence: `${args.reason}: ${args.subIndustry}`.slice(
        0,
        250,
      ),
    });
    return {
      outcome: "waitlist",
      logId: log.id,
      leadId: lead.id,
      normalizedUrl: args.gated.normalizedUrl,
      domain: args.gated.hostname,
      industry: args.industry,
      reason: args.reason,
      message: args.message,
    };
  }

  private async classifyIndustryCached(input: {
    hostname: string;
    normalizedUrl: string;
  }): Promise<IndustryClassification> {
    const key = input.normalizedUrl;
    const cached = this.industryClassifyCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const started = Date.now();
    const value = await this.industryClassifier.classify(input);
    this.logger.log(
      `discovery.industry_classify host=${input.hostname} ms=${Date.now() - started}`,
    );
    this.industryClassifyCache.set(key, {
      expiresAt: Date.now() + BrandOnboardingService.INDUSTRY_CLASSIFY_CACHE_MS,
      value,
    });
    return value;
  }

  private redactIp(ip: string): string {
    if (!ip) {
      return "[unknown]";
    }
    if (ip.includes(":")) {
      return "ipv6:[redacted]";
    }
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.x.x`;
    }
    return "[redacted]";
  }

  private mapGateFailure(
    reason: UrlGateFailureReason,
    logId?: string,
  ): DiscoverValidateBlocked {
    const base = (): DiscoverValidateBlocked => {
      switch (reason) {
        case "INVALID_SYNTAX":
          return {
            outcome: "blocked",
            code: "INVALID_URL",
            message: "Enter a valid brand website URL.",
          };
        case "BLOCKED_SOCIAL_HOST":
          return {
            outcome: "blocked",
            code: "SOCIAL_OR_MARKETPLACE",
            message:
              "Social or marketplace URLs are not supported for brand scans.",
          };
        case "BLOCKED_PRIVATE_HOST":
          return {
            outcome: "blocked",
            code: "PRIVATE_OR_LOCAL_HOST",
            message: "Private or local network addresses cannot be scanned.",
          };
        case "BLOCKED_TLD":
          return {
            outcome: "blocked",
            code: "BLOCKED_TLD",
            message: "This domain type is not accepted for automated scans.",
          };
        case "BLOCKED_RESTRICTED_SEGMENT":
          return {
            outcome: "blocked",
            code: "BLOCKED_TLD",
            message:
              "Access Denied: This target website belongs to a restricted segment, or is not supported by the platform.",
          };
        default:
          return {
            outcome: "blocked",
            code: "INVALID_URL",
            message: "Unable to parse URL.",
          };
      }
    };
    const body = base();
    return logId ? { ...body, logId } : body;
  }

  private domainKeyForIntel(
    hostname: string | undefined,
    rawUrl: string,
  ): string {
    if (hostname && hostname.length > 0) {
      return hostname.slice(0, 255);
    }
    return rawUrl.trim().slice(0, 255) || "unknown";
  }

  private async recordGateFailureIntel(
    reason: UrlGateFailureReason,
    hostname: string | undefined,
    rawUrl: string,
  ): Promise<string | undefined> {
    const domainName = this.domainKeyForIntel(hostname, rawUrl);
    const rejectionType = this.mapGateReasonToRejection(reason);
    try {
      const row = await this.prisma.marketIntelligenceLog.upsert({
        where: { domainName },
        create: {
          domainName,
          detectedIndustry: IndustryVertical.UNKNOWN,
          rejectionType,
        },
        update: {
          attemptCount: { increment: 1 },
          lastAttempt: new Date(),
          rejectionType,
          detectedIndustry: IndustryVertical.UNKNOWN,
        },
      });
      return row.id;
    } catch (err) {
      this.logger.warn(
        `market intelligence upsert failed domain=${domainName} err=${String(err)}`,
      );
      return undefined;
    }
  }

  private mapGateReasonToRejection(
    reason: UrlGateFailureReason,
  ): MarketIntelRejectionType {
    switch (reason) {
      case "BLOCKED_SOCIAL_HOST":
        return MarketIntelRejectionType.BLOCKED_PLATFORM;
      case "BLOCKED_PRIVATE_HOST":
        return MarketIntelRejectionType.SECURITY_RISK;
      case "BLOCKED_TLD":
        return MarketIntelRejectionType.BLOCKED_PLATFORM;
      case "BLOCKED_RESTRICTED_SEGMENT":
        return MarketIntelRejectionType.SECURITY_RISK;
      default:
        return MarketIntelRejectionType.GARBAGE_ENTRY;
    }
  }

  private discoveryLeadExpiresAt(): Date {
    return addDays(new Date(), BRAND_RESUME_PROFILE_MAX_AGE_DAYS);
  }

  private async upsertDiscoveryLeadSession(args: {
    rawUrl: string;
    normalizedUrl: string;
    industry: IndustryVertical;
    subIndustry?: string | null;
    isSupported: boolean;
    status: DiscoveryLeadStatus;
    temporaryPayload: Prisma.InputJsonValue;
    classificationEvidence: string;
  }) {
    const expiresAt = this.discoveryLeadExpiresAt();
    const evidence = args.classificationEvidence.slice(0, 250);
    return this.prisma.discoveryLead.upsert({
      where: { normalizedUrl: args.normalizedUrl },
      create: {
        rawUrl: args.rawUrl,
        normalizedUrl: args.normalizedUrl,
        status: args.status,
        isSupported: args.isSupported,
        industry: args.industry,
        subIndustry: args.subIndustry ?? null,
        securityScore: 0,
        temporaryPayload: args.temporaryPayload,
        expiresAt,
        signupCompleted: false,
        classificationEvidence: evidence,
      },
      update: {
        rawUrl: args.rawUrl,
        status: args.status,
        isSupported: args.isSupported,
        industry: args.industry,
        subIndustry: args.subIndustry ?? null,
        temporaryPayload: args.temporaryPayload,
        expiresAt,
        classificationEvidence: evidence,
      },
    });
  }

  /** @deprecated Use upsertDiscoveryLeadSession — kept for internal resume paths. */
  private async ensureDiscoveryLead(args: {
    rawUrl: string;
    normalizedUrl: string;
    industry: IndustryVertical;
  }) {
    const existing = await this.prisma.discoveryLead.findUnique({
      where: { normalizedUrl: args.normalizedUrl },
    });
    if (existing) {
      return this.prisma.discoveryLead.update({
        where: { id: existing.id },
        data: {
          industry: args.industry,
          isSupported: true,
          status: DiscoveryLeadStatus.IDENTIFIED,
          expiresAt: this.discoveryLeadExpiresAt(),
        },
      });
    }
    try {
      return await this.prisma.discoveryLead.create({
        data: {
          rawUrl: args.rawUrl,
          normalizedUrl: args.normalizedUrl,
          status: DiscoveryLeadStatus.IDENTIFIED,
          isSupported: true,
          industry: args.industry,
          securityScore: 0,
          expiresAt: this.discoveryLeadExpiresAt(),
          signupCompleted: false,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const retry = await this.prisma.discoveryLead.findUnique({
          where: { normalizedUrl: args.normalizedUrl },
        });
        if (retry) {
          return retry;
        }
      }
      throw e;
    }
  }

  private async upsertMarketIntel(args: {
    domainName: string;
    industry: IndustryVertical;
    rejectionType: MarketIntelRejectionType;
  }) {
    return this.prisma.marketIntelligenceLog.upsert({
      where: { domainName: args.domainName },
      create: {
        domainName: args.domainName,
        detectedIndustry: args.industry,
        rejectionType: args.rejectionType,
      },
      update: {
        attemptCount: { increment: 1 },
        lastAttempt: new Date(),
        detectedIndustry: args.industry,
        rejectionType: args.rejectionType,
      },
    });
  }
}
