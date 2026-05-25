import { ScanStatus } from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../../prisma/prisma.service";
import { gateAndNormalizeBrandUrl } from "../discovery-url.util";
import type {
  BrandSurfaceScanRunner,
  SurfaceScanRunResult,
} from "./brand-surface-scan.runner.token";

/** Prefix consumed by `BrandController` to map to HTTP 503. */
export const SURFACE_SCAN_NOT_CONFIGURED_PREFIX =
  "[surface_scan_not_configured] " as const;

/**
 * When vendor keys are absent (and stub is not forced), refuse **new** scans but still
 * allow **cache hits** so existing `SURFACE_COMPLETE` profiles remain reachable in the UI.
 */
@Injectable()
export class UnconfiguredBrandSurfaceScanRunner implements BrandSurfaceScanRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async run(args: {
    leadId: string;
    force?: boolean;
    clientIp: string;
    authenticatedUserId?: string;
  }): Promise<SurfaceScanRunResult> {
    const lead = await this.prisma.discoveryLead.findUnique({
      where: { id: args.leadId },
    });
    if (!lead) {
      throw new Error("Discovery lead not found");
    }
    if (!lead.isSupported) {
      throw new Error("Discovery lead is not supported for scanning");
    }
    const gated = gateAndNormalizeBrandUrl(lead.normalizedUrl);
    if (!gated.ok) {
      throw new Error("Discovery lead URL failed gate");
    }
    const domain = gated.hostname;

    const forceRefresh =
      args.force === true ||
      this.config.get<string>("BRAND_SCAN_FORCE_REFRESH")?.trim() === "true";
    if (!forceRefresh) {
      const cached = await this.prisma.brandProfile.findUnique({
        where: { domain },
        select: {
          id: true,
          scanStatus: true,
          _count: {
            select: {
              offerings: true,
              competitors: true,
              locations: true,
            },
          },
        },
      });
      if (cached?.scanStatus === ScanStatus.SURFACE_COMPLETE) {
        return {
          brandProfileId: cached.id,
          domain,
          mode: "cached",
          counts: {
            offerings: cached._count.offerings,
            competitors: cached._count.competitors,
            locations: cached._count.locations,
          },
        };
      }
    }

    throw new Error(
      `${SURFACE_SCAN_NOT_CONFIGURED_PREFIX}` +
        "Surface scan requires PARALLEL_API_KEY and GEMINI_API_KEY to be set on the server.",
    );
  }
}
