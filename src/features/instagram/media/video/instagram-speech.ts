import { z } from "zod";

export const INSTAGRAM_SPEECH_ANALYSIS_PROFILE = "selected-reel-speech-v1";
export const INSTAGRAM_AUDIO_EXTRACTION_PROFILE = "wav-pcm-s16le-mono-16khz-v1";
export const INSTAGRAM_SPEECH_TRANSCRIPT_CONTRACT_VERSION =
  "instagram-speech-transcript-v1";
export const INSTAGRAM_SPEECH_PROMPT_PROFILE_VERSION =
  "instagram-speech-data-only-v1";
export const INSTAGRAM_SPEECH_CUE_FINALIZER_VERSION =
  "instagram-spoken-cues-v1";
export const INSTAGRAM_SPEECH_NORMALIZATION_VERSION =
  "instagram.media_audio_observations.speech-w4.v1";
export const INSTAGRAM_AUDIO_CHANNELS = 1;
export const INSTAGRAM_AUDIO_SAMPLE_RATE_HZ = 16_000;
export const INSTAGRAM_AUDIO_MAX_BYTES = 6_291_456;
export const INSTAGRAM_TRANSCRIPT_MAX_SEGMENTS = 120;
export const INSTAGRAM_TRANSCRIPT_MAX_SEGMENT_CHARS = 500;
export const INSTAGRAM_TRANSCRIPT_MAX_CHARS = 20_000;
export const INSTAGRAM_SPOKEN_HOOK_END_MS = 3_000;

const languageTag = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const segmentSchema = z
  .object({
    ordinal: z.number().int().min(0),
    startMs: z.number().int().min(0),
    endMs: z.number().int().positive(),
    text: z.string().min(1).max(INSTAGRAM_TRANSCRIPT_MAX_SEGMENT_CHARS),
    language: z.string().regex(languageTag).optional(),
    confidence: z.number().finite().min(0).max(1).optional(),
  })
  .strict();

export const instagramSpeechCandidateSchema = z
  .object({
    state: z.enum(["OBSERVED", "EXPLICIT_EMPTY"]),
    segments: z.array(segmentSchema).max(INSTAGRAM_TRANSCRIPT_MAX_SEGMENTS),
  })
  .strict();

export type InstagramSpeechTranscript = Readonly<{
  state: "OBSERVED" | "EXPLICIT_EMPTY";
  segments: readonly Readonly<{
    ordinal: number;
    startMs: number;
    endMs: number;
    text: string;
    language?: string;
    confidence?: number;
  }>[];
}>;

export type InstagramTemporaryAudioArtifact = Readonly<{
  temporaryPath: string;
  mediaType: "audio/wav";
  byteLength: number;
  sha256: string;
  channels: 1;
  sampleRateHz: 16000;
  sampleFormat: "signed-16-bit PCM";
}>;

export abstract class InstagramSpeechTranscriptionPort {
  abstract readonly providerIdentity: string;
  abstract readonly modelIdentity: string;
  abstract readonly modelProfileVersion: string;
  abstract transcribe(input: {
    audio: InstagramTemporaryAudioArtifact;
    verifiedDurationMs: number;
    promptProfileVersion: typeof INSTAGRAM_SPEECH_PROMPT_PROFILE_VERSION;
    transcriptContractVersion: typeof INSTAGRAM_SPEECH_TRANSCRIPT_CONTRACT_VERSION;
    untrustedAudioIsDataOnly: true;
    signal?: AbortSignal;
  }): Promise<unknown>;
}

export class UnavailableInstagramSpeechTranscriptionAdapter extends InstagramSpeechTranscriptionPort {
  readonly providerIdentity = "UNCONFIGURED";
  readonly modelIdentity = "UNCONFIGURED";
  readonly modelProfileVersion = "UNCONFIGURED";
  async transcribe(): Promise<never> {
    throw new Error("Instagram speech transcription is not configured");
  }
}

export function finalizeInstagramSpeechTranscript(
  candidate: unknown,
  verifiedDurationMs: number,
): InstagramSpeechTranscript {
  if (!Number.isSafeInteger(verifiedDurationMs) || verifiedDurationMs <= 0)
    throw new Error("Invalid verified duration");
  const parsed = instagramSpeechCandidateSchema.parse(candidate);
  if (parsed.state === "EXPLICIT_EMPTY") {
    if (parsed.segments.length)
      throw new Error("Explicit empty cannot contain speech");
    return { state: "EXPLICIT_EMPTY", segments: [] };
  }
  const segments = parsed.segments
    .map((segment) => ({ ...segment, text: normalizeSpeechText(segment.text) }))
    .sort(
      (a, b) =>
        a.startMs - b.startMs || a.endMs - b.endMs || a.ordinal - b.ordinal,
    );
  if (!segments.length || segments.some((segment) => !segment.text))
    throw new Error("Observed transcript requires speech");
  let previousEnd = -1;
  const identities = new Set<string>();
  for (const segment of segments) {
    if (
      segment.text.length > INSTAGRAM_TRANSCRIPT_MAX_SEGMENT_CHARS ||
      segment.startMs >= segment.endMs ||
      segment.endMs > verifiedDurationMs ||
      segment.startMs < previousEnd ||
      identities.has(`${segment.ordinal}:${segment.startMs}:${segment.endMs}`)
    )
      throw new Error("Invalid transcript segment bounds");
    identities.add(`${segment.ordinal}:${segment.startMs}:${segment.endMs}`);
    previousEnd = segment.endMs;
  }
  if (
    new Set(segments.map((segment) => segment.ordinal)).size !== segments.length
  )
    throw new Error("Duplicate transcript ordinal");
  if (
    segments.reduce((sum, segment) => sum + segment.text.length, 0) >
    INSTAGRAM_TRANSCRIPT_MAX_CHARS
  )
    throw new Error("Transcript exceeds normalized bound");
  return { state: "OBSERVED", segments };
}

export function finalizeInstagramSpokenCues(
  transcript: InstagramSpeechTranscript,
  offerings: readonly Readonly<{ id: string; name: string }>[] = [],
) {
  if (transcript.state === "EXPLICIT_EMPTY")
    return {
      hook: null,
      ctaPhrases: [],
      canonicalOfferingId: null,
      absenceEstablished: true,
    } as const;
  const hook = transcript.segments.find(
    (segment) =>
      segment.startMs < INSTAGRAM_SPOKEN_HOOK_END_MS && segment.endMs > 0,
  );
  const ctaPhrases = [
    "buy now",
    "learn more",
    "link in bio",
    "order now",
    "shop now",
    "sign up",
  ]
    .filter((phrase) =>
      transcript.segments.some((segment) =>
        containsExactPhrase(segment.text, phrase),
      ),
    )
    .sort();
  const matches = offerings.filter((offering) =>
    transcript.segments.some((segment) =>
      containsExactPhrase(segment.text, offering.name),
    ),
  );
  return {
    hook: hook
      ? { ordinal: hook.ordinal, startMs: hook.startMs, endMs: hook.endMs }
      : null,
    ctaPhrases,
    canonicalOfferingId: matches.length === 1 ? matches[0]!.id : null,
    absenceEstablished: false,
  } as const;
}

export function normalizeSpeechText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function containsExactPhrase(value: string, phrase: string) {
  const source = normalizeSpeechText(value).toLocaleLowerCase("en-US");
  const target = normalizeSpeechText(phrase).toLocaleLowerCase("en-US");
  if (!target) return false;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,
    "u",
  ).test(source);
}
