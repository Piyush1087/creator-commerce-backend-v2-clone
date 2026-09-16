import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";

import { runBounded } from "./instagram-video-decoder";
import { InstagramVideoTemporaryStore } from "./instagram-video-temporary-store";
import type { InstagramTemporaryVideoArtifact } from "./instagram-video.types";
import {
  INSTAGRAM_AUDIO_CHANNELS,
  INSTAGRAM_AUDIO_MAX_BYTES,
  INSTAGRAM_AUDIO_SAMPLE_RATE_HZ,
  type InstagramTemporaryAudioArtifact,
} from "./instagram-speech";

export abstract class InstagramAudioExtractorPort {
  abstract assertAvailable(): Promise<void>;
  abstract extract(input: {
    video: InstagramTemporaryVideoArtifact;
    isolationScope: string;
    signal?: AbortSignal;
  }): Promise<InstagramTemporaryAudioArtifact>;
}

@Injectable()
export class FfmpegInstagramAudioExtractor extends InstagramAudioExtractorPort {
  constructor(
    private readonly config: ConfigService,
    private readonly store: InstagramVideoTemporaryStore,
  ) {
    super();
  }

  async assertAvailable() {
    await runBounded(this.ffmpegPath, ["-version"]);
  }

  async extract(input: {
    video: InstagramTemporaryVideoArtifact;
    isolationScope: string;
    signal?: AbortSignal;
  }) {
    const created = await this.store.createAudio(input.isolationScope);
    await created.handle.close();
    try {
      await runBounded(
        this.ffmpegPath,
        [
          "-nostdin",
          "-v",
          "error",
          "-y",
          "-i",
          input.video.temporaryPath,
          "-vn",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-c:a",
          "pcm_s16le",
          "-f",
          "wav",
          created.path,
        ],
        input.signal,
      );
      const info = await lstat(created.path);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size <= 44 ||
        info.size > INSTAGRAM_AUDIO_MAX_BYTES
      )
        throw new Error("INVALID_BOUNDED_AUDIO");
      const bytes = await readFile(created.path);
      if (
        bytes.length !== info.size ||
        bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
        bytes.subarray(8, 12).toString("ascii") !== "WAVE"
      )
        throw new Error("INVALID_BOUNDED_AUDIO");
      return {
        temporaryPath: created.path,
        mediaType: "audio/wav" as const,
        byteLength: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        channels: INSTAGRAM_AUDIO_CHANNELS as 1,
        sampleRateHz: INSTAGRAM_AUDIO_SAMPLE_RATE_HZ as 16000,
        sampleFormat: "signed-16-bit PCM" as const,
      };
    } catch (error) {
      await this.store.remove(created.path).catch(() => undefined);
      throw error;
    }
  }

  private get ffmpegPath() {
    return (
      this.config.get<string>("INSTAGRAM_VIDEO_FFMPEG_PATH")?.trim() || "ffmpeg"
    );
  }
}
