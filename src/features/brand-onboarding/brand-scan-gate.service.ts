import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  IndustryVertical,
  ScanStatus,
  SurfaceScanAttemptKind,
} from "@prisma/client";
import { subDays } from "date-fns";

import { PrismaService } from "../../prisma/prisma.service";
import {
  BRAND_RESUME_PROFILE_MAX_AGE_DAYS,
  BRAND_SCAN_LIMIT_MAX_PER_WINDOW,
  BRAND_SCAN_LIMIT_WINDOW_DAYS,
  isBrandScanLimitsEnabled,
  scanGateVerificationMessage,
} from "./brand-scan-gate.config";
import type { BrandScanGateResult } from "./brand-scan-gate.types";
import { gateAndNormalizeBrandUrl } from "./discovery-url.util";

const BRAND_ACTIVE_MESSAGE =
  "An account for this domain already exists. If you are the owner, please sign in.";

@Injectable()
export class BrandScanGateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  limitsEnabled(): boolean {
    return isBrandScanLimitsEnabled(
      this.config.get<string>("STAGE"),
      this.config.get<string>("BRAND_SCAN_LIMITS_ENABLED"),
    );
  }

  /**
   * Priority: org_claimed → brand_active (isVerified, no team user) →
   * verification_required (limits) → resume → allow.
   */
  async evaluateEntry(args: {
    rawUrl: string;
    clientIp: string;
    /** When set, owner can continue funnel (resume) instead of brand_active. */
    authenticatedUserId?: string;
  }): Promise<
    | BrandScanGateResult
    | {
        kind: "url_blocked";
        reason: ReturnType<typeof gateAndNormalizeBrandUrl>;
      }
  > {
    const gated = gateAndNormalizeBrandUrl(args.rawUrl);
    if (!gated.ok) {
      return { kind: "url_blocked", reason: gated };
    }

    const { hostname, normalizedUrl } = gated;

    const orgClaimed = await this.findOrgClaimedContact(
      hostname,
      normalizedUrl,
    );
    if (orgClaimed) {
      return {
        kind: "org_claimed",
        message:
          "This brand domain is already set up. Ask your organization admin for an invitation to join the team.",
        domain: hostname,
        adminEmail: orgClaimed,
      };
    }

    const profile = await this.prisma.brandProfile.findUnique({
      where: { domain: hostname },
      select: {
        id: true,
        isVerified: true,
        verificationEmail: true,
        organizationId: true,
        scanStatus: true,
        industry: true,
        createdAt: true,
      },
    });

    if (profile?.isVerified) {
      const canContinueAsOwner = await this.userMayContinueVerifiedProfile(
        profile.id,
        profile.verificationEmail,
        profile.organizationId,
        args.authenticatedUserId,
      );
      if (!canContinueAsOwner) {
        return {
          kind: "brand_active",
          message: BRAND_ACTIVE_MESSAGE,
          domain: hostname,
        };
      }
    }

    if (this.limitsEnabled() && profile) {
      const limitHit = await this.findScanLimitExceeded(
        hostname,
        args.clientIp,
      );
      if (limitHit && !profile.isVerified) {
        return {
          kind: "verification_required",
          message: scanGateVerificationMessage(limitHit, hostname),
          domain: hostname,
          brandProfileId: profile.id,
          reason: limitHit,
        };
      }
      if (limitHit && profile.isVerified) {
        return {
          kind: "brand_active",
          message: BRAND_ACTIVE_MESSAGE,
          domain: hostname,
        };
      }
    }

    const resume = await this.tryResume({
      hostname,
      normalizedUrl,
      profile,
      authenticatedUserId: args.authenticatedUserId,
    });
    if (resume) {
      return resume;
    }

    return {
      kind: "allow",
      domain: hostname,
      hostname,
      normalizedUrl,
    };
  }

  /** Enforce before a vendor surface-scan run (not on cache hits). */
  async assertSurfaceScanAllowed(args: {
    domain: string;
    normalizedUrl: string;
    clientIp: string;
    brandProfileId?: string;
    authenticatedUserId?: string;
  }): Promise<void> {
    const orgClaimed = await this.findOrgClaimedContact(
      args.domain,
      args.normalizedUrl,
    );
    if (orgClaimed) {
      throw new BrandScanGateException({
        kind: "org_claimed",
        message:
          "This brand domain is already set up. Ask your organization admin for an invitation to join the team.",
        domain: args.domain,
        adminEmail: orgClaimed,
      });
    }

    const profile =
      args.brandProfileId != null
        ? await this.prisma.brandProfile.findUnique({
            where: { id: args.brandProfileId },
            select: {
              id: true,
              domain: true,
              isVerified: true,
              verificationEmail: true,
              organizationId: true,
            },
          })
        : await this.prisma.brandProfile.findUnique({
            where: { domain: args.domain },
            select: {
              id: true,
              isVerified: true,
              verificationEmail: true,
              organizationId: true,
            },
          });

    if (profile?.isVerified) {
      const canContinue = await this.userMayContinueVerifiedProfile(
        profile.id,
        profile.verificationEmail,
        profile.organizationId,
        args.authenticatedUserId,
      );
      if (!canContinue) {
        throw new BrandScanGateException({
          kind: "brand_active",
          message: BRAND_ACTIVE_MESSAGE,
          domain: args.domain,
        });
      }
    }

    if (this.limitsEnabled()) {
      const limitHit = await this.findScanLimitExceeded(
        args.domain,
        args.clientIp,
      );
      if (limitHit) {
        const profileId = profile?.id ?? args.brandProfileId;
        if (!profileId) {
          throw new BrandScanGateException({
            kind: "verification_required",
            message: scanGateVerificationMessage(limitHit, args.domain),
            domain: args.domain,
            brandProfileId: "",
            reason: limitHit,
          });
        }
        if (!profile?.isVerified) {
          throw new BrandScanGateException({
            kind: "verification_required",
            message: scanGateVerificationMessage(limitHit, args.domain),
            domain: args.domain,
            brandProfileId: profileId,
            reason: limitHit,
          });
        }
        throw new BrandScanGateException({
          kind: "brand_active",
          message: BRAND_ACTIVE_MESSAGE,
          domain: args.domain,
        });
      }
    }
  }

  async recordVendorSurfaceScan(args: {
    domain: string;
    clientIp: string;
    discoveryLeadId?: string;
    brandProfileId?: string;
  }): Promise<void> {
    await this.prisma.surfaceScanAttempt.create({
      data: {
        domain: args.domain,
        clientIp: args.clientIp || "unknown",
        discoveryLeadId: args.discoveryLeadId,
        brandProfileId: args.brandProfileId,
        kind: SurfaceScanAttemptKind.SURFACE_VENDOR,
      },
    });
  }

  private windowStart(): Date {
    return subDays(new Date(), BRAND_SCAN_LIMIT_WINDOW_DAYS);
  }

  private async countVendorScansForDomain(domain: string): Promise<number> {
    return this.prisma.surfaceScanAttempt.count({
      where: {
        domain,
        kind: SurfaceScanAttemptKind.SURFACE_VENDOR,
        createdAt: { gte: this.windowStart() },
      },
    });
  }

  private async countVendorScansForIp(clientIp: string): Promise<number> {
    return this.prisma.surfaceScanAttempt.count({
      where: {
        clientIp: clientIp || "unknown",
        kind: SurfaceScanAttemptKind.SURFACE_VENDOR,
        createdAt: { gte: this.windowStart() },
      },
    });
  }

  private async findScanLimitExceeded(
    domain: string,
    clientIp: string,
  ): Promise<"DOMAIN_LIMIT" | "IP_LIMIT" | null> {
    const [domainCount, ipCount] = await Promise.all([
      this.countVendorScansForDomain(domain),
      this.countVendorScansForIp(clientIp),
    ]);
    if (domainCount > BRAND_SCAN_LIMIT_MAX_PER_WINDOW) {
      return "DOMAIN_LIMIT";
    }
    if (ipCount > BRAND_SCAN_LIMIT_MAX_PER_WINDOW) {
      return "IP_LIMIT";
    }
    return null;
  }

  private async findOrgClaimedContact(
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

  private async userMayContinueVerifiedProfile(
    brandProfileId: string,
    verificationEmail: string | null,
    organizationId: string | null,
    authenticatedUserId?: string,
  ): Promise<boolean> {
    if (!authenticatedUserId) {
      return false;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: authenticatedUserId },
      select: { email: true, organizationId: true },
    });
    if (!user) {
      return false;
    }
    if (organizationId && user.organizationId === organizationId) {
      return true;
    }
    if (
      verificationEmail &&
      user.email.toLowerCase() === verificationEmail.toLowerCase()
    ) {
      return true;
    }
    return false;
  }

  private async tryResume(args: {
    hostname: string;
    normalizedUrl: string;
    profile: {
      id: string;
      isVerified: boolean;
      scanStatus: ScanStatus;
      industry: IndustryVertical;
      createdAt: Date;
    } | null;
    authenticatedUserId?: string;
  }): Promise<BrandScanGateResult | null> {
    if (
      !args.profile ||
      args.profile.isVerified ||
      args.profile.scanStatus !== ScanStatus.SURFACE_COMPLETE
    ) {
      return null;
    }

    const minCreatedAt = subDays(new Date(), BRAND_RESUME_PROFILE_MAX_AGE_DAYS);
    if (args.profile.createdAt < minCreatedAt) {
      return null;
    }

    const lead = await this.prisma.discoveryLead.findUnique({
      where: { normalizedUrl: args.normalizedUrl },
    });
    if (!lead) {
      return null;
    }

    return {
      kind: "resume",
      leadId: lead.id,
      normalizedUrl: args.normalizedUrl,
      industry: lead.industry ?? args.profile.industry,
      brandProfileId: args.profile.id,
      domain: args.hostname,
    };
  }
}

export class BrandScanGateException extends Error {
  readonly gate: Exclude<BrandScanGateResult, { kind: "allow" }>;

  constructor(gate: Exclude<BrandScanGateResult, { kind: "allow" }>) {
    super(gate.kind);
    this.gate = gate;
  }
}
