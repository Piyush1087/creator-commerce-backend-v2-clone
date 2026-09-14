import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { InstagramVideoDecoderPort } from "./instagram-video-decoder";
import { InstagramVideoTemporaryStore } from "./instagram-video-temporary-store";
import { selectInstagramVideoFrameTimestamps } from "./instagram-video.types";

const directory = dirname(fileURLToPath(import.meta.url));

describe("shared video foundation architecture", () => {
  it("exports provider-neutral decoder, timestamp, and temporary-storage seams", () => {
    expect(InstagramVideoDecoderPort).toBeTypeOf("function");
    expect(InstagramVideoTemporaryStore).toBeTypeOf("function");
    expect(selectInstagramVideoFrameTimestamps).toBeTypeOf("function");
  });

  it("does not import Brand Objects, Brand workspace, Creator, Campaign, Collaboration, Offering, or frontend types", async () => {
    const files = [
      "instagram-video.types.ts",
      "instagram-video-temporary-store.ts",
      "instagram-video-decoder.ts",
      "instagram-secure-video-downloader.ts",
      "instagram-video-locator.client.ts",
      "instagram-contained-video-acquisition.service.ts",
    ];
    const source = (
      await Promise.all(
        files.map((file) => readFile(join(directory, file), "utf8")),
      )
    ).join("\n");
    expect(source).not.toMatch(
      /from\s+["'][^"']*(?:brand-intelligence|brand-centre|frontend|creator|campaign|collaboration|offering)/i,
    );
  });
});
