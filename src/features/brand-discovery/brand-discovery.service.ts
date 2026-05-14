import { Injectable, Logger } from "@nestjs/common";
import {
  DiscoveryLeadStatus,
  IndustryVertical,
  MarketIntelRejectionType,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { stubClassifyIndustry } from "./discovery-industry.stub";
import { redactUrlForLogs } from "./discovery-redaction";
import {
  gateAndNormalizeBrandUrl,
  type UrlGateFailureReason,
} from "./discovery-url.util";

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

export type DiscoverValidateResult =
  | DiscoverValidateSuccess
  | DiscoverValidateWaitlist
  | DiscoverValidateBlocked;

@Injectable()
export class BrandDiscoveryService {
  private readonly logger = new Logger(BrandDiscoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    const stub = stubClassifyIndustry(gated.hostname);

    if (stub.bucket === "supported") {
      const lead = await this.ensureDiscoveryLead({
        rawUrl: rawUrl.trim(),
        normalizedUrl: gated.normalizedUrl,
        industry: stub.industry,
      });
      return {
        outcome: "success",
        leadId: lead.id,
        normalizedUrl: lead.normalizedUrl,
        industry: stub.industry,
      };
    }

    if (stub.bucket === "regret") {
      const log = await this.upsertMarketIntel({
        domainName: gated.hostname,
        industry: stub.industry,
        rejectionType: MarketIntelRejectionType.UNSUPPORTED_NICHE,
      });
      return {
        outcome: "waitlist",
        logId: log.id,
        normalizedUrl: gated.normalizedUrl,
        domain: gated.hostname,
        industry: stub.industry,
      };
    }

    const log = await this.upsertMarketIntel({
      domainName: gated.hostname,
      industry: stub.industry,
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
