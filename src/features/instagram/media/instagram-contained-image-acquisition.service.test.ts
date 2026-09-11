import { describe, expect, it, vi } from "vitest";

import {
  INSTAGRAM_LOCATOR_MAX_RESPONSE_BYTES,
  InstagramContainedImageAcquisitionService,
  InstagramImageLocatorClient,
  readBoundedLocatorJson,
} from "./instagram-contained-image-acquisition.service";
import { InstagramImageAcquisitionError } from "./instagram-image-acquisition.types";

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

describe("B3B bounded streamed locator response", () => {
  const encoded = (value: string) => new TextEncoder().encode(value);
  const responseFromChunks = (
    chunks: Uint8Array[],
    options?: {
      declared?: number;
      cancel?: ReturnType<typeof vi.fn>;
      stall?: boolean;
    },
  ) =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          if (!options?.stall) controller.close();
        },
        cancel: options?.cancel,
      }),
      {
        headers:
          options?.declared === undefined
            ? undefined
            : { "content-length": String(options.declared) },
      },
    );

  it("accepts valid object JSON exactly at the 65,536-byte limit", async () => {
    const prefix = '{"id":"media-a"}';
    const bytes = encoded(
      prefix + " ".repeat(INSTAGRAM_LOCATOR_MAX_RESPONSE_BYTES - prefix.length),
    );
    await expect(
      readBoundedLocatorJson(
        responseFromChunks([bytes], { declared: bytes.length }),
      ),
    ).resolves.toEqual({ id: "media-a" });
  });

  it("rejects declared oversize before reading and cancels the body", async () => {
    const cancel = vi.fn();
    await expect(
      readBoundedLocatorJson(
        responseFromChunks([encoded("{}")], {
          declared: INSTAGRAM_LOCATOR_MAX_RESPONSE_BYTES + 1,
          cancel,
        }),
      ),
    ).rejects.toBeInstanceOf(InstagramImageAcquisitionError);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["chunked oversize", undefined],
    ["absent-length oversize", undefined],
    ["dishonest smaller Content-Length", 2],
    ["overflow in a later chunk", undefined],
  ])("rejects %s and cancels the reader", async (_label, declared) => {
    const chunks = [
      encoded("{}"),
      new Uint8Array(INSTAGRAM_LOCATOR_MAX_RESPONSE_BYTES),
    ];
    const response = responseFromChunks(chunks, { declared });
    const reader = response.body!.getReader();
    const cancel = vi.spyOn(reader, "cancel");
    vi.spyOn(response.body!, "getReader").mockReturnValue(reader);
    await expect(readBoundedLocatorJson(response)).rejects.toMatchObject({
      code: "PROVIDER_FAILURE",
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each(["not-json", "[]", "null"])(
    "rejects malformed or non-object JSON without body leakage",
    async (body) => {
      const error = await readBoundedLocatorJson(
        responseFromChunks([encoded(body)]),
      ).catch((caught) => caught as Error);
      expect(error).toMatchObject({ code: "PROVIDER_FAILURE" });
      expect(error.message).not.toContain(body);
    },
  );

  it("cancels a stalled reader when the caller aborts", async () => {
    const cancel = vi.fn();
    const controller = new AbortController();
    const pending = readBoundedLocatorJson(
      responseFromChunks([], { cancel, stall: true }),
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "PROVIDER_FAILURE" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("uses bounded lookup fields for image, carousel child and video cover without leaking values", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (request) => {
        const url = new URL(String(request));
        const fields = url.searchParams.get("fields") ?? "";
        const cover = fields.includes("thumbnail_url");
        return new Response(
          JSON.stringify({
            id: url.pathname.split("/").pop(),
            media_type: cover ? "REEL" : "IMAGE",
            ...(cover
              ? { thumbnail_url: "https://scontent.cdninstagram.com/cover" }
              : { media_url: "https://scontent.cdninstagram.com/image" }),
          }),
        );
      });
    const client = new InstagramImageLocatorClient();
    const credential = {
      accessToken: "fixture-only",
      providerAccountId: "provider-a",
    };
    await client.read(credential, "image-a", "IMAGE");
    await client.read(credential, "child-a", "CAROUSEL_CHILD");
    await client.read(credential, "video-a", "VIDEO_COVER");
    expect(
      fetchMock.mock.calls.map(([request]) =>
        new URL(String(request)).searchParams.get("fields"),
      ),
    ).toEqual([
      "id,media_type,media_url,timestamp",
      "id,media_type,media_url,timestamp",
      "id,media_type,thumbnail_url,timestamp",
    ]);
    fetchMock.mockRestore();
  });
});
