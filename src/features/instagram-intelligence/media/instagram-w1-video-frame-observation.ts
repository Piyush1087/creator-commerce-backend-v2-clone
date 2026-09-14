import { z } from "zod";

import type { InstagramExtractedFrame } from "../../instagram/media/video/instagram-video.types";
import {
  INSTAGRAM_VIDEO_FRAME_OBSERVATION_CONTRACT_VERSION,
  INSTAGRAM_VIDEO_FRAME_PROMPT_PROFILE_VERSION,
} from "../../instagram/media/video/instagram-video.types";

export const instagramW1VideoFrameObservationSchema = z
  .object({
    description: z.string().trim().min(1).max(500),
    visibleElements: z.array(z.string().trim().min(1).max(100)).max(20),
    dominantColors: z.array(z.string().trim().min(1).max(50)).max(8),
    composition: z.string().trim().min(1).max(300),
  })
  .strict()
  .superRefine((value, context) => {
    const forbidden =
      /\b(?:creator|offering|collab(?:oration)?|campaign|performance|persona|signal|pattern|learning|recommendation|causal|pacing|scene change|spoken|transcript)\b/i;
    if (
      [
        value.description,
        value.composition,
        ...value.visibleElements,
        ...value.dominantColors,
      ].some((candidate) => forbidden.test(candidate))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Video frame output must remain low-level and descriptive",
      });
    }
  });

export abstract class InstagramW1VideoFrameModelPort {
  abstract readonly providerIdentity: string;
  abstract readonly modelIdentity: string;
  abstract readonly modelProfileVersion: string;
  abstract observe(input: {
    providerMediaId: string;
    verifiedVideoFingerprint: string;
    frame: InstagramExtractedFrame;
    promptProfileVersion: typeof INSTAGRAM_VIDEO_FRAME_PROMPT_PROFILE_VERSION;
    observationContractVersion: typeof INSTAGRAM_VIDEO_FRAME_OBSERVATION_CONTRACT_VERSION;
  }): Promise<unknown>;
}

export class UnavailableInstagramW1VideoFrameModelAdapter extends InstagramW1VideoFrameModelPort {
  readonly providerIdentity = "UNCONFIGURED";
  readonly modelIdentity = "UNCONFIGURED";
  readonly modelProfileVersion = "UNCONFIGURED";

  async observe(): Promise<never> {
    throw new Error("Instagram video frame model is not configured");
  }
}
