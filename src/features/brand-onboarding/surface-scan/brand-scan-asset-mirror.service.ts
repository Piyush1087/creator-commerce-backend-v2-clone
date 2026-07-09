import { Injectable, Logger } from "@nestjs/common";

import { S3Service } from "../../../shared/s3/s3.service";
import type { Step2SurfaceScanGeminiPayload } from "./surface-scan-gemini.schema";

type AssetRole = "brand_logo" | "product_image" | "competitor_logo";

function domainSlug(domain: string): string {
  const slug = domain
    .replace(/^www\./, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
  return slug.length > 0 ? slug : "brand";
}

function isHttpUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveAbsoluteAssetUrl(
  value: string | null | undefined,
  siteOrigin: string,
): string | null {
  if (!value?.trim()) {
    return null;
  }
  const trimmed = value.trim();
  if (isHttpUrl(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  try {
    const base = new URL(siteOrigin);
    if (trimmed.startsWith("/")) {
      return new URL(trimmed, base.origin).toString();
    }
    return new URL(`/${trimmed}`, base.origin).toString();
  } catch {
    return null;
  }
}

function isAlreadyMirrored(url: string, bucket: string): boolean {
  return url.includes(`${bucket}.s3.`) || url.includes("amazonaws.com/");
}

function shortUrl(url: string | null | undefined, max = 140): string {
  if (!url) {
    return "(none)";
  }
  return url.length > max ? `${url.slice(0, max)}…` : url;
}

/** Review/directory hosts — favicons belong to the directory, not the rival brand. */
const COMPETITOR_DIRECTORY_HOST_LABELS = [
  "owler.com",
  "cbinsights.com",
  "similarweb.com",
  "semrush.com",
  "craft.co",
  "tracxn.com",
  "rocketreach.co",
  "crunchbase.com",
  "linkedin.com",
  "wikipedia.org",
  "apps.apple.com",
  "play.google.com",
] as const;

function isDirectoryCompetitorHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return COMPETITOR_DIRECTORY_HOST_LABELS.some(
    (label) => host === label || host.endsWith(`.${label}`),
  );
}

function faviconCandidates(origin: string): string[] {
  return [
    `${origin}/favicon.ico`,
    `${origin}/favicon.png`,
    `${origin}/apple-touch-icon.png`,
    `${origin}/apple-touch-icon-precomposed.png`,
  ];
}

/** Collect absolute http(s) image-like URLs from Parallel markdown. */
export function extractImageUrlsFromMarkdown(markdown: string | undefined): string[] {
  if (!markdown?.trim()) {
    return [];
  }
  const found = markdown.match(
    /https?:\/\/[^\s"'<>)\]]+\.(?:png|jpe?g|webp|gif|svg|ico)(?:\?[^\s"'<>)\]]*)?/gi,
  );
  if (!found) {
    return [];
  }
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const raw of found) {
    const url = raw.replace(/[),.;]+$/, "");
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    deduped.push(url);
  }
  return deduped;
}

function findProductImageInMarkdown(
  productName: string | null | undefined,
  markdown: string | undefined,
): string | null {
  const name = productName?.trim();
  if (!name || !markdown?.trim()) {
    return null;
  }
  const tokens = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4)
    .slice(0, 4);
  if (tokens.length === 0) {
    return null;
  }
  const lower = markdown.toLowerCase();
  let bestIdx = -1;
  for (const token of tokens) {
    const idx = lower.indexOf(token);
    if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) {
      bestIdx = idx;
    }
  }
  if (bestIdx < 0) {
    return null;
  }
  const window = markdown.slice(
    Math.max(0, bestIdx - 400),
    Math.min(markdown.length, bestIdx + 1200),
  );
  const images = extractImageUrlsFromMarkdown(window);
  return images[0] ?? null;
}

function findBrandLogoInMarkdown(markdown: string | undefined): string | null {
  if (!markdown?.trim()) {
    return null;
  }
  const images = extractImageUrlsFromMarkdown(markdown);
  const preferred = images.find((url) =>
    /logo|brand|apple-touch|favicon|icon/i.test(url),
  );
  return preferred ?? images[0] ?? null;
}

@Injectable()
export class BrandScanAssetMirrorService {
  private readonly logger = new Logger(BrandScanAssetMirrorService.name);

  constructor(private readonly s3: S3Service) {}

  async mirrorPayload(
    payload: Step2SurfaceScanGeminiPayload,
    ctx: {
      domain: string;
      leadId: string;
      identityMarkdown?: string;
      inventoryMarkdown?: string;
    },
  ): Promise<Step2SurfaceScanGeminiPayload> {
    const siteOrigin = `https://${ctx.domain.replace(/^www\./, "")}`;

    this.logger.log(
      `asset-mirror.start domain=${ctx.domain} leadId=${ctx.leadId} s3Configured=${this.s3.isConfigured()} products=${payload.products.length} competitors=${payload.competitors.length} brandLogoRaw=${shortUrl(payload.brand.logoUrl)}`,
    );

    const brand = { ...payload.brand };
    let resolvedBrandLogo = resolveAbsoluteAssetUrl(brand.logoUrl, siteOrigin);
    if (!resolvedBrandLogo) {
      const fromMd = findBrandLogoInMarkdown(ctx.identityMarkdown);
      if (fromMd) {
        this.logger.log(
          `asset-mirror.recover role=brand_logo source=identity_markdown url=${shortUrl(fromMd)}`,
        );
        resolvedBrandLogo = fromMd;
      }
    }
    brand.logoUrl = resolvedBrandLogo ?? brand.logoUrl ?? null;
    this.logger.log(
      `asset-mirror.resolve role=brand_logo raw=${shortUrl(payload.brand.logoUrl)} resolved=${shortUrl(brand.logoUrl)}`,
    );

    const products = payload.products.map((product, index) => {
      let resolved =
        resolveAbsoluteAssetUrl(product.imageUrl, siteOrigin) ??
        product.imageUrl ??
        null;
      if (!resolved || !isHttpUrl(resolved)) {
        const fromMd = findProductImageInMarkdown(
          product.name,
          ctx.inventoryMarkdown,
        );
        if (fromMd) {
          this.logger.log(
            `asset-mirror.recover role=product_image index=${index + 1} source=inventory_markdown url=${shortUrl(fromMd)}`,
          );
          resolved = fromMd;
        }
      }
      this.logger.log(
        `asset-mirror.resolve role=product_image index=${index + 1} name=${JSON.stringify(product.name ?? "").slice(0, 80)} raw=${shortUrl(product.imageUrl)} resolved=${shortUrl(resolved)}`,
      );
      return {
        ...product,
        imageUrl: resolved,
      };
    });

    const competitors = payload.competitors.map((competitor, index) => {
      const resolved =
        resolveAbsoluteAssetUrl(competitor.logoUrl, siteOrigin) ??
        competitor.logoUrl ??
        null;
      this.logger.log(
        `asset-mirror.resolve role=competitor_logo index=${index + 1} name=${JSON.stringify(competitor.name ?? "").slice(0, 80)} raw=${shortUrl(competitor.logoUrl)} resolved=${shortUrl(resolved)}`,
      );
      return {
        ...competitor,
        logoUrl: resolved,
      };
    });

    if (!this.s3.isConfigured()) {
      this.logger.warn(
        "asset-mirror.skip S3 not configured — keeping scraped image URLs (set S3_BUCKET_NAME for local mirroring).",
      );
      return { ...payload, brand, products, competitors };
    }

    const bucket = this.s3.getBucketName()!;
    const slug = domainSlug(ctx.domain);
    const baseDir = `brand-onboarding/v2/${slug}/${ctx.leadId}`;
    this.logger.log(
      `asset-mirror.s3_ready bucket=${bucket} baseDir=${baseDir}`,
    );

    let brandLogoOk = false;
    let brandLogoSkipped = false;
    let brandLogoFallback = false;
    const logoUrl = brand.logoUrl;
    if (logoUrl && isHttpUrl(logoUrl) && !isAlreadyMirrored(logoUrl, bucket)) {
      const mirrored = await this.mirrorOne({
        role: "brand_logo",
        label: ctx.domain,
        sourceUrl: logoUrl,
        directory: `${baseDir}/logo`,
      });
      if (mirrored) {
        brand.logoUrl = mirrored;
        brandLogoOk = true;
      }
    } else if (logoUrl && isAlreadyMirrored(logoUrl, bucket)) {
      brandLogoSkipped = true;
      this.logger.log(
        `asset-mirror.skip role=brand_logo reason=already_mirrored url=${shortUrl(logoUrl)}`,
      );
      brandLogoOk = true;
    }

    if (!brandLogoOk) {
      brandLogoFallback = true;
      for (const faviconUrl of faviconCandidates(siteOrigin)) {
        this.logger.log(
          `asset-mirror.fallback role=brand_logo reason=missing_or_invalid_logo trying=${faviconUrl}`,
        );
        const mirrored = await this.mirrorOne({
          role: "brand_logo",
          label: `${ctx.domain}:favicon`,
          sourceUrl: faviconUrl,
          directory: `${baseDir}/logo`,
        });
        if (mirrored) {
          brand.logoUrl = mirrored;
          brandLogoOk = true;
          break;
        }
      }
    }

    let productsMirrored = 0;
    let productsSkipped = 0;
    let productsFailed = 0;
    const mirroredProducts = await Promise.all(
      products.map(async (product, index) => {
        const imageUrl = product.imageUrl;
        if (!imageUrl || !isHttpUrl(imageUrl)) {
          productsSkipped += 1;
          this.logger.warn(
            `asset-mirror.skip role=product_image index=${index + 1} reason=missing_or_invalid name=${JSON.stringify(product.name ?? "").slice(0, 80)}`,
          );
          return product;
        }
        if (isAlreadyMirrored(imageUrl, bucket)) {
          productsSkipped += 1;
          this.logger.log(
            `asset-mirror.skip role=product_image index=${index + 1} reason=already_mirrored url=${shortUrl(imageUrl)}`,
          );
          return product;
        }
        const mirrored = await this.mirrorOne({
          role: "product_image",
          label: `p${index + 1}:${product.name ?? "product"}`,
          sourceUrl: imageUrl,
          directory: `${baseDir}/products/p${String(index + 1).padStart(2, "0")}`,
        });
        if (mirrored) {
          productsMirrored += 1;
          return { ...product, imageUrl: mirrored };
        }
        productsFailed += 1;
        return { ...product, imageUrl };
      }),
    );

    let competitorsMirrored = 0;
    let competitorsSkipped = 0;
    let competitorsFailed = 0;
    const mirroredCompetitors = await Promise.all(
      competitors.map(async (competitor, index) => {
        let logo = competitor.logoUrl;
        if ((!logo || !isHttpUrl(logo)) && isHttpUrl(competitor.websiteUrl)) {
          try {
            const origin = new URL(competitor.websiteUrl).origin;
            const host = new URL(competitor.websiteUrl).hostname;
            if (isDirectoryCompetitorHost(host)) {
              competitorsSkipped += 1;
              this.logger.warn(
                `asset-mirror.skip role=competitor_logo index=${index + 1} reason=directory_host host=${host} name=${JSON.stringify(competitor.name ?? "").slice(0, 80)}`,
              );
              return competitor;
            }
            for (const faviconUrl of faviconCandidates(origin)) {
              this.logger.log(
                `asset-mirror.fallback role=competitor_logo index=${index + 1} reason=missing_or_invalid trying=${faviconUrl}`,
              );
              const mirrored = await this.mirrorOne({
                role: "competitor_logo",
                label: `c${index + 1}:${competitor.name ?? "competitor"}:favicon`,
                sourceUrl: faviconUrl,
                directory: `${baseDir}/competitors/c${String(index + 1).padStart(2, "0")}`,
              });
              if (mirrored) {
                competitorsMirrored += 1;
                return { ...competitor, logoUrl: mirrored };
              }
            }
            competitorsFailed += 1;
            return competitor;
          } catch {
            competitorsSkipped += 1;
            this.logger.warn(
              `asset-mirror.skip role=competitor_logo index=${index + 1} reason=missing_or_invalid name=${JSON.stringify(competitor.name ?? "").slice(0, 80)}`,
            );
            return competitor;
          }
        }
        if (!logo || !isHttpUrl(logo)) {
          competitorsSkipped += 1;
          this.logger.warn(
            `asset-mirror.skip role=competitor_logo index=${index + 1} reason=missing_or_invalid name=${JSON.stringify(competitor.name ?? "").slice(0, 80)}`,
          );
          return competitor;
        }
        if (isAlreadyMirrored(logo, bucket)) {
          competitorsSkipped += 1;
          this.logger.log(
            `asset-mirror.skip role=competitor_logo index=${index + 1} reason=already_mirrored url=${shortUrl(logo)}`,
          );
          return competitor;
        }
        const mirrored = await this.mirrorOne({
          role: "competitor_logo",
          label: `c${index + 1}:${competitor.name ?? "competitor"}`,
          sourceUrl: logo,
          directory: `${baseDir}/competitors/c${String(index + 1).padStart(2, "0")}`,
        });
        if (mirrored) {
          competitorsMirrored += 1;
          return { ...competitor, logoUrl: mirrored };
        }
        competitorsFailed += 1;
        return { ...competitor, logoUrl: logo };
      }),
    );

    this.logger.log(
      `asset-mirror.summary domain=${ctx.domain} brand_logo={ok:${brandLogoOk},fallback:${brandLogoFallback},skipped:${brandLogoSkipped},final:${shortUrl(brand.logoUrl)}} products={total:${products.length},mirrored:${productsMirrored},skipped:${productsSkipped},failed:${productsFailed}} competitors={total:${competitors.length},mirrored:${competitorsMirrored},skipped:${competitorsSkipped},failed:${competitorsFailed}}`,
    );

    return {
      ...payload,
      brand,
      products: mirroredProducts,
      competitors: mirroredCompetitors,
    };
  }

  private async mirrorOne(args: {
    role: AssetRole;
    label: string;
    sourceUrl: string;
    directory: string;
  }): Promise<string | null> {
    const { role, label, sourceUrl, directory } = args;
    this.logger.log(
      `asset-mirror.fetch role=${role} label=${JSON.stringify(label).slice(0, 80)} url=${shortUrl(sourceUrl)} dir=${directory}`,
    );
    try {
      const probe = await this.s3.mirrorRemoteAssetToS3({
        url: sourceUrl,
        directory,
      });
      this.logger.log(
        `asset-mirror.ok role=${role} label=${JSON.stringify(label).slice(0, 80)} bytes=${probe.bytes} key=${probe.key} publicUrl=${shortUrl(probe.publicUrl)}`,
      );
      return probe.publicUrl;
    } catch (err) {
      this.logger.warn(
        `asset-mirror.fail role=${role} label=${JSON.stringify(label).slice(0, 80)} url=${shortUrl(sourceUrl)} err=${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
