import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { PrismaClient } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { CreatorAudienceCredentialFenceService } from "../../creator-audience/creator-audience-credential-fence.service";
import type { InstagramIntelligenceProviderReadClient } from "../../instagram/instagram-intelligence-provider.types";
import { CreatorContentMultimodalService } from "../../creator-content/creator-content-multimodal.service";
import { creatorContentExternalFixture } from "../../creator-content/testing/creator-content-external.fixture";
import { InstagramContainedImageAcquisitionService } from "../../instagram/media/instagram-contained-image-acquisition.service";
import { InstagramContainedVideoAcquisitionService } from "../../instagram/media/video/instagram-contained-video-acquisition.service";
import { InstagramSecureImageDownloader } from "../../instagram/media/instagram-secure-image-downloader";
import { InstagramSecureVideoDownloader } from "../../instagram/media/video/instagram-secure-video-downloader";
export async function audienceV1ContentTestFixture(
  db: PrismaClient,
  capturedAt: Date,
  captionForIndex: (index: number) => string = () => "untrusted source text",
) {
  let providerCalls = 0;
  const failProvider = false;
  const contentPostCount = 8;
  const provider: InstagramIntelligenceProviderReadClient = {
    readProfile: async () => {
      throw new Error("UNEXPECTED_METHOD");
    },
    readAudienceInsights: async () => {
      throw new Error("UNEXPECTED_METHOD");
    },
    readCarouselChildren: async () => {
      providerCalls += 1;
      return {
        availability: "AVAILABLE",
        stopReason: "EXHAUSTED",
        children: [0, 1].map((ordinal) => ({
          providerMediaId: `child-${ordinal}`,
          ordinal,
          mediaType: { state: "OBSERVED", value: "IMAGE" },
          mediaProductType: { state: "OBSERVED", value: "FEED" },
        })),
      };
    },
    readMediaInventory: async (_credential, end, days) => {
      if (days !== 90) throw new Error("CONTENT_FIXTURE_WINDOW_MISMATCH");
      if (end.getTime() !== capturedAt.getTime())
        throw new Error("CONTENT_FIXTURE_CUTOFF_MISMATCH");
      providerCalls += 1;
      if (failProvider) throw new Error("FIXTURE_PROVIDER_FAILURE");
      const items = Array.from({ length: contentPostCount }, (_, index) => ({
        providerMediaId: `media-${index}`,
        mediaType: {
          state: "OBSERVED" as const,
          value: index === 0 ? "CAROUSEL_ALBUM" : "IMAGE",
        },
        mediaProductType: {
          state: "OBSERVED" as const,
          value:
            index === 1 ? "REELS" : index === 0 ? "CAROUSEL_ALBUM" : "IMAGE",
        },
        permalink: {
          state: "OBSERVED" as const,
          value: `https://www.instagram.com/p/media-${index}/`,
        },
        caption: {
          state: "OBSERVED" as const,
          value: captionForIndex(index),
        },
        timestamp: {
          state: "OBSERVED" as const,
          value: new Date(
            capturedAt.getTime() - (index === 7 ? 45 : index) * 86_400_000,
          ).toISOString(),
        },
      }));
      return {
        availability: "AVAILABLE" as const,
        items,
        coverage: {
          windowStart: new Date(
            capturedAt.getTime() - 90 * 86_400_000,
          ).toISOString(),
          windowEnd: capturedAt.toISOString(),
          pagesAttempted: 1,
          pagesCompleted: 1,
          rowsReturned: items.length,
          rowsEligible: items.length,
          rowsMissingTimestamp: 0,
          duplicatesDiscarded: 0,
          oldestObservedTimestamp: items.at(-1)!.timestamp.value,
          newestObservedTimestamp: items[0].timestamp.value,
          stopReason: "EXHAUSTED" as const,
        },
      };
    },
    readMediaInsights: async (_, mediaId) => {
      providerCalls += 1;
      const high = Number(mediaId.slice(-1)) < 4;
      const metric = (value: number) =>
        value === 0
          ? ({ state: "OBSERVED_ZERO", value: 0 } as const)
          : ({ state: "OBSERVED", value } as const);
      const metrics = {
        comments: metric(1),
        likes: metric(high ? 20 : 5),
        reach: metric(100),
        saved: metric(1),
        shares: metric(1),
        total_interactions: metric(high ? 20 : 5),
        views: metric(100),
      };
      const unavailable = {
        state: "UNAVAILABLE" as const,
        reason: "NO_PROVIDER_DENOMINATOR" as const,
      };
      return {
        availability: "AVAILABLE" as const,
        mediaType: "IMAGE",
        metrics,
        units: {
          comments: "COUNT" as const,
          likes: "COUNT" as const,
          reach: "COUNT" as const,
          saved: "COUNT" as const,
          shares: "COUNT" as const,
          total_interactions: "COUNT" as const,
          views: "COUNT" as const,
        },
        denominators: {
          comments: unavailable,
          likes: unavailable,
          reach: unavailable,
          saved: unavailable,
          shares: unavailable,
          total_interactions: unavailable,
          views: unavailable,
        },
        providerObservationTime: {
          state: "UNAVAILABLE" as const,
          reason: "PROVIDER_DOES_NOT_RETURN_OBSERVATION_TIME" as const,
        },
        providerLagLimitHours: 48 as const,
      };
    },
  };

  const external = await creatorContentExternalFixture(
    `portfolio-v3-${randomUUID()}`,
  );
  const analyzer = new CreatorContentMultimodalService(
    new ConfigService({
      INSTAGRAM_IMAGE_VISUAL_ENABLED: "true",
      INSTAGRAM_SELECTED_VIDEO_FRAMES_ENABLED: "true",
      INSTAGRAM_SELECTED_VIDEO_SPEECH_ENABLED: "true",
    }),
    new CreatorAudienceCredentialFenceService(db as never),
    provider,
    new InstagramContainedImageAcquisitionService(
      external.imageLocator,
      new InstagramSecureImageDownloader(
        external.resolver,
        external.transport,
        external.imageStore,
      ),
    ),
    external.imageStore,
    new InstagramContainedVideoAcquisitionService(
      external.videoLocator,
      new InstagramSecureVideoDownloader(
        external.resolver,
        external.transport,
        external.videoStore,
      ),
    ),
    external.videoStore,
    external.decoder,
    external.audio,
    external.visual,
    external.ocr,
    external.frameModel,
    external.speech,
    external.grounded,
  );
  return {
    provider,
    analyzer,
    external,
    providerCalls: () => providerCalls,
    cleanup: async () => {
      const root = resolve(
        dirname(external.imageStore.getRootForDiagnostics()),
      );
      if (
        dirname(root) !== resolve(tmpdir()) ||
        !/^creator-content-correction-portfolio-v3-[a-f0-9-]{36}$/u.test(
          basename(root),
        )
      )
        throw new Error("TASK_OWNED_MEDIA_CLEANUP_REQUIRED");
      await rm(root, { recursive: true, force: true });
    },
  };
}
