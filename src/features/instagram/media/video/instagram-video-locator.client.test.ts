import { afterEach, describe, expect, it, vi } from "vitest";

import { InstagramVideoLocatorClient } from "./instagram-video-locator.client";

afterEach(() => vi.restoreAllMocks());

describe("InstagramVideoLocatorClient", () => {
  it("requests only the minimum fields and validates media identity/type", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        id: "media_1",
        media_type: "REELS",
        media_url: "https://video.cdninstagram.com/source.mp4",
        timestamp: "2026-09-12T00:00:00.000Z",
      }),
    );
    const result = await new InstagramVideoLocatorClient().read(
      { accessToken: "fixture-token", providerAccountId: "account_1" },
      "media_1",
    );
    expect(result).toMatchObject({
      availability: "AVAILABLE",
      providerMediaId: "media_1",
      mediaType: "REELS",
    });
    const requested = fetchMock.mock.calls[0]![0] as URL;
    expect(requested.searchParams.get("fields")).toBe(
      "id,media_type,media_url,timestamp",
    );
    expect(JSON.stringify(result)).not.toContain("fixture-token");
  });

  it("reports partial truth when the locator is usable but observation time is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        id: "media_1",
        media_type: "VIDEO",
        media_url: "https://video.cdninstagram.com/source.mp4",
      }),
    );
    await expect(
      new InstagramVideoLocatorClient().read(
        { accessToken: "fixture-token", providerAccountId: "account_1" },
        "media_1",
      ),
    ).resolves.toMatchObject({ availability: "PARTIAL" });
  });

  it.each([
    [
      {
        id: "other",
        media_type: "VIDEO",
        media_url: "https://video.cdninstagram.com/a",
      },
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [
      {
        id: "media_1",
        media_type: "IMAGE",
        media_url: "https://video.cdninstagram.com/a",
      },
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [{ id: "media_1", media_type: "VIDEO" }, "LOCATOR_UNAVAILABLE"],
  ])("fails closed for invalid provider truth", async (body, reason) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(body));
    await expect(
      new InstagramVideoLocatorClient().read(
        { accessToken: "fixture-token", providerAccountId: "account_1" },
        "media_1",
      ),
    ).resolves.toMatchObject({ availability: "UNAVAILABLE", reason });
  });

  it("maps oversized or dishonest bounded JSON to provider failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-length": "65537" },
      }),
    );
    await expect(
      new InstagramVideoLocatorClient().read(
        { accessToken: "fixture-token", providerAccountId: "account_1" },
        "media_1",
      ),
    ).resolves.toMatchObject({
      availability: "UNAVAILABLE",
      reason: "PROVIDER_FAILURE",
    });
  });
});

function jsonResponse(value: unknown) {
  const body = JSON.stringify(value);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body)),
    },
  });
}
