import { z } from "zod";

import {
  InstagramLikelyCollabSchema,
  InstagramMediaObservationSchema,
  InstagramObservedMetricSchema,
  InstagramSourceValueSchema,
  InstagramWorkspaceConsumerSchema,
} from "../contracts/instagram-intelligence.schemas";

// The public route keeps its established class/file identity while C4 upgrades
// its response to the accepted complete workspace contract.
export const InstagramB4ConsumerSchema = InstagramWorkspaceConsumerSchema;
export type InstagramB4Consumer = z.infer<typeof InstagramB4ConsumerSchema>;

export const InstagramMediaDetailConsumerSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    mediaId: z.string().min(1),
    mediaType: InstagramMediaObservationSchema.innerType().shape.mediaType,
    publishedAt: InstagramSourceValueSchema,
    permalink: InstagramSourceValueSchema,
    caption: InstagramSourceValueSchema,
    hashtags: z.array(z.string().min(1)).max(100),
    mentions: z.array(z.string().min(1)).max(100),
    themes: InstagramMediaObservationSchema.innerType().shape.themes,
    captionPatterns:
      InstagramMediaObservationSchema.innerType().shape.captionPatterns,
    creativeStructures:
      InstagramMediaObservationSchema.innerType().shape.creativeStructures,
    visualExecutions:
      InstagramMediaObservationSchema.innerType().shape.visualExecutions,
    creatorPresence:
      InstagramMediaObservationSchema.innerType().shape.creatorPresence,
    offeringPresence:
      InstagramMediaObservationSchema.innerType().shape.offeringPresence,
    likelyCollab: InstagramLikelyCollabSchema,
    metrics: z.array(InstagramObservedMetricSchema),
    inspection: InstagramMediaObservationSchema.innerType().shape.inspection,
    coverage: z
      .object({
        sourceEvidenceCount: z.number().int().positive(),
        limitations: z.array(z.string().min(1)),
      })
      .strict(),
    evidence: z
      .object({
        refs: z.array(z.string().min(1)).min(1),
        capturedAt: z.string().datetime(),
      })
      .strict(),
  })
  .strict();

export type InstagramMediaDetailConsumer = z.infer<
  typeof InstagramMediaDetailConsumerSchema
>;
