import { IndustryVertical, ScanStatus } from "@prisma/client";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../../prisma/prisma.service";
import { gateAndNormalizeBrandUrl } from "../discovery-url.util";
import { GeminiJsonClient } from "../integrations/gemini/gemini-json.client";
import { ParallelExtractClient } from "../integrations/parallel/parallel-extract.client";
import { loadPromptMarkdown } from "../prompts/prompt-loader";
import type {
  BrandSurfaceScanRunner,
  SurfaceScanRunResult,
} from "./brand-surface-scan.runner.token";
import { SurfaceScanGeminiSchema } from "./surface-scan-gemini.schema";
import { buildSurfaceScanUrls } from "./surface-scan-urls";

@Injectable()
export class HttpBrandSurfaceScanRunner implements BrandSurfaceScanRunner {
  private readonly logger = new Logger(HttpBrandSurfaceScanRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parallel: ParallelExtractClient,
    private readonly gemini: GeminiJsonClient,
    private readonly config: ConfigService,
  ) {}

  async run(args: {
    leadId: string;
    force?: boolean;
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
          `surface-scan.cache_hit domain=${domain} brandProfileId=${cached.id}`,
        );
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

    const urls = buildSurfaceScanUrls(lead.normalizedUrl);
    if (urls.length === 0) {
      throw new Error("No safe URLs to scan for this lead");
    }

    const extract = await this.parallel.extract({
      urls,
      objective:
        "Extract readable public content for brand onboarding: brand name, positioning, products/services, locations, competitor mentions, and navigation hints. Prefer factual text over marketing fluff.",
    });

    const markdown = this.concatParallelMarkdown(extract);
    if (markdown.trim().length < 50) {
      throw new Error("Parallel returned insufficient content for synthesis");
    }

    const systemInstruction = loadPromptMarkdown(
      "surface-scan-synthesis.prompt.md",
    );
    const userText = [
      `CANONICAL_SITE_URL: ${gated.normalizedUrl}`,
      `DISCOVERY_LEAD_INDUSTRY_HINT: ${lead.industry ?? "UNKNOWN"}`,
      "",
      "WEBSITE_MARKDOWN_BUNDLE:",
      markdown,
    ].join("\n");

    const raw = await this.gemini.generateJson({ systemInstruction, userText });
    const parsed = SurfaceScanGeminiSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.warn(
        `Gemini JSON failed validation issues=${JSON.stringify(parsed.error.issues).slice(0, 2000)}`,
      );
      throw new Error("Gemini output failed schema validation");
    }

    const payload = parsed.data;
    const industry: IndustryVertical =
      lead.industry ?? payload.suggestedIndustry ?? IndustryVertical.UNKNOWN;

    const profileId = await this.prisma.$transaction(async (tx) => {
      const visualIdentity = {
        colors: payload.visualIdentity.colors,
        fonts: payload.visualIdentity.fonts,
        toneOfVoice: payload.visualIdentity.toneOfVoice,
        aesthetic: payload.visualIdentity.aesthetic,
      };
      const targetAudience = {
        personaName: payload.targetAudience.personaName,
        countries: payload.targetAudience.countries,
        ageRange: [
          payload.targetAudience.ageMin,
          payload.targetAudience.ageMax,
        ],
        affluence: payload.targetAudience.affluence,
        traits: payload.targetAudience.traits,
      };

      const profile = await tx.brandProfile.upsert({
        where: { domain },
        create: {
          domain,
          name: payload.brand.name,
          industry,
          subIndustry: payload.brand.subIndustry ?? undefined,
          industryNiche: payload.brand.industryNiche ?? undefined,
          logoUrl: payload.brand.logoUrl ?? undefined,
          tagline: payload.brand.tagline ?? undefined,
          description: payload.brand.description,
          visualIdentity,
          brandValues: payload.brandValues,
          policyFlags: payload.policyFlags,
          targetAudience,
          scanStatus: ScanStatus.SURFACE_COMPLETE,
        },
        update: {
          name: payload.brand.name,
          industry,
          subIndustry: payload.brand.subIndustry ?? null,
          industryNiche: payload.brand.industryNiche ?? null,
          logoUrl: payload.brand.logoUrl ?? null,
          tagline: payload.brand.tagline ?? null,
          description: payload.brand.description,
          visualIdentity,
          brandValues: payload.brandValues,
          policyFlags: payload.policyFlags,
          targetAudience,
          scanStatus: ScanStatus.SURFACE_COMPLETE,
        },
      });

      await tx.offering.deleteMany({ where: { brandProfileId: profile.id } });
      await tx.competitor.deleteMany({ where: { brandProfileId: profile.id } });
      await tx.location.deleteMany({ where: { brandProfileId: profile.id } });

      if (payload.offerings.length > 0) {
        await tx.offering.createMany({
          data: payload.offerings.map((item) => ({
            brandProfileId: profile.id,
            type: item.type,
            name: item.name,
            description: item.description ?? null,
            imageUrl: item.imageUrl ?? null,
            url: item.url,
            currency: this.config.get<string>("DEFAULT_CURRENCY_CODE", "USD"),
          })),
        });
      }

      if (payload.competitors.length > 0) {
        await tx.competitor.createMany({
          data: payload.competitors.map((item) => ({
            brandProfileId: profile.id,
            name: item.name,
            websiteUrl: item.websiteUrl,
            logoUrl: item.logoUrl ?? null,
            socialHandles: item.socialHandles,
            whyCompetitor: item.whyCompetitor ?? null,
          })),
        });
      }

      if (payload.locations.length > 0) {
        await tx.location.createMany({
          data: payload.locations.map((item) => ({
            brandProfileId: profile.id,
            name: item.name ?? null,
            address: item.address,
            city: item.city ?? null,
            zip: item.zip ?? null,
          })),
        });
      }

      return profile.id;
    });

    const counts = await this.prisma.brandProfile.findUnique({
      where: { id: profileId },
      select: {
        _count: {
          select: { offerings: true, competitors: true, locations: true },
        },
      },
    });

    return {
      brandProfileId: profileId,
      domain,
      mode: "http",
      counts: {
        offerings: counts?._count.offerings ?? 0,
        competitors: counts?._count.competitors ?? 0,
        locations: counts?._count.locations ?? 0,
      },
    };
  }

  private concatParallelMarkdown(extract: {
    results: Array<{
      url: string;
      excerpts?: string[];
      full_content?: string;
    }>;
  }): string {
    const parts: string[] = [];
    for (const row of extract.results ?? []) {
      const body =
        row.full_content && row.full_content.length > 0
          ? row.full_content
          : (row.excerpts ?? []).join("\n\n");
      parts.push(`\n\n## SOURCE: ${row.url}\n\n${body}`);
    }
    return parts.join("\n");
  }
}
