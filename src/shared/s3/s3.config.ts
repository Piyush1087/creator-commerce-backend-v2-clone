/** Default v2 public asset buckets per stage (ap-south-1). */
export const S3_BUCKET_BY_STAGE: Record<string, string> = {
  local: "creatorshop-v2-files-local",
  dev: "creatorshop-v2-files-dev",
  prod: "creatorshop-v2-files-prod",
};

export const DEFAULT_S3_REGION = "ap-south-1";

export function resolveS3BucketName(stage: string | undefined): string | null {
  const fromEnv = process.env.S3_BUCKET_NAME?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const key = (stage ?? "local").trim().toLowerCase();
  return S3_BUCKET_BY_STAGE[key] ?? S3_BUCKET_BY_STAGE.local;
}

export function publicS3ObjectUrl(
  bucket: string,
  region: string,
  key: string,
): string {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}
