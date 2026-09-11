import { describe, expect, it, vi } from "vitest";

import {
  InstagramContainedImageAcquisitionService,
  InstagramImageLocatorClient,
} from "./instagram-contained-image-acquisition.service";

describe("B3A credential and ephemeral-locator containment", () => {
  it("keeps credential material in the provider boundary and the locator in the contained adapter", async () => {
    const credentialMaterial = ["fixture", "credential", "material"].join("-");
    const locatorMaterial = "https://scontent.cdninstagram.com/private-locator";
    const locatorClient = {
      read: vi.fn().mockImplementation(async (credential) => {
        expect(credential.accessToken).toBe(credentialMaterial);
        return {
          providerMediaId: "media-a",
          locator: locatorMaterial,
          providerObservedAt: null,
        };
      }),
    };
    const downloader = {
      download: vi.fn().mockImplementation(async (input) => {
        expect(input.locator).toBe(locatorMaterial);
        return {
          temporaryPath: "random-task-owned.img",
          mediaType: "image/png",
          byteLength: 10,
          width: 1,
          height: 1,
          sha256: "a".repeat(64),
          acquiredAt: "2026-09-11T10:00:00.000Z",
        };
      }),
    };
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await new InstagramContainedImageAcquisitionService(
      locatorClient as never,
      downloader as never,
    ).acquire({
      credential: {
        accessToken: credentialMaterial,
        providerAccountId: "provider-a",
      },
      mediaId: "media-a",
      isolationScope: "brand-a",
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(credentialMaterial);
    expect(serialized).not.toContain(locatorMaterial);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    log.mockRestore();
    warn.mockRestore();
  });

  it("requests only the one image locator from the fixed Graph route and returns safe errors", async () => {
    const providerFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "media-a",
            media_type: "IMAGE",
            media_url: "https://scontent.cdninstagram.com/opaque",
            timestamp: "2026-09-10T08:00:00.000Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const client = new InstagramImageLocatorClient();
    const first = await client.read(
      { accessToken: "fixture-only", providerAccountId: "provider-a" },
      "media-a",
    );
    const requested = new URL(String(providerFetch.mock.calls[0][0]));
    expect(requested.origin).toBe("https://graph.instagram.com");
    expect(requested.searchParams.get("fields")).toBe(
      "id,media_type,media_url,timestamp",
    );
    expect(first.providerMediaId).toBe("media-a");

    await expect(
      client.read(
        { accessToken: "fixture-only", providerAccountId: "provider-a" },
        "media-a",
      ),
    ).rejects.toMatchObject({
      code: "LOCATOR_UNAVAILABLE",
      message: "Instagram image acquisition unavailable: LOCATOR_UNAVAILABLE",
    });
    providerFetch.mockRestore();
  });

  it("rejects changed media identity and non-image media without returning provider data", async () => {
    const providerFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "different-media",
            media_type: "IMAGE",
            media_url: "https://scontent.cdninstagram.com/opaque",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "media-a",
            media_type: "VIDEO",
            media_url: "https://scontent.cdninstagram.com/opaque",
          }),
          { status: 200 },
        ),
      );
    const client = new InstagramImageLocatorClient();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        client.read(
          { accessToken: "fixture-only", providerAccountId: "provider-a" },
          "media-a",
        ),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });
    }
    providerFetch.mockRestore();
  });
});
