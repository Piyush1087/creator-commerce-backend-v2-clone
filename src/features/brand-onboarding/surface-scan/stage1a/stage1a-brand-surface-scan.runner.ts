import { IndustryVertical, Prisma, ScanStatus } from "@prisma/client";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../../../prisma/prisma.service";
import { S3Service } from "../../../../shared/s3/s3.service";
import { BrandCentreColdStartService } from "../../../brand-centre/services/brand-centre-cold-start.service";
import { BrandScanGateService } from "../../brand-scan-gate.service";
import { gateAndNormalizeBrandUrl } from "../../discovery-url.util";
import type {
  BrandSurfaceScanRunner,
  SurfaceScanRunResult,
} from "../brand-surface-scan.runner.token";
import { SurfaceScanProgressStore } from "../surface-scan-progress.store";
import { CoreIdentityOrchestratorService } from "./core-identity-orchestrator.service";
import type { CoreIdentitySnapshot } from "./core-identity.schema";

/**
 * Stage 1A surface-scan runner (Zyte + Playwright core identity).
 * Replaces Parallel-backed HttpBrandSurfaceScanRunner for default acquisition.
 * Stage 1B MCP dispatch is deferred until Checkpoint 1 confirmation.
 */
@Injectable()
export class Stage1aBrandSurfaceScanRunner implements BrandSurfaceScanRunner {
  private readonly logger = new Logger(Stage1aBrandSurfaceScanRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scanGate: BrandScanGateService,
    private readonly config: ConfigService,
    private readonly orchestrator: CoreIdentityOrchestratorService,
    private readonly brandCentreColdStart: BrandCentreColdStartService,
    private readonly scanProgress: SurfaceScanProgressStore,
    private readonly s3: S3Service,
  ) {}

  async run(args: {
    leadId: string;
    force?: boolean;
    clientIp: string;
    authenticatedUserId?: string;
  }): Promise<SurfaceScanRunResult> {
    this.scanProgress.begin(args.leadId);
    try {
      const result = await this.runInner(args);
      this.scanProgress.complete(args.leadId);
      return result;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Surface scan failed";
      this.scanProgress.fail(args.leadId, message);
      throw err;
    }
  }

  private async runInner(args: {
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
        this.logger.log(
          `stage1a.cache_hit domain=${domain} brandProfileId=${cached.id}`,
        );
        try {
          await this.brandCentreColdStart.seedFromSurfaceScan(cached.id);
        } catch (coldStartErr: unknown) {
          const message =
            coldStartErr instanceof Error ? coldStartErr.message : "unknown";
          this.logger.error(
            `cold-start.failed brandProfileId=${cached.id} error=${message}`,
          );
        }
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

    await this.scanGate.assertSurfaceScanAllowed({
      domain,
      normalizedUrl: gated.normalizedUrl,
      clientIp: args.clientIp,
      authenticatedUserId: args.authenticatedUserId,
    });

    this.scanProgress.setPhase(args.leadId, "signals");

    const industry =
      lead.industry ?? IndustryVertical.UNKNOWN;
    const subIndustry = lead.subIndustry ?? "General";

    const snapshot = await this.orchestrator.execute({
      scanId: lead.id,
      targetUrl: gated.normalizedUrl,
      gatekeeperIndustry: industry,
      gatekeeperSubIndustry: subIndustry,
    });

    this.scanProgress.setPhase(args.leadId, "persisting");

    const mirroredSnapshot = await this.mirrorBrandLogo(snapshot, domain);
    const socialLinks = socialHandlesToLinks(mirroredSnapshot);
    const existingPayload =
      lead.temporaryPayload &&
      typeof lead.temporaryPayload === "object" &&
      !Array.isArray(lead.temporaryPayload)
        ? (lead.temporaryPayload as Record<string, unknown>)
        : {};

    const profile = await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.brandProfile.upsert({
        where: { domain },
        create: {
          domain,
          name: mirroredSnapshot.brand_name.value,
          industry,
          subIndustry: mirroredSnapshot.sub_industry.value,
          logoUrl: mirroredSnapshot.brand_logo.value,
          tagline: mirroredSnapshot.tagline.value,
          socialLinks,
          countryCode: mirroredSnapshot.country.value,
          currencyCode: mirroredSnapshot.reporting_currency.value,
          scanStatus: ScanStatus.SURFACE_COMPLETE,
        },
        update: {
          name: mirroredSnapshot.brand_name.value,
          industry,
          subIndustry: mirroredSnapshot.sub_industry.value,
          logoUrl: mirroredSnapshot.brand_logo.value,
          tagline: mirroredSnapshot.tagline.value,
          socialLinks,
          countryCode: mirroredSnapshot.country.value,
          currencyCode: mirroredSnapshot.reporting_currency.value,
          scanStatus: ScanStatus.SURFACE_COMPLETE,
        },
      });

      await tx.discoveryLead.update({
        where: { id: lead.id },
        data: {
          subIndustry: mirroredSnapshot.sub_industry.value,
          temporaryPayload: {
            ...existingPayload,
            stage1a: mirroredSnapshot as unknown as Prisma.InputJsonValue,
            stage1aCompletedAt: new Date().toISOString(),
            // Stage 1B remains scaffolded; MCP dispatch waits for
            // Checkpoint 1 confirmation in a later phase.
            stage1b: {
              status: "AWAITING_IDENTITY_CONFIRMATION",
              deferred: true,
            },
          } as Prisma.InputJsonValue,
        },
      });

      return upserted;
    });

    await this.scanGate.recordVendorSurfaceScan({
      domain,
      clientIp: args.clientIp,
      discoveryLeadId: lead.id,
      brandProfileId: profile.id,
    });

    try {
      await this.brandCentreColdStart.seedFromSurfaceScan(profile.id);
    } catch (coldStartErr: unknown) {
      const message =
        coldStartErr instanceof Error ? coldStartErr.message : "unknown";
      this.logger.error(
        `cold-start.failed brandProfileId=${profile.id} error=${message}`,
      );
    }

    const counts = await this.prisma.brandProfile.findUnique({
      where: { id: profile.id },
      select: {
        _count: {
          select: { offerings: true, competitors: true, locations: true },
        },
      },
    });

    return {
      brandProfileId: profile.id,
      domain,
      mode: "http",
      counts: {
        offerings: counts?._count.offerings ?? 0,
        competitors: counts?._count.competitors ?? 0,
        locations: counts?._count.locations ?? 0,
      },
    };
  }

  private async mirrorBrandLogo(
    snapshot: CoreIdentitySnapshot,
    domain: string,
  ): Promise<CoreIdentitySnapshot> {
    const logoUrl = snapshot.brand_logo.value;
    if (!logoUrl || !this.s3.isConfigured()) {
      return snapshot;
    }
    try {
      const mirrored = await this.s3.mirrorRemoteAssetToS3({
        url: logoUrl,
        directory: `brand-onboarding/${domain}/logo`,
        filename: "brand-logo",
      });
      return {
        ...snapshot,
        brand_logo: {
          ...snapshot.brand_logo,
          value: mirrored.publicUrl,
          evidence: [
            ...snapshot.brand_logo.evidence,
            {
              page_url: logoUrl,
              page_type: "asset_mirror",
              excerpt: `Mirrored logo to S3: ${mirrored.publicUrl}`,
            },
          ],
        },
      };
    } catch (err) {
      this.logger.warn(
        `stage1a.logo_mirror_failed domain=${domain} err=${err instanceof Error ? err.message : String(err)}`,
      );
      return snapshot;
    }
  }
}

function socialHandlesToLinks(snapshot: CoreIdentitySnapshot): string[] {
  const h = snapshot.social_handles.value;
  return [h.instagram, h.tiktok, h.facebook, h.youtube, h.linkedin].filter(
    (v): v is string => Boolean(v),
  );
}
