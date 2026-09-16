import { describe, expect, it } from "vitest";

import { INSTAGRAM_DE_CONTRACT } from "../../../instagram-intelligence/contracts/instagram-intelligence.registry";
import {
  instagramAccountResourceKey,
  instagramMediaResourceKey,
  resolveInstagramResourceIdentity,
} from "../identity/resource-identity";

describe("B1 Instagram DE resource identity and vocabulary", () => {
  it("derives the runnable vocabulary from the installed contract", () => {
    expect(INSTAGRAM_DE_CONTRACT.sourceClass).toBe("INSTAGRAM_OWNED");
    expect(INSTAGRAM_DE_CONTRACT.resourceTypes).toEqual([
      "INSTAGRAM_ACCOUNT",
      "INSTAGRAM_MEDIA",
    ]);
    expect(INSTAGRAM_DE_CONTRACT.capabilities).toHaveLength(9);
  });

  it("constructs the exact stable account and media keys", () => {
    expect(instagramAccountResourceKey("account-1")).toBe(
      "instagram:account-1:account",
    );
    expect(instagramMediaResourceKey("account-1", "media-9")).toBe(
      "instagram:account-1:media:media-9",
    );
  });

  it("excludes mutable handle and authorization generation from identity", () => {
    const first = resolveInstagramResourceIdentity({
      providerAccountId: "account-1",
      resourceType: "INSTAGRAM_MEDIA",
      mediaId: "media-9",
    });
    const afterHandleAndGenerationChange = resolveInstagramResourceIdentity({
      providerAccountId: "account-1",
      resourceType: "INSTAGRAM_MEDIA",
      mediaId: "media-9",
    });
    expect(afterHandleAndGenerationChange).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(
      /handle|generation|token|signed/i,
    );
  });

  it("treats a carousel as one media resource", () => {
    const carousel = resolveInstagramResourceIdentity({
      providerAccountId: "account-1",
      resourceType: "INSTAGRAM_MEDIA",
      mediaId: "carousel-1",
    });
    expect(carousel.canonicalResourceKey).toBe(
      "instagram:account-1:media:carousel-1",
    );
    expect(carousel.resourceType).toBe("INSTAGRAM_MEDIA");
  });
});
