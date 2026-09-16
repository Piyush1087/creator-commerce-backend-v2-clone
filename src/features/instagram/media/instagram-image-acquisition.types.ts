export const INSTAGRAM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const INSTAGRAM_IMAGE_CONNECT_TIMEOUT_MS = 5_000;
export const INSTAGRAM_IMAGE_READ_TIMEOUT_MS = 5_000;
export const INSTAGRAM_IMAGE_TOTAL_TIMEOUT_MS = 15_000;
export const INSTAGRAM_IMAGE_MAX_REDIRECTS = 3;
export const INSTAGRAM_IMAGE_MAX_WIDTH = 8_192;
export const INSTAGRAM_IMAGE_MAX_HEIGHT = 8_192;
export const INSTAGRAM_IMAGE_MAX_PIXELS = 25_000_000;
export const INSTAGRAM_IMAGE_STALE_TEMP_MAX_AGE_MS = 6 * 60 * 60 * 1_000;

export const INSTAGRAM_IMAGE_CDN_SUFFIX_ALLOWLIST = [
  "cdninstagram.com",
  "fbcdn.net",
] as const;

export type InstagramImageAcquisitionFailureCode =
  | "LOCATOR_UNAVAILABLE"
  | "PROVIDER_FAILURE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "UNSAFE_URL"
  | "UNSAFE_DNS"
  | "REDIRECT_REJECTED"
  | "REDIRECT_LIMIT"
  | "TIMEOUT"
  | "HTTP_FAILURE"
  | "OVERSIZED_IMAGE"
  | "UNSUPPORTED_IMAGE_TYPE"
  | "INVALID_IMAGE"
  | "TEMPORARY_STORAGE_FAILURE";

export class InstagramImageAcquisitionError extends Error {
  constructor(readonly code: InstagramImageAcquisitionFailureCode) {
    super(`Instagram image acquisition unavailable: ${code}`);
    this.name = "InstagramImageAcquisitionError";
  }
}

export type InstagramTemporaryImageArtifact = Readonly<{
  temporaryPath: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  byteLength: number;
  width: number;
  height: number;
  sha256: string;
  acquiredAt: string;
}>;

export type InstagramContainedImageAcquisitionResult = Readonly<{
  artifact: InstagramTemporaryImageArtifact;
  providerMediaId: string;
  providerObservedAt: string | null;
}>;
