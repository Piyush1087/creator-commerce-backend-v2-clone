import {
  CreateBucketCommand,
  DeletePublicAccessBlockCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
  type BucketLocationConstraint,
} from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-providers";
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
  private bucketEnsured = false;
  private ensureBucketPromise: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {
    this.region =
      this.config.get<string>("AWS_REGION")?.trim() || DEFAULT_S3_REGION;
    this.bucketName = resolveS3BucketName(this.config.get<string>("STAGE"));
    const awsProfile = this.config.get<string>("AWS_PROFILE")?.trim() || "";
    const awsCredentialsFile =
      this.config.get<string>("AWS_SHARED_CREDENTIALS_FILE")?.trim() || "";
    const credentials =
      awsProfile.length > 0
        ? fromIni({
            profile: awsProfile,
            ...(awsCredentialsFile.length > 0
              ? { filepath: awsCredentialsFile }
              : {}),
          })
        : undefined;

    this.logger.log(
      `s3.client_init region=${this.region} bucket=${this.bucketName ?? "(none)"} profile=${awsProfile || "(default)"}`,
    );
    this.s3Client = new S3Client({ region: this.region, credentials });
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

  /** Local/dev helper: create the configured bucket once if HeadBucket says it is missing. */
  async ensureBucketExists(): Promise<void> {
    if (!this.bucketName || this.bucketEnsured) {
      return;
    }
    if (this.ensureBucketPromise) {
      await this.ensureBucketPromise;
      return;
    }
    this.ensureBucketPromise = this.createBucketIfMissing();
    try {
      await this.ensureBucketPromise;
    } finally {
      this.ensureBucketPromise = null;
    }
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
    await this.ensureBucketExists();
    const key = `${directory}/${filename}`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    this.logger.log(
      `s3.upload_ok key=${key} bytes=${buffer.length} contentType=${contentType} bucket=${this.bucketName} publicUrl=${this.getPublicUrl(key)}`,
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
    await this.ensureBucketExists();

    const maxBytes = params.maxBytes ?? 8 * 1024 * 1024;
    this.logger.log(
      `s3.mirror_fetch_start url=${params.url.slice(0, 160)} dir=${params.directory}`,
    );
    const response = await fetch(params.url, {
      headers: {
        "User-Agent": "CreatorShop-BrandOnboarding-v2/1.0",
        Accept: "image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      this.logger.warn(
        `s3.mirror_fetch_http_fail status=${response.status} url=${params.url.slice(0, 160)}`,
      );
      throw new Error(`Remote asset HTTP ${response.status}`);
    }
    this.logger.log(
      `s3.mirror_fetch_ok status=${response.status} contentType=${response.headers.get("content-type") ?? "unknown"} contentLength=${response.headers.get("content-length") ?? "unknown"} url=${params.url.slice(0, 160)}`,
    );

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

  private async createBucketIfMissing(): Promise<void> {
    if (!this.bucketName || this.bucketEnsured) {
      return;
    }
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      this.logger.log(`s3.bucket_ready name=${this.bucketName}`);
    } catch (err) {
      if (!isMissingBucketError(err)) {
        throw err;
      }

      this.logger.warn(
        `s3.bucket_missing name=${this.bucketName} region=${this.region} — creating`,
      );
      const input =
        this.region === "us-east-1"
          ? { Bucket: this.bucketName }
          : {
              Bucket: this.bucketName,
              CreateBucketConfiguration: {
                LocationConstraint: this.region as BucketLocationConstraint,
              },
            };
      try {
        await this.s3Client.send(new CreateBucketCommand(input));
        this.logger.log(`s3.bucket_created name=${this.bucketName}`);
      } catch (createErr) {
        if (!isBucketAlreadyOwnedError(createErr)) {
          throw createErr;
        }
        this.logger.log(`s3.bucket_ready name=${this.bucketName} (already owned)`);
      }
    }

    await this.ensureBucketPublicRead();
    this.bucketEnsured = true;
  }

  /** Local buckets need anonymous GetObject so <img src> public URLs work in the browser. */
  private async ensureBucketPublicRead(): Promise<void> {
    if (!this.bucketName) {
      return;
    }
    try {
      await this.s3Client.send(
        new DeletePublicAccessBlockCommand({ Bucket: this.bucketName }),
      );
    } catch (err) {
      this.logger.warn(
        `s3.public_access_block_clear_failed bucket=${this.bucketName} err=${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "CreatorShopPublicRead",
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${this.bucketName}/*`],
        },
      ],
    });

    try {
      await this.s3Client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucketName,
          Policy: policy,
        }),
      );
      this.logger.log(`s3.bucket_public_read_ok name=${this.bucketName}`);
    } catch (err) {
      this.logger.warn(
        `s3.bucket_public_read_failed bucket=${this.bucketName} err=${err instanceof Error ? err.message : String(err)} — browser <img> may fail until bucket allows public GetObject`,
      );
    }
  }
}

function isMissingBucketError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const name = "name" in err ? String(err.name) : "";
  const message = "message" in err ? String(err.message) : "";
  const code =
    "$metadata" in err &&
    err.$metadata &&
    typeof err.$metadata === "object" &&
    "httpStatusCode" in err.$metadata
      ? Number(err.$metadata.httpStatusCode)
      : NaN;
  return (
    code === 404 ||
    name === "NotFound" ||
    name === "NoSuchBucket" ||
    name === "NotFoundException" ||
    /bucket does not exist/i.test(message)
  );
}

function isBucketAlreadyOwnedError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const name = "name" in err ? String(err.name) : "";
  return (
    name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists"
  );
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
