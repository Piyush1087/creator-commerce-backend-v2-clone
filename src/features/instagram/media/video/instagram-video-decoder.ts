import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

import { InstagramVideoTemporaryStore } from "./instagram-video-temporary-store";
import {
  INSTAGRAM_VIDEO_FRAME_ENCODED_MAX_BYTES,
  INSTAGRAM_VIDEO_FRAME_LONG_EDGE_MAX_PIXELS,
  INSTAGRAM_VIDEO_PROCESS_OUTPUT_MAX_BYTES,
  INSTAGRAM_VIDEO_PROCESS_TIMEOUT_MS,
  type InstagramExtractedFrame,
  type InstagramTemporaryVideoArtifact,
  type InstagramVideoProbe,
  InstagramVideoError,
} from "./instagram-video.types";

export abstract class InstagramVideoDecoderPort {
  abstract probe(
    artifact: InstagramTemporaryVideoArtifact,
    signal?: AbortSignal,
  ): Promise<InstagramVideoProbe>;
  abstract extractFrames(input: {
    artifact: InstagramTemporaryVideoArtifact;
    timestampsMilliseconds: readonly number[];
    isolationScope: string;
    signal?: AbortSignal;
  }): Promise<readonly InstagramExtractedFrame[]>;
  abstract assertAvailable(): Promise<void>;
}

@Injectable()
export class FfmpegInstagramVideoDecoder extends InstagramVideoDecoderPort {
  constructor(
    private readonly config: ConfigService,
    private readonly store: InstagramVideoTemporaryStore,
  ) {
    super();
  }

  async assertAvailable() {
    await runBounded(this.ffprobePath, ["-version"]);
    await runBounded(this.ffmpegPath, ["-version"]);
  }

  async probe(
    artifact: InstagramTemporaryVideoArtifact,
    signal?: AbortSignal,
  ): Promise<InstagramVideoProbe> {
    const result = await runBounded(
      this.ffprobePath,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,width,height:format=format_name,duration",
        "-of",
        "json",
        artifact.temporaryPath,
      ],
      signal,
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      throw new InstagramVideoError("INVALID_VIDEO");
    }
    const root = record(parsed);
    const streams = Array.isArray(root.streams) ? root.streams.map(record) : [];
    const stream = streams[0];
    const format = record(root.format);
    const codec = stream?.codec_name;
    const durationSeconds = Number(format.duration);
    const durationMilliseconds = Math.round(durationSeconds * 1_000);
    const width = Number(stream?.width);
    const height = Number(stream?.height);
    const formatName = String(format.format_name ?? "");
    if (!formatName.split(",").some((value) => value === "mp4"))
      throw new InstagramVideoError("UNSUPPORTED_VIDEO_TYPE");
    if (!["h264", "hevc", "vp9", "av1"].includes(String(codec)))
      throw new InstagramVideoError("UNSUPPORTED_VIDEO_TYPE");
    if (
      !Number.isSafeInteger(durationMilliseconds) ||
      durationMilliseconds <= 0 ||
      durationMilliseconds > 180_000 ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new InstagramVideoError(
        durationMilliseconds > 180_000 ? "DURATION_EXCEEDED" : "INVALID_VIDEO",
      );
    }
    return {
      container: "mp4",
      codec: codec as InstagramVideoProbe["codec"],
      durationMilliseconds,
      width,
      height,
    };
  }

  async extractFrames(input: {
    artifact: InstagramTemporaryVideoArtifact;
    timestampsMilliseconds: readonly number[];
    isolationScope: string;
    signal?: AbortSignal;
  }): Promise<readonly InstagramExtractedFrame[]> {
    if (input.timestampsMilliseconds.length > 6)
      throw new InstagramVideoError("FRAME_LIMIT_EXCEEDED");
    const frames: InstagramExtractedFrame[] = [];
    try {
      for (const [
        ordinal,
        timestamp,
      ] of input.timestampsMilliseconds.entries()) {
        if (!Number.isSafeInteger(timestamp) || timestamp < 0)
          throw new InstagramVideoError("INVALID_FRAME");
        const created = await this.store.createFrame(input.isolationScope);
        await created.handle.close();
        try {
          await runBounded(
            this.ffmpegPath,
            [
              "-nostdin",
              "-v",
              "error",
              "-y",
              "-ss",
              (timestamp / 1_000).toFixed(3),
              "-i",
              input.artifact.temporaryPath,
              "-frames:v",
              "1",
              "-vf",
              `scale='min(${INSTAGRAM_VIDEO_FRAME_LONG_EDGE_MAX_PIXELS},iw)':'min(${INSTAGRAM_VIDEO_FRAME_LONG_EDGE_MAX_PIXELS},ih)':force_original_aspect_ratio=decrease`,
              "-q:v",
              "3",
              created.path,
            ],
            input.signal,
          );
          const bytes = await readFile(created.path);
          if (
            !bytes.length ||
            bytes.length > INSTAGRAM_VIDEO_FRAME_ENCODED_MAX_BYTES
          )
            throw new InstagramVideoError("INVALID_FRAME");
          const metadata = await sharp(bytes, {
            failOn: "error",
            limitInputPixels: INSTAGRAM_VIDEO_FRAME_LONG_EDGE_MAX_PIXELS ** 2,
          }).metadata();
          if (
            metadata.format !== "jpeg" ||
            !metadata.width ||
            !metadata.height ||
            Math.max(metadata.width, metadata.height) >
              INSTAGRAM_VIDEO_FRAME_LONG_EDGE_MAX_PIXELS
          )
            throw new InstagramVideoError("INVALID_FRAME");
          frames.push({
            temporaryPath: created.path,
            ordinal,
            requestedTimestampMilliseconds: timestamp,
            actualTimestampMilliseconds: null,
            mediaType: "image/jpeg",
            byteLength: bytes.length,
            width: metadata.width,
            height: metadata.height,
            sha256: createHash("sha256").update(bytes).digest("hex"),
          });
        } catch (error) {
          await this.store.remove(created.path).catch(() => undefined);
          if (
            input.signal?.aborted ||
            (error instanceof InstagramVideoError && error.code === "TIMEOUT")
          )
            throw error;
          // A single undecodable timestamp is truthful partial coverage. Other
          // successfully decoded frames remain usable and exactly identified.
          continue;
        }
      }
      return frames;
    } catch (error) {
      await Promise.all(
        frames.map((frame) =>
          this.store.remove(frame.temporaryPath).catch(() => undefined),
        ),
      );
      throw error;
    }
  }

  private get ffmpegPath() {
    return (
      this.config.get<string>("INSTAGRAM_VIDEO_FFMPEG_PATH")?.trim() || "ffmpeg"
    );
  }

  private get ffprobePath() {
    return (
      this.config.get<string>("INSTAGRAM_VIDEO_FFPROBE_PATH")?.trim() ||
      "ffprobe"
    );
  }
}

export async function runBounded(
  command: string,
  args: readonly string[],
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> {
  if (!command.trim() || signal?.aborted)
    throw new InstagramVideoError("DECODER_UNAVAILABLE");
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const fail = (error: InstagramVideoError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill("SIGKILL");
      reject(error);
    };
    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > INSTAGRAM_VIDEO_PROCESS_OUTPUT_MAX_BYTES) {
        fail(new InstagramVideoError("DECODER_FAILURE"));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    const timer = setTimeout(
      () => fail(new InstagramVideoError("TIMEOUT")),
      INSTAGRAM_VIDEO_PROCESS_TIMEOUT_MS,
    );
    const abort = () => fail(new InstagramVideoError("TIMEOUT"));
    signal?.addEventListener("abort", abort, { once: true });
    child.once("error", () =>
      fail(new InstagramVideoError("DECODER_UNAVAILABLE")),
    );
    child.once("close", (code) => {
      signal?.removeEventListener("abort", abort);
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new InstagramVideoError("DECODER_FAILURE"));
        return;
      }
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
