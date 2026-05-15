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

import { PrismaService } from "../../prisma/prisma.service";
import type { DiscoverWaitlistRequestDto } from "./dto/discover-waitlist-request.dto";
import { redactUrlForLogs } from "./discovery-redaction";
import {
  gateAndNormalizeBrandUrl,
  type UrlGateFailureReason,
} from "./discovery-url.util";
import {
  INDUSTRY_CLASSIFIER,
  type IndustryClassifier,
} from "./industry/industry-classifier.token";

export type DiscoverValidateSuccess = {
  outcome: "success";
  leadId: string;
  normalizedUrl: string;
  industry: IndustryVertical;
};

export type DiscoverValidateWaitlist = {
  outcome: "waitlist";
  logId: string;
  normalizedUrl: string;
  domain: string;
  industry: IndustryVertical;
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

export type DiscoverValidateResult =
  | DiscoverValidateSuccess
  | DiscoverValidateWaitlist
  | DiscoverValidateBlocked
  | DiscoverValidateOrgClaimed;

/** Present on `outcome: "resume"` when a `BrandProfile` row already exists for the apex domain. */
export type DiscoveryResolveExistingBrandProfile = {
  brandProfileId: string;
  name: string;
  scanStatus: string;
  tagline: string | null;
  descriptionPreview: string | null;
  offerings: number;
  competitors: number;
  locations: number;
};

/** Read-only Step 1 entry check: no `discovery_leads` rows are created here. */
export type DiscoveryResolveResume = {
  outcome: "resume";
  leadId: string;
  normalizedUrl: string;
  industry: IndustryVertical;
  existingBrandProfile?: DiscoveryResolveExistingBrandProfile;
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

export type DiscoveryResolveResult =
  | DiscoveryResolveResume
  | DiscoveryResolveProceed
  | DiscoverValidateBlocked
  | DiscoverValidateOrgClaimed;

@Injectable()
export class BrandOnboardingService {
  private readonly logger = new Logger(BrandOnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(INDUSTRY_CLASSIFIER)
    private readonly industryClassifier: IndustryClassifier,
  ) {}

  /**
   * Lightweight entry resolver for shell routing. Does **not** write gate-failure
   * intel rows (unlike `validateUrl`) to avoid noise from speculative checks.
   */
  async resolveUrl(
    rawUrl: string,
    ctx: { clientIp: string },
  ): Promise<DiscoveryResolveResult> {
    const safe = redactUrlForLogs(rawUrl);
    this.logger.log(
      `discovery.resolve safeUrl=${safe} ip=${this.redactIp(ctx.clientIp)}`,
    );

    const gated = gateAndNormalizeBrandUrl(rawUrl);
    if (!gated.ok) {
      return this.mapGateFailure(gated.reason);
    }

    const claimedContact = await this.findClaimedOrganizationContact(
      gated.hostname,
      gated.normalizedUrl,
    );
    if (claimedContact) {
      return {
        outcome: "org_claimed",
        message:
          "This brand domain is already set up. Ask your organization admin for an invitation to join the team.",
        domain: gated.hostname,
        adminEmail: claimedContact,
      };
    }

    const classified = await this.industryClassifier.classify({
      hostname: gated.hostname,
      normalizedUrl: gated.normalizedUrl,
    });

    if (classified.bucket === "supported") {
      const lead = await this.prisma.discoveryLead.findUnique({
        where: { normalizedUrl: gated.normalizedUrl },
      });
      if (lead) {
        const existingProfile = await this.prisma.brandProfile.findUnique({
          where: { domain: gated.hostname },
          select: {
            id: true,
            name: true,
            scanStatus: true,
            tagline: true,
            description: true,
            _count: {
              select: {
                offerings: true,
                competitors: true,
                locations: true,
              },
            },
          },
        });
        const existingBrandProfile = existingProfile
          ? {
              brandProfileId: existingProfile.id,
              name: existingProfile.name,
              scanStatus: existingProfile.scanStatus,
              tagline: existingProfile.tagline,
              descriptionPreview: existingProfile.description
                ? existingProfile.description.slice(0, 280)
                : null,
              offerings: existingProfile._count.offerings,
              competitors: existingProfile._count.competitors,
              locations: existingProfile._count.locations,
            }
          : undefined;
        return {
          outcome: "resume",
          leadId: lead.id,
          normalizedUrl: lead.normalizedUrl,
          industry: lead.industry ?? classified.industry,
          ...(existingBrandProfile ? { existingBrandProfile } : {}),
        };
      }
      return {
        outcome: "proceed",
        normalizedUrl: gated.normalizedUrl,
        domain: gated.hostname,
        industry: classified.industry,
      };
    }

    return {
      outcome: "proceed",
      normalizedUrl: gated.normalizedUrl,
      domain: gated.hostname,
      industry: classified.industry,
    };
  }

  async validateUrl(
    rawUrl: string,
    ctx: { clientIp: string },
  ): Promise<DiscoverValidateResult> {
    const safe = redactUrlForLogs(rawUrl);
    this.logger.log(
      `discovery.validate safeUrl=${safe} ip=${this.redactIp(ctx.clientIp)}`,
    );

    const gated = gateAndNormalizeBrandUrl(rawUrl);
    if (!gated.ok) {
      const logId = await this.recordGateFailureIntel(
        gated.reason,
        gated.hostname,
        rawUrl,
      );
      return this.mapGateFailure(gated.reason, logId);
    }

    const claimedContact = await this.findClaimedOrganizationContact(
      gated.hostname,
      gated.normalizedUrl,
    );
    if (claimedContact) {
      return {
        outcome: "org_claimed",
        message:
          "This brand domain is already set up. Ask your organization admin for an invitation to join the team.",
        domain: gated.hostname,
        adminEmail: claimedContact,
      };
    }

    const classified = await this.industryClassifier.classify({
      hostname: gated.hostname,
      normalizedUrl: gated.normalizedUrl,
    });

    if (classified.bucket === "supported") {
      const lead = await this.ensureDiscoveryLead({
        rawUrl: rawUrl.trim(),
        normalizedUrl: gated.normalizedUrl,
        industry: classified.industry,
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
      return {
        outcome: "waitlist",
        logId: log.id,
        normalizedUrl: gated.normalizedUrl,
        domain: gated.hostname,
        industry: classified.industry,
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
      `discovery.waitlist email=[redacted] industry=${dto.industry} ip=${this.redactIp(ctx.clientIp)}${safeSource ? ` source=${safeSource}` : ""}`,
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
        discoveryLeadId: dto.discoveryLeadId,
        marketIntelligenceLogId: dto.marketIntelligenceLogId,
      },
    });
    return { id: row.id };
  }

  private async findClaimedOrganizationContact(
    hostname: string,
    normalizedUrl: string,
  ): Promise<string | null> {
    const profile = await this.prisma.brandProfile.findFirst({
      where: {
        OR: [{ domain: hostname }, { domain: normalizedUrl }],
      },
      select: {
        isVerified: true,
        organizationId: true,
      },
    });
    if (!profile?.organizationId || !profile.isVerified) {
      return null;
    }
    const user = await this.prisma.user.findFirst({
      where: { organizationId: profile.organizationId },
      orderBy: { createdAt: "asc" },
      select: { email: true },
    });
    return user?.email ?? null;
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
      default:
        return MarketIntelRejectionType.GARBAGE_ENTRY;
    }
  }

  private async ensureDiscoveryLead(args: {
    rawUrl: string;
    normalizedUrl: string;
    industry: IndustryVertical;
  }) {
    const existing = await this.prisma.discoveryLead.findUnique({
      where: { normalizedUrl: args.normalizedUrl },
    });
    if (existing) {
      return existing;
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
