import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Creator Audience V0 architecture boundaries", () => {
  it("exposes one authenticated no-store read route without refresh or delete", () => {
    const controller = readFileSync(
      resolve(__dirname, "creator-audience.controller.ts"),
      "utf8",
    );
    expect(controller).toContain(
      '@Controller("api/v1/creator/insights/audience")',
    );
    expect(controller).toContain("JwtAuthGuard");
    expect(controller).toContain('"private, no-store"');
    expect(controller).not.toMatch(/@Post|@Put|@Patch|@Delete|refresh/i);
  });

  it("keeps credential decryption inside the dedicated provider fence", () => {
    const fence = readFileSync(
      resolve(__dirname, "creator-audience-credential-fence.service.ts"),
      "utf8",
    );
    const consumer = readFileSync(
      resolve(__dirname, "creator-audience.service.ts"),
      "utf8",
    );
    expect(fence).toContain("decryptField");
    expect(consumer).not.toContain("decryptField");
  });
});
