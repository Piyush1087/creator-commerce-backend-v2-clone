import { z } from "zod";

import type { InstagramTemporaryImageArtifact } from "./instagram-image-acquisition.types";

export const INSTAGRAM_VISUAL_TEXT_CONTRACT_VERSION =
  "instagram-visible-text-v1";
export const INSTAGRAM_VISUAL_TEXT_PROMPT_PROFILE_VERSION =
  "instagram-visible-text-data-only-v1";
export const INSTAGRAM_VISUAL_TEXT_MAX_SPANS = 20;
export const INSTAGRAM_VISUAL_TEXT_MAX_SPAN_CHARS = 160;
export const INSTAGRAM_VISUAL_TEXT_MAX_TOTAL_CHARS = 1_600;

export const instagramVisualTextCandidateSchema = z
  .object({
    state: z.enum(["OBSERVED", "EXPLICIT_EMPTY"]),
    spans: z
      .array(z.string().max(INSTAGRAM_VISUAL_TEXT_MAX_SPAN_CHARS))
      .max(INSTAGRAM_VISUAL_TEXT_MAX_SPANS),
  })
  .strict()
  .superRefine((value, context) => {
    const total = value.spans.reduce((sum, span) => sum + span.length, 0);
    if (total > INSTAGRAM_VISUAL_TEXT_MAX_TOTAL_CHARS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Visible text exceeds the bounded total",
        path: ["spans"],
      });
    }
    if (value.state === "EXPLICIT_EMPTY" && value.spans.length !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Explicit empty visible text cannot contain spans",
        path: ["spans"],
      });
    }
    if (value.state === "OBSERVED" && value.spans.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Observed visible text requires a span",
        path: ["spans"],
      });
    }
  });

export type InstagramVisualTextObservation = Readonly<{
  state: "OBSERVED" | "EXPLICIT_EMPTY";
  spans: readonly string[];
}>;

export function finalizeInstagramVisualText(
  candidate: unknown,
): InstagramVisualTextObservation {
  const parsed = instagramVisualTextCandidateSchema.parse(candidate);
  const spans = [
    ...new Set(parsed.spans.map(normalizeVisibleText).filter(Boolean)),
  ].sort(compareCanonical);
  const total = spans.reduce((sum, span) => sum + span.length, 0);
  if (total > INSTAGRAM_VISUAL_TEXT_MAX_TOTAL_CHARS)
    throw new Error("Visible text exceeds the normalized bounded total");
  if (parsed.state === "OBSERVED" && spans.length === 0)
    throw new Error("Observed visible text normalized to empty");
  return parsed.state === "EXPLICIT_EMPTY"
    ? { state: "EXPLICIT_EMPTY", spans: [] }
    : { state: "OBSERVED", spans };
}

export function normalizeVisibleText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export abstract class InstagramVisualTextModelPort {
  abstract readonly providerIdentity: string;
  abstract readonly modelIdentity: string;
  abstract readonly modelProfileVersion: string;
  abstract observe(input: {
    temporaryPath: string;
    mediaType: InstagramTemporaryImageArtifact["mediaType"];
    byteLength: number;
    width: number;
    height: number;
    sha256: string;
    promptProfileVersion: typeof INSTAGRAM_VISUAL_TEXT_PROMPT_PROFILE_VERSION;
    observationContractVersion: typeof INSTAGRAM_VISUAL_TEXT_CONTRACT_VERSION;
    untrustedImageTextIsDataOnly: true;
  }): Promise<unknown>;
}

export class UnavailableInstagramVisualTextModelAdapter extends InstagramVisualTextModelPort {
  readonly providerIdentity = "UNCONFIGURED";
  readonly modelIdentity = "UNCONFIGURED";
  readonly modelProfileVersion = "UNCONFIGURED";

  async observe(): Promise<never> {
    throw new Error("Instagram visual-text model is not configured");
  }
}

function compareCanonical(left: string, right: string) {
  const a = left.toLocaleLowerCase("en-US");
  const b = right.toLocaleLowerCase("en-US");
  return a < b ? -1 : a > b ? 1 : left < right ? -1 : left > right ? 1 : 0;
}
