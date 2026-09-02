import { BrandRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { NotificationRecipientPolicyService } from "./notification-recipient-policy.service";

const member = (userId: string, role: BrandRole) => ({
  userId,
  role,
  user: { id: userId, email: `${userId}@example.com`, name: userId },
});

describe("NotificationRecipientPolicyService", () => {
  it("resolves owner/finance and adds only the active triggering CM", async () => {
    const prisma = {
      brandTeamMember: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            member("owner", BrandRole.BRAND_OWNER),
            member("finance", BrandRole.FINANCE_ADMIN),
          ]),
        findFirst: vi
          .fn()
          .mockResolvedValue(member("cm", BrandRole.CAMPAIGN_MANAGER)),
      },
      user: { findUnique: vi.fn() },
    };
    const service = new NotificationRecipientPolicyService(prisma as never);
    const result = await service.resolve({
      workspaceId: "brand",
      policy: "OWNER_FINANCE_PLUS_ACTIVE_TRIGGERING_CM",
      triggerUserId: "cm",
      affectedUserId: null,
    });
    expect(result.map((row) => row.userId)).toEqual(["owner", "finance", "cm"]);
    expect(prisma.brandTeamMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          brandProfileId: "brand",
          userId: "cm",
          role: BrandRole.CAMPAIGN_MANAGER,
          isActive: true,
        }),
      }),
    );
  });

  it("uses direct email without an inbox for an affected account user", async () => {
    const prisma = {
      brandTeamMember: { findMany: vi.fn(), findFirst: vi.fn() },
      user: { findUnique: vi.fn() },
    };
    prisma.brandTeamMember.findFirst.mockResolvedValue({
      userId: "former",
      user: { id: "former", email: "former@example.com", name: null },
    });
    const service = new NotificationRecipientPolicyService(prisma as never);
    await expect(
      service.resolve({
        workspaceId: "brand",
        policy: "AFFECTED_USER_EMAIL_ONLY",
        triggerUserId: null,
        affectedUserId: "former",
      }),
    ).resolves.toEqual([
      {
        userId: "former",
        email: "former@example.com",
        name: null,
        inbox: false,
      },
    ]);
    expect(prisma.brandTeamMember.findMany).not.toHaveBeenCalled();
  });
});
