import { Injectable, Logger } from "@nestjs/common";

import { S3Service } from "../../../shared/s3/s3.service";
import type { Step2SurfaceScanGeminiPayload } from "./surface-scan-gemini.schema";

function domainSlug(domain: string): string {
  const slug = domain
    .replace(/^www\./, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
  return slug.length > 0 ? slug : "brand";
}

function isHttpUrl(value: string | null | undefined): value is string {
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

function isAlreadyMirrored(url: string, bucket: string): boolean {
  return url.includes(`${bucket}.s3.`) || url.includes("amazonaws.com/");
}

@Injectable()
export class BrandScanAssetMirrorService {
  private readonly logger = new Logger(BrandScanAssetMirrorService.name);

  constructor(private readonly s3: S3Service) {}

  async mirrorPayload(
    payload: Step2SurfaceScanGeminiPayload,
    ctx: { domain: string; leadId: string },
  ): Promise<Step2SurfaceScanGeminiPayload> {
    if (!this.s3.isConfigured()) {
      this.logger.warn(
        "S3 not configured — keeping scraped image URLs (set S3_BUCKET_NAME for local mirroring).",
      );
      return payload;
    }

    const bucket = this.s3.getBucketName()!;
    const slug = domainSlug(ctx.domain);
    const baseDir = `brand-onboarding/v2/${slug}/${ctx.leadId}`;

    const brand = { ...payload.brand };
    if (isHttpUrl(brand.logoUrl) && !isAlreadyMirrored(brand.logoUrl, bucket)) {
      const mirrored = await this.mirrorOne(brand.logoUrl, `${baseDir}/logo`);
      brand.logoUrl = mirrored ?? brand.logoUrl;
    }

    const products = await Promise.all(
      payload.products.map(async (product, index) => {
        if (
          !isHttpUrl(product.imageUrl) ||
          isAlreadyMirrored(product.imageUrl, bucket)
        ) {
          return product;
        }
        const mirrored = await this.mirrorOne(
          product.imageUrl,
          `${baseDir}/products/p${String(index + 1).padStart(2, "0")}`,
        );
        return {
          ...product,
          imageUrl: mirrored ?? product.imageUrl,
        };
      }),
    );

    const competitors = await Promise.all(
      payload.competitors.map(async (competitor, index) => {
        if (
          !isHttpUrl(competitor.logoUrl) ||
          isAlreadyMirrored(competitor.logoUrl, bucket)
        ) {
          return competitor;
        }
        const mirrored = await this.mirrorOne(
          competitor.logoUrl,
          `${baseDir}/competitors/c${String(index + 1).padStart(2, "0")}`,
        );
        return {
          ...competitor,
          logoUrl: mirrored ?? competitor.logoUrl,
        };
      }),
    );

    return {
      ...payload,
      brand,
      products,
      competitors,
    };
  }

  private async mirrorOne(
    sourceUrl: string,
    directory: string,
  ): Promise<string | null> {
    try {
      const probe = await this.s3.mirrorRemoteAssetToS3({
        url: sourceUrl,
        directory,
      });
      this.logger.log(
        `mirrored asset bytes=${probe.bytes} key=${probe.key}`,
      );
      return probe.publicUrl;
    } catch (err) {
      this.logger.warn(
        `mirror failed url=${sourceUrl.slice(0, 120)} err=${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
