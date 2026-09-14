import { z } from "zod";

import type { InstagramTemporaryImageArtifact } from "../../instagram/media/instagram-image-acquisition.types";

export const INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION = "1.0";
export const INSTAGRAM_B3A_NORMALIZATION_CONTRACT_VERSION =
  "instagram.media_visual_observations.b3a.v1";
export const INSTAGRAM_B3A_PROMPT_PROFILE_VERSION = "b3a-image-description-v1";

export const instagramB3aVisualObservationSchema = z
  .object({
    description: z.string().trim().min(1).max(500),
    visibleElements: z.array(z.string().trim().min(1).max(100)).max(20),
    dominantColors: z.array(z.string().trim().min(1).max(50)).max(8),
    composition: z.string().trim().min(1).max(300),
  })
  .strict()
  .superRefine((value, context) => {
    const forbiddenSemanticClaim =
      /\b(?:creator|offering|collab(?:oration)?|campaign|performance|persona|signal|pattern|learning|recommendation)\b/i;
    const values = [
      value.description,
      value.composition,
      ...value.visibleElements,
      ...value.dominantColors,
    ];
    if (values.some((candidate) => forbiddenSemanticClaim.test(candidate))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "B3A output must remain low-level and descriptive",
      });
    }
  });

export type InstagramB3aVisualObservation = z.infer<
  typeof instagramB3aVisualObservationSchema
>;

export abstract class InstagramB3aVisualModelPort {
  abstract readonly providerIdentity: string;
  abstract readonly modelIdentity: string;
  abstract readonly modelProfileVersion: string;

  abstract observe(
    input: Readonly<{
      temporaryPath: string;
      mediaType: InstagramTemporaryImageArtifact["mediaType"];
      byteLength: number;
      width: number;
      height: number;
      sha256: string;
      promptProfileVersion: typeof INSTAGRAM_B3A_PROMPT_PROFILE_VERSION;
      observationContractVersion: typeof INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION;
    }>,
  ): Promise<unknown>;
}

export class UnavailableInstagramB3aVisualModelAdapter extends InstagramB3aVisualModelPort {
  readonly providerIdentity = "UNCONFIGURED";
  readonly modelIdentity = "UNCONFIGURED";
  readonly modelProfileVersion = "UNCONFIGURED";

  async observe(): Promise<never> {
    throw new Error("Instagram B3A visual model is not configured");
  }
}
