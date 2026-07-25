import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  BrandIntelligenceStage,
  IndustryVertical,
  type Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import { BrandIntelligenceJobService } from "../../brand-intelligence-job.service";
import type { ConfirmIdentityBody } from "./confirm-identity.schema";
import {
  CoreIdentitySnapshotSchema,
  type CoreIdentitySnapshot,
} from "./core-identity.schema";

type FieldEvidence = {
  page_url: string;
  page_type: string;
  excerpt: string;
};

type UniversalWrapper<T> = {
  value: T;
  confidence: number;
  evidence: FieldEvidence[];
  source: "AI" | "USER" | "SYSTEM" | "CRAWLER" | "ZYTE" | "PLAYWRIGHT";
  edited: boolean;
};

/**
 * Checkpoint 1 confirmation (Phase 4).
 * Builds authoritative_identity from Stage 1A + user overrides, syncs
 * BrandProfile flat fields, then enqueues a durable Stage 1B→2 job.
 */
@Injectable()
export class CoreIdentityConfirmationService {
  private readonly logger = new Logger(CoreIdentityConfirmationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligenceJobs: BrandIntelligenceJobService,
  ) {}

  async confirm(
    leadId: string,
    body: ConfirmIdentityBody,
  ): Promise<{ success: true; nextStage: "STAGE_1B_QUEUED" }> {
    const startedAt = Date.now();
    this.logger.log(
      `confirm.start leadId=${leadId} industry=${body.industry} sub=${body.sub_industry}`,
    );

    const scan = await this.prisma.brandIntelligenceScan.findUnique({
      where: { discoveryLeadId: leadId },
    });

    let stage1a: CoreIdentitySnapshot | null = null;
    let brandProfileId: string | null = scan?.brandProfileId ?? null;
    let websiteUrl = scan?.websiteUrl ?? "";

    if (scan?.stage1aSnapshot) {
      const parsed = CoreIdentitySnapshotSchema.safeParse(scan.stage1aSnapshot);
      if (parsed.success) {
        stage1a = parsed.data;
      }
    }

    // Fallback to temporaryPayload when scan row is missing (legacy Stage 1A).
    if (!stage1a) {
      const lead = await this.prisma.discoveryLead.findUnique({
        where: { id: leadId },
        select: { temporaryPayload: true, normalizedUrl: true },
      });
      if (!lead) {
        throw new NotFoundException("Discovery lead not found");
      }
      websiteUrl = lead.normalizedUrl;
      const payload =
        lead.temporaryPayload &&
        typeof lead.temporaryPayload === "object" &&
        !Array.isArray(lead.temporaryPayload)
          ? (lead.temporaryPayload as Record<string, unknown>)
          : null;
      const parsed = CoreIdentitySnapshotSchema.safeParse(payload?.stage1a);
      if (!parsed.success) {
        throw new NotFoundException(
          "Stage 1A core identity snapshot is not available for this lead.",
        );
      }
      stage1a = parsed.data;
      try {
        const host = new URL(lead.normalizedUrl).hostname.replace(/^www\./, "");
        const profile = await this.prisma.brandProfile.findUnique({
          where: { domain: host },
          select: { id: true },
        });
        brandProfileId = profile?.id ?? null;
      } catch {
        brandProfileId = null;
      }
    }

    if (
      scan &&
      scan.currentStage !== BrandIntelligenceStage.STAGE_1A_COMPLETE &&
      scan.currentStage !== BrandIntelligenceStage.STAGE_1A_FAILED_FALLBACK &&
      scan.currentStage !== BrandIntelligenceStage.CORE_IDENTITY_APPROVED
    ) {
      // Allow re-confirm from STAGE_1A / fallback / already approved; reject mid-pipeline.
      if (
        scan.currentStage === BrandIntelligenceStage.STAGE_1B_COMPLETE ||
        scan.currentStage ===
          BrandIntelligenceStage.STAGE_2_BRAND_DNA_COMPLETE ||
        scan.currentStage === BrandIntelligenceStage.STAGE_2_BRAND_DNA_ARCHIVED
      ) {
        throw new BadRequestException(
          `Identity already confirmed (stage=${scan.currentStage}).`,
        );
      }
    }

    const authoritative = this.buildAuthoritativeIdentity(stage1a, body);

    const scanId =
      scan?.id ??
      (
        await this.prisma.brandIntelligenceScan.upsert({
          where: { discoveryLeadId: leadId },
          create: {
            discoveryLeadId: leadId,
            brandProfileId,
            websiteUrl: websiteUrl || stage1a.website_url.value,
            currentStage: BrandIntelligenceStage.CORE_IDENTITY_APPROVED,
            stage1aSnapshot: stage1a as unknown as Prisma.InputJsonValue,
            authoritativeIdentity:
              authoritative as unknown as Prisma.InputJsonValue,
          },
          update: {
            brandProfileId,
            currentStage: BrandIntelligenceStage.CORE_IDENTITY_APPROVED,
            authoritativeIdentity:
              authoritative as unknown as Prisma.InputJsonValue,
            errorLogs: null,
          },
        })
      ).id;

    if (scan) {
      await this.prisma.brandIntelligenceScan.update({
        where: { id: scan.id },
        data: {
          brandProfileId,
          currentStage: BrandIntelligenceStage.CORE_IDENTITY_APPROVED,
          authoritativeIdentity:
            authoritative as unknown as Prisma.InputJsonValue,
          errorLogs: null,
        },
      });
    }

    if (brandProfileId) {
      await this.syncBrandProfile(brandProfileId, body, authoritative);
    }

    const overrides = [
      authoritative.brand_name.edited ? "name" : null,
      authoritative.brand_logo.edited ? "logo" : null,
      authoritative.industry.edited ? "industry" : null,
      authoritative.sub_industry.edited ? "sub_industry" : null,
      authoritative.tagline.edited ? "tagline" : null,
      authoritative.social_handles.edited ? "socials" : null,
    ].filter(Boolean);

    this.logger.log(
      `confirm.ok leadId=${leadId} scanId=${scanId} brandProfileId=${brandProfileId ?? "-"} overrides=${overrides.length ? overrides.join(",") : "none"} ms=${Date.now() - startedAt} → STAGE_1B_QUEUED`,
    );

    await this.intelligenceJobs.enqueueStage1bPipeline({
      leadId,
      brandProfileId: brandProfileId ?? undefined,
      scanId,
      authoritativeIdentity: authoritative,
    });

    return { success: true, nextStage: "STAGE_1B_QUEUED" };
  }

  private buildAuthoritativeIdentity(
    original: CoreIdentitySnapshot,
    body: ConfirmIdentityBody,
  ): CoreIdentitySnapshot {
    return {
      scan_id: original.scan_id,
      website_url: original.website_url,
      country: original.country,
      reporting_currency: original.reporting_currency,
      discovered_root_links: original.discovered_root_links,
      logo_candidates: original.logo_candidates,
      brand_name: this.resolveScalar(
        original.brand_name,
        body.brand_name,
        "brand name",
      ),
      brand_logo: this.resolveScalar(
        original.brand_logo,
        body.brand_logo,
        "brand logo",
      ),
      industry: this.resolveScalar(
        original.industry,
        body.industry,
        "industry",
      ),
      sub_industry: this.resolveScalar(
        original.sub_industry,
        body.sub_industry,
        "sub-industry",
      ),
      tagline: this.resolveScalar(original.tagline, body.tagline, "tagline"),
      social_handles: this.resolveSocialHandles(
        original.social_handles,
        body.social_handles,
      ),
    };
  }

  private resolveScalar<T>(
    original: UniversalWrapper<T>,
    submitted: T,
    label: string,
  ): UniversalWrapper<T> {
    const unchanged =
      JSON.stringify(original.value) === JSON.stringify(submitted);
    if (unchanged) {
      return original;
    }
    return {
      value: submitted,
      confidence: 100,
      evidence: [
        ...original.evidence,
        {
          page_url: "user_override",
          page_type: "input_form",
          excerpt: `User overrode ${label} from "${String(original.value ?? "")}"`,
        },
      ],
      source: "USER",
      edited: true,
    };
  }

  private resolveSocialHandles(
    original: CoreIdentitySnapshot["social_handles"],
    submitted: ConfirmIdentityBody["social_handles"],
  ): CoreIdentitySnapshot["social_handles"] {
    const edited = JSON.stringify(original.value) !== JSON.stringify(submitted);
    if (!edited) {
      return original;
    }
    return {
      value: {
        instagram: submitted.instagram,
        tiktok: submitted.tiktok,
        facebook: submitted.facebook,
        youtube: submitted.youtube,
        linkedin: submitted.linkedin,
      },
      confidence: 100,
      evidence: [
        ...original.evidence,
        {
          page_url: "user_override",
          page_type: "input_form",
          excerpt: "User overrode social handles.",
        },
      ],
      source: "USER",
      edited: true,
    };
  }

  private async syncBrandProfile(
    brandProfileId: string,
    body: ConfirmIdentityBody,
    authoritative: CoreIdentitySnapshot,
  ): Promise<void> {
    const socialLinks = [
      body.social_handles.instagram,
      body.social_handles.tiktok,
      body.social_handles.facebook,
      body.social_handles.youtube,
      body.social_handles.linkedin,
    ].filter((v): v is string => Boolean(v));

    const existing = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { isUserEdited: true },
    });
    const priorEdited =
      existing?.isUserEdited &&
      typeof existing.isUserEdited === "object" &&
      !Array.isArray(existing.isUserEdited)
        ? (existing.isUserEdited as Record<string, unknown>)
        : {};

    const editedFlags: Record<string, unknown> = { ...priorEdited };
    if (authoritative.brand_name.edited) editedFlags.name = true;
    if (authoritative.brand_logo.edited) editedFlags.logoUrl = true;
    if (authoritative.industry.edited) editedFlags.industry = true;
    if (authoritative.sub_industry.edited) editedFlags.subIndustry = true;
    if (authoritative.tagline.edited) editedFlags.tagline = true;
    if (authoritative.social_handles.edited) editedFlags.socialLinks = true;

    await this.prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: {
        name: body.brand_name,
        logoUrl: body.brand_logo,
        industry: body.industry as IndustryVertical,
        subIndustry: body.sub_industry,
        tagline: body.tagline,
        socialLinks,
        countryCode: authoritative.country.value,
        currencyCode: authoritative.reporting_currency.value,
        isUserEdited: editedFlags as Prisma.InputJsonValue,
      },
    });
  }
}
