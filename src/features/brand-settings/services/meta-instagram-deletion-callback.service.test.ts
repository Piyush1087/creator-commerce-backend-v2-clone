import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaInstagramDeletionCallbackService } from "./meta-instagram-deletion-callback.service";

describe("Meta Instagram data deletion callback", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("validates HMAC-SHA256 before entering the canonical deletion engine", async () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "test-secret");
    vi.stubEnv("PUBLIC_API_BASE_URL", "https://api.example.test");
    const deletion = {
      requestByMetaCallback: vi.fn().mockResolvedValue({
        requestIds: ["request-id"],
        confirmationCode: "persisted-confirmation",
      }),
    };
    const service = new MetaInstagramDeletionCallbackService(deletion as never);
    const signedRequest = sign(
      { algorithm: "HMAC-SHA256", user_id: "app-scoped-subject" },
      "test-secret",
    );
    const result = await service.handle(signedRequest);
    expect(deletion.requestByMetaCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        providerAppScopedUserId: "app-scoped-subject",
        callbackRequestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(result.confirmation_code).toBe("persisted-confirmation");
    expect(result.url).toContain(result.confirmation_code);
    expect(result).not.toHaveProperty("accessToken");
  });

  it("rejects an invalid signature before deletion", async () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "test-secret");
    const deletion = { requestByMetaCallback: vi.fn() };
    const service = new MetaInstagramDeletionCallbackService(deletion as never);
    await expect(
      service.handle(sign({ algorithm: "HMAC-SHA256", user_id: "x" }, "wrong")),
    ).rejects.toThrow("Invalid signed request");
    expect(deletion.requestByMetaCallback).not.toHaveBeenCalled();
  });
});

function sign(payload: Record<string, unknown>, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${signature}.${encoded}`;
}
