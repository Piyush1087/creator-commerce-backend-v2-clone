import { BrandRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { BrandSettingsService } from "../services/brand-settings.service";

describe("individual Brand notification preferences", () => {
  it.each([
    BrandRole.BRAND_OWNER,
    BrandRole.FINANCE_ADMIN,
    BrandRole.CAMPAIGN_MANAGER,
  ])("%s reads six defaults and updates only self", async (role) => {
    const prisma = {
      userBrandNotificationPreference: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
      },
      brandNotificationSetting: { findMany: vi.fn() },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    };
    const access = {
      resolveBrandContext: vi
        .fn()
        .mockResolvedValue({ brandProfileId: "brand", membership: { role } }),
    };
    const service = new BrandSettingsService(
      prisma as never,
      access as never,
      {} as never,
      {} as never,
    );
    const user = { id: `user-${role}`, role: "BRAND" } as never;
    const defaults = await service.getNotifications(user);
    expect(defaults.settings).toHaveLength(6);
    expect(defaults.settings.every((row) => row.optional_email_enabled)).toBe(
      true,
    );
    expect(defaults.mandatory_system_email_unaffected).toBe(true);
    expect(prisma.brandNotificationSetting.findMany).not.toHaveBeenCalled();

    await service.updateNotifications(user, {
      settings: [
        { category: "BRAND_INTELLIGENCE", optionalEmailEnabled: false },
      ],
    });
    expect(prisma.userBrandNotificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          brandProfileId_userId_category: {
            brandProfileId: "brand",
            userId: `user-${role}`,
            category: "BRAND_INTELLIGENCE",
          },
        },
      }),
    );
  });
});
