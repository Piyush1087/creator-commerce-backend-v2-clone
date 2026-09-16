export const INSTAGRAM_VIDEO_ANALYSIS_PROFILE = "selected-reel-frames-v1";
export const INSTAGRAM_VIDEO_FRAME_SELECTION_PROFILE =
  "canonical-six-timestamps-v1";
export const INSTAGRAM_VIDEO_FRAME_OBSERVATION_CONTRACT_VERSION = "1.0";
export const INSTAGRAM_VIDEO_FRAME_PROMPT_PROFILE_VERSION =
  "video-frame-description-v1";
export const INSTAGRAM_VIDEO_NORMALIZATION_CONTRACT_VERSION =
  "instagram.media_visual_observations.video-frames.w1.v1";

export const INSTAGRAM_VIDEO_MAX_DOWNLOAD_BYTES = 104_857_600;
export const INSTAGRAM_VIDEO_MAX_DURATION_SECONDS = 180;
export const INSTAGRAM_VIDEO_MAX_SELECTED_FRAMES = 6;
export const INSTAGRAM_VIDEO_FRAME_LONG_EDGE_MAX_PIXELS = 1_280;
export const INSTAGRAM_VIDEO_FRAME_ENCODED_MAX_BYTES = 4_194_304;
export const INSTAGRAM_VIDEO_CONNECT_TIMEOUT_MS = 5_000;
export const INSTAGRAM_VIDEO_READ_TIMEOUT_MS = 30_000;
export const INSTAGRAM_VIDEO_TOTAL_TIMEOUT_MS = 60_000;
export const INSTAGRAM_VIDEO_PROCESS_TIMEOUT_MS = 30_000;
export const INSTAGRAM_VIDEO_PROCESS_OUTPUT_MAX_BYTES = 65_536;
export const INSTAGRAM_VIDEO_MAX_REDIRECTS = 3;

export const INSTAGRAM_VIDEO_CDN_SUFFIX_ALLOWLIST = [
  "cdninstagram.com",
  "fbcdn.net",
] as const;

export type InstagramVideoFailureCode =
  | "LOCATOR_UNAVAILABLE"
  | "PROVIDER_FAILURE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "UNSAFE_URL"
  | "UNSAFE_DNS"
  | "REDIRECT_REJECTED"
  | "REDIRECT_LIMIT"
  | "TIMEOUT"
  | "HTTP_FAILURE"
  | "OVERSIZED_VIDEO"
  | "UNSUPPORTED_VIDEO_TYPE"
  | "INVALID_VIDEO"
  | "DURATION_EXCEEDED"
  | "FRAME_LIMIT_EXCEEDED"
  | "INVALID_FRAME"
  | "DECODER_UNAVAILABLE"
  | "DECODER_FAILURE"
  | "TEMPORARY_STORAGE_FAILURE";

export class InstagramVideoError extends Error {
  constructor(readonly code: InstagramVideoFailureCode) {
    super(code);
    this.name = "InstagramVideoError";
  }
}

export type InstagramVideoLocatorTruth =
  | Readonly<{
      availability: "AVAILABLE" | "PARTIAL";
      providerMediaId: string;
      mediaType: "REEL" | "REELS" | "VIDEO";
      locator: string;
      providerObservedAt: string | null;
    }>
  | Readonly<{
      availability: "UNAVAILABLE";
      providerMediaId: string;
      reason: "LOCATOR_UNAVAILABLE" | "UNSUPPORTED_MEDIA_TYPE";
    }>
  | Readonly<{
      availability: "UNAVAILABLE";
      providerMediaId: string;
      reason: "PROVIDER_FAILURE";
    }>;

export type InstagramTemporaryVideoArtifact = Readonly<{
  temporaryPath: string;
  mediaType: "video/mp4";
  byteLength: number;
  sha256: string;
  acquiredAt: string;
}>;

export type InstagramVideoProbe = Readonly<{
  container: "mp4";
  codec: "h264" | "hevc" | "vp9" | "av1";
  durationMilliseconds: number;
  width: number;
  height: number;
}>;

export type InstagramExtractedFrame = Readonly<{
  temporaryPath: string;
  ordinal: number;
  requestedTimestampMilliseconds: number;
  actualTimestampMilliseconds: number | null;
  mediaType: "image/jpeg";
  byteLength: number;
  width: number;
  height: number;
  sha256: string;
}>;

export function assertInstagramExtractedFrame(
  frame: InstagramExtractedFrame,
): void {
  if (
    !Number.isSafeInteger(frame.ordinal) ||
    frame.ordinal < 0 ||
    !Number.isSafeInteger(frame.requestedTimestampMilliseconds) ||
    frame.requestedTimestampMilliseconds < 0 ||
    (frame.actualTimestampMilliseconds !== null &&
      (!Number.isSafeInteger(frame.actualTimestampMilliseconds) ||
        frame.actualTimestampMilliseconds < 0)) ||
    frame.mediaType !== "image/jpeg" ||
    !Number.isSafeInteger(frame.byteLength) ||
    frame.byteLength <= 0 ||
    frame.byteLength > INSTAGRAM_VIDEO_FRAME_ENCODED_MAX_BYTES ||
    !Number.isSafeInteger(frame.width) ||
    !Number.isSafeInteger(frame.height) ||
    frame.width <= 0 ||
    frame.height <= 0 ||
    Math.max(frame.width, frame.height) >
      INSTAGRAM_VIDEO_FRAME_LONG_EDGE_MAX_PIXELS ||
    !/^[a-f0-9]{64}$/.test(frame.sha256)
  )
    throw new InstagramVideoError("INVALID_FRAME");
}

export function selectInstagramVideoFrameTimestamps(
  durationMilliseconds: number,
): number[] {
  if (
    !Number.isSafeInteger(durationMilliseconds) ||
    durationMilliseconds <= 0 ||
    durationMilliseconds > INSTAGRAM_VIDEO_MAX_DURATION_SECONDS * 1_000
  ) {
    throw new InstagramVideoError(
      durationMilliseconds > INSTAGRAM_VIDEO_MAX_DURATION_SECONDS * 1_000
        ? "DURATION_EXCEEDED"
        : "INVALID_VIDEO",
    );
  }
  const end = Math.max(durationMilliseconds - 250, 0);
  return [
    0,
    1_500,
    3_000,
    Math.round(durationMilliseconds * 0.5),
    Math.round(durationMilliseconds * 0.8),
    end,
  ]
    .filter((value) => value >= 0 && value < durationMilliseconds)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((a, b) => a - b)
    .slice(0, INSTAGRAM_VIDEO_MAX_SELECTED_FRAMES);
}
