import { describe, expect, it } from "vitest";
import { adaptPortfolioC04 } from "./portfolio-c04.adapter";
const owner = { creatorProfileId: "creator-one", workspaceId: "workspace-one" };
const source = {
  creatorProfileId: owner.creatorProfileId,
  creatorWorkspaceId: owner.workspaceId,
  collaborationId: "12345678-1234-4234-8234-123456789abc",
  deliverableExecutionId: "12345678-1234-4234-8234-123456789abc",
  evidenceId: "12345678-1234-4234-8234-123456789abc",
  authority: "CANONICAL_V1",
  lifecycle: "COMPLETED",
  publishingRequired: true,
  state: "PUBLISHING_VERIFIED",
  verifiedAt: "2026-09-16T00:00:00.000Z",
  destination: "https://www.instagram.com/reel/ExactSource/",
};
describe("Portfolio C04 read-only commercial verification seam", () => {
  it("does not manufacture Instagram verification from C04 verification", () => {
    const value = adaptPortfolioC04(source, owner);
    expect(value.provenance.source).toBe("CREATOR_SHOP");
    expect(value.provenance).not.toHaveProperty("accountId");
    expect(value.provenance).not.toHaveProperty("instagramVerified");
    expect(value.provenance).not.toHaveProperty("canonicalCreatorId");
  });
  it("supports completed approved UGC without creator-handle publishing", () => {
    const value = adaptPortfolioC04(
      {
        ...source,
        publishingRequired: false,
        state: "UGC_APPROVED_COMPLETED",
        destination: "https://drive.google.com/file/d/ugc-work/view",
      },
      owner,
    );
    expect(value.provenance.verification).toBe("UGC_APPROVED_COMPLETED");
  });
  it.each([
    { creatorProfileId: "other" },
    { creatorWorkspaceId: "other" },
    { lifecycle: "ACTIVE" },
    { authority: "LEGACY_COMPATIBILITY" },
    { state: "UGC_APPROVED_COMPLETED" },
    { destination: "https://cdninstagram.com/synthetic" },
    { token: "synthetic" },
  ])(
    "fails closed for substitution/incomplete/non-shareable source %j",
    (changed) => {
      expect(() =>
        adaptPortfolioC04({ ...source, ...changed }, owner),
      ).toThrow();
    },
  );
});
