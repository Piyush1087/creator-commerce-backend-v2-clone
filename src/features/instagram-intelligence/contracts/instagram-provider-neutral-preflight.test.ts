import { Test } from "@nestjs/testing";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { InstagramGraphClient } from "../../instagram/instagram-graph.client";

type PreflightFixture = {
  accounts: Array<{ identity: string; providerAccountId: string }>;
  media: Array<{ mediaType: string; children: string[] }>;
  audience: Array<{ fixture: string; followers: string; engaged: string }>;
  providerErrors: Array<{
    fixture: string;
    classification: string;
    httpStatus: number;
  }>;
};

function loadFixture(): PreflightFixture {
  const path = join(
    __dirname,
    "fixtures",
    "instagram-provider-neutral-preflight.json",
  );
  return JSON.parse(readFileSync(path, "utf8")) as PreflightFixture;
}

describe("Instagram provider-neutral A3 preflight", () => {
  it("contains the complete deterministic provider-neutral fixture matrix", () => {
    const fixture = loadFixture();

    expect(
      new Set(fixture.accounts.map((row) => row.providerAccountId)).size,
    ).toBe(2);
    expect(fixture.media.map((row) => row.mediaType)).toEqual([
      "IMAGE",
      "CAROUSEL_ALBUM",
      "REELS",
    ]);
    expect(
      fixture.media.find((row) => row.mediaType === "CAROUSEL_ALBUM")?.children,
    ).toHaveLength(2);
    expect(fixture.audience).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fixture: "FULL" }),
        expect.objectContaining({ fixture: "PARTIAL" }),
        expect.objectContaining({ fixture: "UNAVAILABLE" }),
      ]),
    );
    expect(fixture.providerErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fixture: "AUTHORIZATION", httpStatus: 401 }),
        expect.objectContaining({ fixture: "TRANSIENT", httpStatus: 503 }),
      ]),
    );
  });

  it("replaces the installed Graph adapter at its single Nest provider token", async () => {
    const fixtureGraph = {
      fetchMe: vi.fn().mockResolvedValue({ userId: "ig-preflight-account-a" }),
      fetchRecentMedia: vi.fn().mockResolvedValue([]),
      fetchMediaInsights: vi.fn().mockResolvedValue({}),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [InstagramGraphClient],
    })
      .overrideProvider(InstagramGraphClient)
      .useValue(fixtureGraph)
      .compile();

    expect(moduleRef.get(InstagramGraphClient)).toBe(fixtureGraph);
    await expect(
      moduleRef.get(InstagramGraphClient).fetchRecentMedia("fixture"),
    ).resolves.toEqual([]);
    expect(fixtureGraph.fetchRecentMedia).toHaveBeenCalledWith("fixture");
  });
});
