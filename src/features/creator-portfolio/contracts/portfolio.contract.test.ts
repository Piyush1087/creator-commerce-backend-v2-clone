import { describe, expect, it } from "vitest";
import {
  DestinationSchema,
  PortfolioItemSchema,
  PortfolioMutationSchema,
  PortfolioProvenanceSchema,
  normalizePortfolioDestination,
  portfolioIdentity,
} from "./portfolio.contract";

describe("Portfolio V3 exact source, provenance and curation contracts", () => {
  it.each([
    "http://example.com/work",
    "https://user:pass@example.com/work",
    "https://127.0.0.1/work",
    "https://localhost/work",
    "https://cdninstagram.com/work",
    "https://fbcdn.net/work",
    "https://example.com/?access_token=synthetic",
    "https://example.com/?X-Amz-Signature=synthetic",
    "https://example.com/?expires=10",
  ])("rejects unsafe or ephemeral destination %s", (url) => {
    expect(DestinationSchema.safeParse(url).success).toBe(false);
  });
  it("normalizes only actual stable Instagram post/Reel destinations", () => {
    expect(
      normalizePortfolioDestination(
        "https://instagram.com/reel/Ab_12/?utm_source=web#x",
      ),
    ).toBe("https://www.instagram.com/reel/Ab_12/");
    expect(
      normalizePortfolioDestination("https://www.instagram.com/p/Ab_12"),
    ).toBe("https://www.instagram.com/p/Ab_12/");
    expect(
      DestinationSchema.safeParse(
        "https://www.instagram.com/stories/someone/123/",
      ).success,
    ).toBe(false);
  });
  it("retains authorized work-reference link without acquiring its content", () => {
    expect(
      normalizePortfolioDestination(
        "https://drive.google.com/file/d/example/view",
      ),
    ).toBe("https://drive.google.com/file/d/example/view");
  });
  it("binds canonical item identity to its Creator and stable source, never metrics", () => {
    expect(portfolioIdentity("one", "account:media")).toBe(
      portfolioIdentity("one", "account:media"),
    );
    expect(portfolioIdentity("one", "account:media")).not.toBe(
      portfolioIdentity("two", "account:media"),
    );
    expect(portfolioIdentity("one", "account:media")).not.toBe(
      portfolioIdentity("one", "account:other"),
    );
  });
  const now = "2026-09-16T00:00:00.000Z";
  const provided = { source: "CREATOR_PROVIDED", createdAt: now };
  const base = {
    id: portfolioIdentity("owner", "work"),
    kind: "EXTERNAL",
    destination: "https://example.com/work",
    title: "One work reference",
    creatorContext: null,
    brandLabel: null,
    workDate: null,
    state: "INCLUDED",
    provenance: [provided],
    presentation: "SOURCE_LINK_ONLY",
    access: "ACCESS_REQUIREMENTS_UNKNOWN",
  };
  it("is an individual reference, not a project, upload or player", () => {
    expect(PortfolioItemSchema.safeParse(base).success).toBe(true);
    for (const extra of [
      { projectId: "project" },
      { rawImage: "synthetic" },
      { autoplay: true },
      { thumbnailUrl: "https://example.com/cover" },
      { token: "synthetic" },
    ])
      expect(PortfolioItemSchema.safeParse({ ...base, ...extra }).success).toBe(
        false,
      );
  });
  it("has lightweight reversible removal, not source deletion", () => {
    expect(
      PortfolioItemSchema.parse({ ...base, state: "REMOVED" }).provenance,
    ).toEqual([provided]);
    for (const intent of ["REMOVE", "RESTORE"])
      expect(
        PortfolioMutationSchema.safeParse({
          intent,
          expectedRevision: 0,
          idempotencyKey: "12345678-1234-4234-8234-123456789abc",
          itemId: base.id,
        }).success,
      ).toBe(true);
    expect(
      PortfolioMutationSchema.safeParse({
        intent: "DELETE_INSTAGRAM_DATA",
        expectedRevision: 0,
      }).success,
    ).toBe(false);
  });
  it("does not conflate commercial verification with Instagram verification", () => {
    const shop = {
      source: "CREATOR_SHOP",
      collaborationId: "12345678-1234-4234-8234-123456789abc",
      deliverableExecutionId: "12345678-1234-4234-8234-123456789abc",
      evidenceId: "12345678-1234-4234-8234-123456789abc",
      verification: "PUBLISHING_VERIFIED",
      verifiedAt: now,
      sourceHash: "a".repeat(64),
    };
    expect(PortfolioProvenanceSchema.safeParse(shop).success).toBe(true);
    expect(
      PortfolioProvenanceSchema.safeParse({ ...shop, instagramVerified: true })
        .success,
    ).toBe(false);
    expect(
      PortfolioItemSchema.safeParse({ ...base, provenance: [provided, shop] })
        .success,
    ).toBe(true);
  });
  it("does not fabricate Story capability", () => {
    expect(
      PortfolioItemSchema.safeParse({ ...base, kind: "INSTAGRAM_STORY" })
        .success,
    ).toBe(false);
  });
  it("rejects verified-fact edits and unknown mutation fields at the boundary", () => {
    const command = {
      intent: "ADD_REFERENCE",
      expectedRevision: 0,
      idempotencyKey: "12345678-1234-4234-8234-123456789abc",
      kind: "UGC",
      destination: "https://example.com/ugc",
      title: "Work",
      creatorContext: null,
      workDate: null,
    };
    expect(PortfolioMutationSchema.safeParse(command).success).toBe(true);
    for (const extra of [
      { instagramVerified: true },
      { collaborationId: "x" },
      { upload: "x" },
      { ownerProfileId: "x" },
    ])
      expect(
        PortfolioMutationSchema.safeParse({ ...command, ...extra }).success,
      ).toBe(false);
  });
});
