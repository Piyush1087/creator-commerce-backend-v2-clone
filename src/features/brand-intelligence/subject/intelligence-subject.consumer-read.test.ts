import { IntelligenceSubjectType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { findExistingIntelligenceSubject } from "./intelligence-subject.resolver";

function client(options?: {
  subject?: { id: string; offeringId?: string | null } | null;
  offering?: { id: string } | null;
}) {
  return {
    intelligenceSubject: {
      findUnique: vi.fn().mockResolvedValue(options?.subject ?? null),
      create: vi.fn(),
    },
    offering: {
      findUnique: vi.fn().mockResolvedValue(options?.offering ?? null),
    },
  };
}

describe("Intelligence existing-only consumer subject lookup", () => {
  it("reads an existing Brand subject without creating state", async () => {
    const prisma = client({ subject: { id: "subject-brand" } });
    await expect(
      findExistingIntelligenceSubject(prisma as never, "brand-1"),
    ).resolves.toMatchObject({ id: "subject-brand" });
    expect(prisma.intelligenceSubject.findUnique).toHaveBeenCalledWith({
      where: {
        brandId_subjectType_subjectRef: {
          brandId: "brand-1",
          subjectType: IntelligenceSubjectType.BRAND,
          subjectRef: "brand-1",
        },
      },
    });
    expect(prisma.intelligenceSubject.create).not.toHaveBeenCalled();
  });

  it("returns null for a missing Brand subject without creating state", async () => {
    const prisma = client();
    await expect(
      findExistingIntelligenceSubject(prisma as never, "brand-1"),
    ).resolves.toBeNull();
    expect(prisma.intelligenceSubject.create).not.toHaveBeenCalled();
  });

  it("authorizes and reads an existing Offering subject without creating state", async () => {
    const prisma = client({
      offering: { id: "offering-1" },
      subject: { id: "subject-offering", offeringId: "offering-1" },
    });
    await expect(
      findExistingIntelligenceSubject(prisma as never, "brand-1", {
        type: "OFFERING",
        ref: "offering-1",
      }),
    ).resolves.toMatchObject({ id: "subject-offering" });
    expect(prisma.offering.findUnique).toHaveBeenCalledWith({
      where: {
        brandProfileId_id: {
          brandProfileId: "brand-1",
          id: "offering-1",
        },
      },
      select: { id: true },
    });
    expect(prisma.intelligenceSubject.create).not.toHaveBeenCalled();
  });

  it("returns null for an authorized Offering with no subject and rejects a foreign Offering", async () => {
    const authorized = client({ offering: { id: "offering-1" } });
    await expect(
      findExistingIntelligenceSubject(authorized as never, "brand-1", {
        type: "OFFERING",
        ref: "offering-1",
      }),
    ).resolves.toBeNull();
    expect(authorized.intelligenceSubject.create).not.toHaveBeenCalled();

    const foreign = client();
    await expect(
      findExistingIntelligenceSubject(foreign as never, "brand-1", {
        type: "OFFERING",
        ref: "foreign-offering",
      }),
    ).rejects.toThrow("exact Offering");
    expect(foreign.intelligenceSubject.findUnique).not.toHaveBeenCalled();
    expect(foreign.intelligenceSubject.create).not.toHaveBeenCalled();
  });
});
