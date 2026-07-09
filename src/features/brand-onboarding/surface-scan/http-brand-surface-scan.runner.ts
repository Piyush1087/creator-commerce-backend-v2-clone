import { IndustryVertical, Prisma, ScanStatus } from "@prisma/client";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../../prisma/prisma.service";
import { BrandCentreColdStartService } from "../../brand-centre/services/brand-centre-cold-start.service";
import {
  BrandScanGateException,
  BrandScanGateService,
} from "../brand-scan-gate.service";
import { gateAndNormalizeBrandUrl } from "../discovery-url.util";
import { GeminiJsonClient } from "../integrations/gemini/gemini-json.client";
import { ParallelExtractClient } from "../integrations/parallel/parallel-extract.client";
import type { ParallelExtractResponse } from "../integrations/parallel/parallel-extract.types";
import { ParallelSearchClient } from "../integrations/parallel/parallel-search.client";
import type { ParallelSearchResponse } from "../integrations/parallel/parallel-search.types";
import { loadPromptMarkdown } from "../prompts/prompt-loader";
import type {
  BrandSurfaceScanRunner,
  SurfaceScanRunResult,
} from "./brand-surface-scan.runner.token";
import {
  PARALLEL_SURFACE_OBJECTIVE_COMPETITORS,
  PARALLEL_SURFACE_OBJECTIVE_IDENTITY,
  PARALLEL_SURFACE_OBJECTIVE_INVENTORY,
} from "./surface-scan-parallel-objectives";
import { enrichProductsFromShopifyJson } from "./shopify-products-json.enricher";
import { enrichFromMetaHtml } from "./meta-html.enricher";
import { buildCompetitorParallelSearch } from "./competitor-parallel-search";
import {
  buildCompetitorContextUrls,
  buildIdentitySurfaceUrls,
  buildInventorySurfaceUrls,
} from "./surface-scan-urls";
import {
  BrandScanAssetMirrorService,
  extractImageUrlsFromMarkdown,
} from "./brand-scan-asset-mirror.service";
import {
  formatMarkdownImageProbeLog,
  probeMarkdownForImages,
} from "./surface-scan-markdown-image-probe";
import {
  Step2SurfaceScanGeminiSchema,
  type Step2SurfaceScanGeminiPayload,
} from "./surface-scan-gemini.schema";
import { SurfaceScanProgressStore } from "./surface-scan-progress.store";

function tryParseStartingPriceLabel(
  label: string | null | undefined,
): Prisma.Decimal | undefined {
  if (!label) {
    return undefined;
  }
  const compact = label.replace(/,/g, "").trim();
  const match = compact.match(/(\d+(\.\d+)?)/);
  if (!match?.[1]) {
    return undefined;
  }
  return new Prisma.Decimal(match[1]);
}

@Injectable()
export class HttpBrandSurfaceScanRunner implements BrandSurfaceScanRunner {
  private readonly logger = new Logger(HttpBrandSurfaceScanRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scanGate: BrandScanGateService,
    private readonly parallel: ParallelExtractClient,
    private readonly parallelSearch: ParallelSearchClient,
    private readonly gemini: GeminiJsonClient,
    private readonly scanAssets: BrandScanAssetMirrorService,
    private readonly config: ConfigService,
    private readonly brandCentreColdStart: BrandCentreColdStartService,
    private readonly scanProgress: SurfaceScanProgressStore,
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
      const message = err instanceof Error ? err.message : "Surface scan failed";
      // Gate exceptions still surface as HTTP 403; progress should show failure too.
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
    // Serve completed profiles before the vendor gate so a duplicate POST
    // (e.g. React StrictMode) cannot race into a limit 403 after the first
    // scan succeeds and then bounce the UI back to landing.
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
          `surface-scan.cache_hit domain=${domain} brandProfileId=${cached.id} note=skipping_vendor_and_asset_remirror`,
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

    this.scanProgress.setPhase(
      args.leadId,
      "signals",
      "Extracting public pages (Parallel)",
    );

    const identityUrls = buildIdentitySurfaceUrls(lead.normalizedUrl);
    const inventoryUrls = buildInventorySurfaceUrls(lead.normalizedUrl);
    const competitorUrls = buildCompetitorContextUrls(lead.normalizedUrl);

    const competitorSearchEnabled =
      this.config
        .get<string>("PARALLEL_COMPETITOR_SEARCH_ENABLED", "true")
        ?.trim()
        .toLowerCase() !== "false";

    const searchReq = buildCompetitorParallelSearch({
      hostname: domain,
      canonicalUrl: gated.normalizedUrl,
      industryHint: lead.industry ?? null,
    });

    const [identityEx, inventoryEx, competitorEx, competitorSearchRaw] =
      await Promise.all([
        this.parallel.extract({
          urls: identityUrls,
          objective: PARALLEL_SURFACE_OBJECTIVE_IDENTITY,
        }),
        this.parallel.extract({
          urls: inventoryUrls,
          objective: PARALLEL_SURFACE_OBJECTIVE_INVENTORY,
        }),
        this.parallel.extract({
          urls: competitorUrls,
          objective: PARALLEL_SURFACE_OBJECTIVE_COMPETITORS,
        }),
        competitorSearchEnabled
          ? this.parallelSearch.search(searchReq)
          : Promise.resolve(null),
      ]);

    const identityMd = this.concatParallelMarkdown(identityEx);
    const inventoryMd = this.concatParallelMarkdown(inventoryEx);
    const competitorMd = this.concatParallelMarkdown(competitorEx);
    const competitorSearchMd =
      this.concatParallelSearchMarkdown(competitorSearchRaw);

    this.logParallelExtractSummary(
      "identity",
      identityUrls,
      identityEx,
      identityMd,
    );
    this.logParallelExtractSummary(
      "inventory",
      inventoryUrls,
      inventoryEx,
      inventoryMd,
    );
    this.logParallelExtractSummary(
      "competitor_context",
      competitorUrls,
      competitorEx,
      competitorMd,
    );
    this.logParallelSearchSummary(
      domain,
      competitorSearchEnabled,
      competitorSearchRaw,
      competitorSearchMd,
    );

    // Short rollup for local/manual testing — confirms Parallel returned payloads
    // without dumping page content.
    const identityRows = identityEx.results?.length ?? 0;
    const inventoryRows = inventoryEx.results?.length ?? 0;
    const competitorRows = competitorEx.results?.length ?? 0;
    const searchRows = competitorSearchRaw?.results?.length ?? 0;
    const parallelGaveSomething =
      identityMd.trim().length > 0 ||
      inventoryMd.trim().length > 0 ||
      competitorMd.trim().length > 0 ||
      competitorSearchMd.trim().length > 0;
    this.logger.log(
      `surface-scan.parallel_received domain=${domain} ok=${parallelGaveSomething} identity={rows:${identityRows},chars:${identityMd.length}} inventory={rows:${inventoryRows},chars:${inventoryMd.length}} competitor_extract={rows:${competitorRows},chars:${competitorMd.length}} parallel_search={enabled:${competitorSearchEnabled},rows:${searchRows},chars:${competitorSearchMd.length}}`,
    );

    const markdown = [
      "# BUNDLE: IDENTITY_AND_ABOUT\n",
      identityMd,
      "\n\n# BUNDLE: INVENTORY_LIST_PAGES\n",
      inventoryMd,
      "\n\n# BUNDLE: HOMEPAGE_METADATA\n",
      competitorMd,
      "\n\n# BUNDLE: PARALLEL_WEB_SEARCH_COMPETITORS\n",
      competitorSearchMd.trim().length > 0
        ? competitorSearchMd
        : "_No Parallel Search results (disabled, failed, or empty)._",
    ].join("\n");

    if (markdown.trim().length < 50) {
      throw new Error("Parallel returned insufficient content for synthesis");
    }

    this.logger.log(
      `surface-scan.bundles domain=${domain} totalChars=${markdown.length} identityChars=${identityMd.length} inventoryChars=${inventoryMd.length} competitorBundleChars=${competitorMd.length} parallelSearchChars=${competitorSearchMd.length} parallelSearchRows=${competitorSearchRaw?.results?.length ?? 0}`,
    );

    const identityImageUrls = extractImageUrlsFromMarkdown(identityMd);
    const inventoryImageUrls = extractImageUrlsFromMarkdown(inventoryMd);
    this.logger.log(
      `surface-scan.images_in_markdown domain=${domain} identityCount=${identityImageUrls.length} inventoryCount=${inventoryImageUrls.length} identitySample=${JSON.stringify(identityImageUrls.slice(0, 8))} inventorySample=${JSON.stringify(inventoryImageUrls.slice(0, 12))}`,
    );

    // One-shot quality probe: CDN / JSON-LD / loose URL signals vs our strict regex.
    this.logger.log(
      formatMarkdownImageProbeLog(
        domain,
        probeMarkdownForImages("identity", identityMd),
      ),
    );
    this.logger.log(
      formatMarkdownImageProbeLog(
        domain,
        probeMarkdownForImages("inventory", inventoryMd),
      ),
    );

    this.scanProgress.setPhase(
      args.leadId,
      "products",
      "Synthesizing products & positioning (Gemini)",
    );

    const systemInstruction = loadPromptMarkdown(
      "surface-scan-synthesis.prompt.md",
    );
    const userText = [
      `CANONICAL_SITE_URL: ${gated.normalizedUrl}`,
      `DISCOVERY_LEAD_INDUSTRY_HINT: ${lead.industry ?? "UNKNOWN"}`,
      "",
      "WEBSITE_MARKDOWN_BUNDLES:",
      markdown,
    ].join("\n");

    this.logger.log(
      `surface-scan.gemini_input domain=${domain} userTextChars=${userText.length} systemChars=${systemInstruction.length} identityImageUrls=${identityImageUrls.length} inventoryImageUrls=${inventoryImageUrls.length}`,
    );

    const raw = await this.gemini.generateJson({ systemInstruction, userText });
    const parsed = Step2SurfaceScanGeminiSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.warn(
        `Gemini JSON failed validation issues=${JSON.stringify(parsed.error.issues).slice(0, 2000)}`,
      );
      throw new Error("Gemini output failed schema validation");
    }

    this.logGeminiImageQuality(domain, parsed.data, {
      identityImageUrls,
      inventoryImageUrls,
    });

    const shopify = await enrichProductsFromShopifyJson(domain, parsed.data);
    let workingPayload = shopify.payload;
    if (shopify.result.filled > 0) {
      this.logger.log(
        `surface-scan.shopify_enrich_applied domain=${domain} filled=${shopify.result.filled}/${workingPayload.products.length}`,
      );
      this.logGeminiImageQuality(domain, workingPayload, {
        identityImageUrls,
        inventoryImageUrls,
      });
    }

    const needsMeta =
      !workingPayload.brand.logoUrl?.trim() ||
      workingPayload.products.some((p) => !p.imageUrl?.trim());
    if (needsMeta) {
      const meta = await enrichFromMetaHtml(domain, workingPayload);
      workingPayload = meta.payload;
      if (
        meta.result.logoStatus === "filled" ||
        meta.result.productsFilled > 0
      ) {
        this.logger.log(
          `surface-scan.meta_enrich_applied domain=${domain} logoStatus=${meta.result.logoStatus} productsFilled=${meta.result.productsFilled}/${workingPayload.products.length}`,
        );
        this.logGeminiImageQuality(domain, workingPayload, {
          identityImageUrls,
          inventoryImageUrls,
        });
      }
    }

    this.scanProgress.setPhase(
      args.leadId,
      "audience",
      "Mirroring brand visuals & audience fields",
    );

    this.logger.log(
      `surface-scan.asset_mirror_begin domain=${domain} brandLogo=${Boolean(workingPayload.brand.logoUrl)} products=${workingPayload.products.length} competitors=${workingPayload.competitors.length}`,
    );
    const payload = await this.scanAssets.mirrorPayload(workingPayload, {
      domain,
      leadId: lead.id,
      identityMarkdown: identityMd,
      inventoryMarkdown: inventoryMd,
    });
    this.logger.log(
      `surface-scan.asset_mirror_done domain=${domain} brandLogo=${payload.brand.logoUrl ?? "(none)"} productImages=${payload.products.filter((p) => Boolean(p.imageUrl)).length}/${payload.products.length} competitorLogos=${payload.competitors.filter((c) => Boolean(c.logoUrl)).length}/${payload.competitors.length}`,
    );

    this.scanProgress.setPhase(
      args.leadId,
      "competitors",
      "Persisting competitors & catalogue",
    );

    // Gemini sometimes returns null-ish location fields; avoid failing persistence on bad rows.
    const normalizedLocations = payload.locations
      .flatMap((item) => {
        if (typeof item.address !== "string") {
          return [];
        }
        const address = item.address.trim();
        if (!address) {
          return [];
        }
        return [{ ...item, address }];
      });

    this.logGeminiSurfaceSummary(domain, payload, {
      identityChars: identityMd.length,
      inventoryChars: inventoryMd.length,
      competitorBundleChars: competitorMd.length,
      competitorMarkdownSample: competitorMd.slice(0, 400),
      parallelSearchChars: competitorSearchMd.length,
      parallelSearchRows: competitorSearchRaw?.results?.length ?? 0,
      parallelSearchEnabled: competitorSearchEnabled,
    });
    const industry: IndustryVertical =
      lead.industry ?? payload.suggestedIndustry ?? IndustryVertical.UNKNOWN;

    const visualIdentity = {
      colors: payload.brand.primaryHexColors,
      fonts: {
        heading: payload.brand.headingFont ?? "Unknown",
        body: payload.brand.bodyFont ?? "Unknown",
      },
      toneOfVoice: payload.brand.toneTags.map((label) => ({
        label,
        description: "",
      })),
      aesthetic: payload.brand.aestheticTags,
    };

    const ageMin = payload.brand.audience?.ageMin ?? 25;
    const ageMax = payload.brand.audience?.ageMax ?? 54;
    const targetAudience = {
      personaName:
        payload.brand.audience?.personaName?.trim() || "General audience",
      countries: [] as string[],
      ageRange: [ageMin, ageMax] as [number, number],
      affluence: 3,
      traits: payload.brand.audience?.traits ?? [],
    };

    const surfaceOffersJson: Prisma.InputJsonValue =
      payload.activeOffers as unknown as Prisma.InputJsonValue;

    this.scanProgress.setPhase(
      args.leadId,
      "persisting",
      "Saving BrandProfile to database",
    );

    const profileId = await this.prisma.$transaction(async (tx) => {
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
          description: payload.brand.shortDescription ?? undefined,
          socialLinks: payload.brand.socialLinks,
          surfaceOffers: surfaceOffersJson,
          surfaceScrapeBundles: markdown,
          visualIdentity,
          brandValues: [],
          policyFlags: [],
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
          description: payload.brand.shortDescription ?? null,
          socialLinks: payload.brand.socialLinks,
          surfaceOffers: surfaceOffersJson,
          surfaceScrapeBundles: markdown,
          visualIdentity,
          targetAudience,
          scanStatus: ScanStatus.SURFACE_COMPLETE,
        },
      });

      await tx.discoveryLead.update({
        where: { id: lead.id },
        data: {
          subIndustry: payload.brand.subIndustry ?? null,
          industryNiche: payload.brand.industryNiche ?? null,
        },
      });

      await tx.offering.deleteMany({ where: { brandProfileId: profile.id } });
      await tx.competitor.deleteMany({ where: { brandProfileId: profile.id } });
      await tx.location.deleteMany({ where: { brandProfileId: profile.id } });

      if (payload.products.length > 0) {
        const defaultCurrency = this.config.get<string>(
          "DEFAULT_CURRENCY_CODE",
          "USD",
        );
        await tx.offering.createMany({
          data: payload.products.map((item) => ({
            brandProfileId: profile.id,
            type: item.type,
            name: item.name,
            description: null,
            imageUrl: item.imageUrl ?? null,
            url: item.url,
            categoryTag: item.collectionOrCategory ?? null,
            startingPriceLabel: item.startingPriceLabel ?? null,
            priceAmount: tryParseStartingPriceLabel(item.startingPriceLabel),
            currency: defaultCurrency,
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
            socialHandles: [],
            whyCompetitor: item.whyCompetitor ?? null,
          })),
        });
      }

      if (payload.locations.length > 0) {
        await tx.location.createMany({
          data: normalizedLocations.map((item) => ({
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

    await this.scanGate.recordVendorSurfaceScan({
      domain,
      clientIp: args.clientIp,
      discoveryLeadId: args.leadId,
      brandProfileId: profileId,
    });

    try {
      await this.brandCentreColdStart.seedFromSurfaceScan(profileId);
    } catch (coldStartErr: unknown) {
      const message =
        coldStartErr instanceof Error ? coldStartErr.message : "unknown";
      this.logger.error(
        `cold-start.failed brandProfileId=${profileId} error=${message}`,
      );
    }

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

  private logParallelExtractSummary(
    bundle: string,
    requestedUrls: string[],
    extract: ParallelExtractResponse,
    markdownBody: string,
  ): void {
    const rows = extract.results ?? [];
    const rowSummaries = rows.map((row) => {
      const body =
        row.full_content && row.full_content.length > 0
          ? row.full_content
          : (row.excerpts ?? []).join("\n\n");
      return `${row.url} chars=${body.length}`;
    });
    const errSnippet =
      extract.errors !== undefined && extract.errors !== null
        ? JSON.stringify(extract.errors).slice(0, 800)
        : "";
    this.logger.log(
      `surface-scan.parallel bundle=${bundle} extract_id=${extract.extract_id ?? "n/a"} requestedUrls=${requestedUrls.length} resultRows=${rows.length} markdownChars=${markdownBody.length} rows=[${rowSummaries.join(" | ")}]${errSnippet ? ` errors=${errSnippet}` : ""}`,
    );
  }

  private logParallelSearchSummary(
    domain: string,
    enabled: boolean,
    search: ParallelSearchResponse | null,
    markdownBody: string,
  ): void {
    if (!enabled) {
      this.logger.log(
        `surface-scan.parallel_search domain=${domain} status=disabled_by_env`,
      );
      return;
    }
    if (!search) {
      this.logger.warn(
        `surface-scan.parallel_search domain=${domain} status=failed_or_skipped markdownChars=${markdownBody.length}`,
      );
      return;
    }
    const rows = search.results ?? [];
    const rowSummaries = rows.map((row) => {
      const excerpts = row.excerpts ?? [];
      const excerptLen = excerpts.join("\n").length;
      return `${row.url} excerptsChars=${excerptLen}`;
    });
    const warnSnippet = search.warnings
      ? JSON.stringify(search.warnings).slice(0, 600)
      : "";
    this.logger.log(
      `surface-scan.parallel_search domain=${domain} search_id=${search.search_id} session_id=${search.session_id} resultRows=${rows.length} markdownChars=${markdownBody.length} rows=[${rowSummaries.join(" | ")}]${warnSnippet ? ` warnings=${warnSnippet}` : ""}`,
    );
  }

  private logGeminiImageQuality(
    domain: string,
    payload: Step2SurfaceScanGeminiPayload,
    markdownImages: {
      identityImageUrls: string[];
      inventoryImageUrls: string[];
    },
  ): void {
    const productsWithImage = payload.products.filter((p) =>
      Boolean(p.imageUrl?.trim()),
    ).length;
    const competitorsWithLogo = payload.competitors.filter((c) =>
      Boolean(c.logoUrl?.trim()),
    ).length;
    const productRows = payload.products.map((p, index) => ({
      i: index + 1,
      name: (p.name ?? "").slice(0, 60),
      imageUrl: p.imageUrl ?? null,
    }));
    const competitorRows = payload.competitors.map((c, index) => ({
      i: index + 1,
      name: (c.name ?? "").slice(0, 60),
      websiteUrl: c.websiteUrl,
      logoUrl: c.logoUrl ?? null,
    }));

    this.logger.log(
      `surface-scan.gemini_images domain=${domain} brandLogo=${payload.brand.logoUrl ?? "(none)"} productsWithImage=${productsWithImage}/${payload.products.length} competitorsWithLogo=${competitorsWithLogo}/${payload.competitors.length} markdownIdentityImages=${markdownImages.identityImageUrls.length} markdownInventoryImages=${markdownImages.inventoryImageUrls.length}`,
    );
    this.logger.log(
      `surface-scan.gemini_images_detail domain=${domain} brandLogoUrl=${payload.brand.logoUrl ?? "(none)"} products=${JSON.stringify(productRows)} competitors=${JSON.stringify(competitorRows)}`,
    );

    if (
      markdownImages.inventoryImageUrls.length > 0 &&
      productsWithImage === 0 &&
      payload.products.length > 0
    ) {
      this.logger.warn(
        `surface-scan.gemini_image_gap domain=${domain} inventoryHad=${markdownImages.inventoryImageUrls.length} imageUrls but gemini returned 0 product imageUrls — check synthesis prompt / model grounding`,
      );
    }
    if (
      markdownImages.identityImageUrls.length > 0 &&
      !payload.brand.logoUrl?.trim()
    ) {
      this.logger.warn(
        `surface-scan.gemini_logo_gap domain=${domain} identityHad=${markdownImages.identityImageUrls.length} imageUrls but gemini returned null brand.logoUrl`,
      );
    }
  }

  private logGeminiSurfaceSummary(
    domain: string,
    payload: Step2SurfaceScanGeminiPayload,
    bundleChars: {
      identityChars: number;
      inventoryChars: number;
      competitorBundleChars: number;
      competitorMarkdownSample: string;
      parallelSearchChars: number;
      parallelSearchRows: number;
      parallelSearchEnabled: boolean;
    },
  ): void {
    const compHint =
      payload.competitors.length === 0
        ? "competitors_empty"
        : `competitors=${payload.competitors.length}`;
    this.logger.log(
      `surface-scan.gemini domain=${domain} suggestedIndustry=${payload.suggestedIndustry} products=${payload.products.length} competitors=${payload.competitors.length} locations=${payload.locations.length} offers=${payload.activeOffers.length} ${compHint} bundleChars=${JSON.stringify(
        {
          identityChars: bundleChars.identityChars,
          inventoryChars: bundleChars.inventoryChars,
          competitorBundleChars: bundleChars.competitorBundleChars,
          parallelSearchChars: bundleChars.parallelSearchChars,
          parallelSearchRows: bundleChars.parallelSearchRows,
        },
      )}`,
    );
    if (payload.competitors.length === 0) {
      const hasCompetitorVocabInHomeMeta =
        /competitor|rival|vs\.|versus|alternative to|compared to/i.test(
          bundleChars.competitorMarkdownSample,
        );
      const searchRan =
        bundleChars.parallelSearchEnabled && bundleChars.parallelSearchRows > 0;
      const note = !bundleChars.parallelSearchEnabled
        ? "parallel_search_disabled_set_PARALLEL_COMPETITOR_SEARCH_ENABLED=true"
        : !searchRan
          ? "parallel_search_empty_or_failed_check_logs_surface-scan.parallel_search"
          : "gemini_found_no_urls_grounded_in_extract_plus_search;_filter_listicles_or_irrelevant_domains";
      this.logger.warn(
        `surface-scan.competitors_skipped domain=${domain} parallel_competitor_extract_chars=${bundleChars.competitorBundleChars} meta_bundle_has_competitor_vocab=${hasCompetitorVocabInHomeMeta} parallel_search_rows=${bundleChars.parallelSearchRows} note=${note}`,
      );
    }
  }

  private concatParallelSearchMarkdown(
    search: ParallelSearchResponse | null,
  ): string {
    if (!search?.results?.length) {
      return "";
    }
    const parts: string[] = [];
    for (const row of search.results) {
      const title = row.title ?? "";
      const body = (row.excerpts ?? []).join("\n\n");
      parts.push(
        `\n\n## SEARCH_RESULT: ${row.url}\n**Title:** ${title}\n\n${body}`,
      );
    }
    return parts.join("\n");
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
