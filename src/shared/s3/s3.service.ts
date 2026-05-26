import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";

import {
  DEFAULT_S3_REGION,
  publicS3ObjectUrl,
  resolveS3BucketName,
} from "./s3.config";

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string | null;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    this.region =
      this.config.get<string>("AWS_REGION")?.trim() || DEFAULT_S3_REGION;
    this.bucketName = resolveS3BucketName(this.config.get<string>("STAGE"));
    this.s3Client = new S3Client({ region: this.region });
  }

  isConfigured(): boolean {
    return Boolean(this.bucketName);
  }

  getBucketName(): string | null {
    return this.bucketName;
  }

  getPublicUrl(key: string): string {
    if (!this.bucketName) {
      throw new Error("S3 bucket is not configured");
    }
    return publicS3ObjectUrl(this.bucketName, this.region, key);
  }

  async getSignedUrl(key: string, expiresInSeconds = 60 * 60 * 24 * 7): Promise<string> {
    if (!this.bucketName) {
      throw new Error("S3 bucket is not configured");
    }
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async uploadImageFromBuffer(
    buffer: Buffer,
    directory: string,
    filename: string,
    contentType = "image/jpeg",
  ): Promise<{ key: string }> {
    if (!this.bucketName) {
      throw new Error("S3 bucket is not configured");
    }
    if (!buffer.length) {
      throw new Error("Buffer is empty");
    }
    const key = `${directory}/${filename}`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return { key };
  }

  async mirrorRemoteAssetToS3(params: {
    url: string;
    directory: string;
    filename?: string;
    maxBytes?: number;
  }): Promise<{ key: string; publicUrl: string; contentType: string; bytes: number }> {
    if (!this.bucketName) {
      throw new Error("S3 bucket is not configured");
    }

    const maxBytes = params.maxBytes ?? 8 * 1024 * 1024;
    const response = await fetch(params.url, {
      headers: {
        "User-Agent": "CreatorShop-BrandOnboarding-v2/1.0",
        Accept: "image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Remote asset HTTP ${response.status}`);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new Error("Remote asset exceeds size limit");
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new Error("Remote asset exceeds size limit");
    }
    if (arrayBuffer.byteLength === 0) {
      throw new Error("Remote asset download returned empty body");
    }

    const contentTypeRaw = response.headers.get("content-type");
    const contentType =
      typeof contentTypeRaw === "string" && contentTypeRaw.trim()
        ? contentTypeRaw.split(";")[0]!.trim()
        : "application/octet-stream";

    const buffer = Buffer.from(arrayBuffer);
    const filename =
      params.filename ?? this.mirrorFilename(params.url, contentType);
    const key = `${params.directory}/${filename}`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          sourceUrl: params.url.slice(0, 1024),
          mirroredAt: new Date().toISOString(),
        },
      }),
    );

    return {
      key,
      publicUrl: this.getPublicUrl(key),
      contentType,
      bytes: buffer.length,
    };
  }

  /** Stable filename from source URL + optional content type extension. */
  mirrorFilename(sourceUrl: string, contentType: string): string {
    const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 16);
    const ext = extensionFromContentType(contentType) ?? extensionFromUrl(sourceUrl) ?? "bin";
    return `${hash}.${ext}`;
  }

  logSkipMirror(reason: string, url: string): void {
    this.logger.debug(`S3 mirror skipped (${reason}) url=${url.slice(0, 120)}`);
  }
}

function extensionFromContentType(contentType: string): string | null {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
  };
  return map[contentType.toLowerCase()] ?? null;
}

function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}
