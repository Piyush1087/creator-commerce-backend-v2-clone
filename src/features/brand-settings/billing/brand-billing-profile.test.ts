import { ForbiddenException } from "@nestjs/common";
import { BrandRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { CoPilotHitlService } from "../../co-pilot/services/co-pilot-hitl.service";
import { BrandBillingProfileSchema } from "../schemas/brand-settings.schema";
import type { BrandSettingsAccessService } from "../services/brand-settings-access.service";
import {
  billingReadiness,
  BrandSettingsService,
} from "../services/brand-settings.service";
import type { BrandTeamInvitationsService } from "../services/brand-team-invitations.service";
import type { BrandTeamService } from "../services/brand-team.service";

const canonicalInput = {
  legalEntityName: "Acme Private Limited",
  legalEntityType: "Private Limited Company",
  billingCountryCode: "IN",
  billingAddress: "1 Billing Street, Bengaluru 560001",
};

describe("BS-03 canonical Billing contract", () => {
  it("accepts optional GSTIN and normalizes country independently", () => {
    expect(
      BrandBillingProfileSchema.parse({
        ...canonicalInput,
        billingCountryCode: "us",
      }),
    ).toMatchObject({ billingCountryCode: "US", gstin: null });
  });

  it.each(["pan", "defaultTdsPercentage", "currencyPreference"])(
    "rejects deprecated canonical write field %s",
    (field) => {
      expect(
        BrandBillingProfileSchema.safeParse({
          ...canonicalInput,
          [field]: field === "defaultTdsPercentage" ? 2 : "legacy",
        }).success,
      ).toBe(false);
    },
  );

  it("treats GSTIN as India-specific", () => {
    expect(
      BrandBillingProfileSchema.safeParse({
        ...canonicalInput,
        billingCountryCode: "US",
        gstin: "27ABCDE1234F1Z5",
      }).success,
    ).toBe(false);
  });

  it("rejects a structurally valid but nonexistent ISO country code", () => {
    expect(
      BrandBillingProfileSchema.safeParse({
        ...canonicalInput,
        billingCountryCode: "ZZ",
      }).success,
    ).toBe(false);
  });

  it("reports NOT_CONFIGURED readiness without inventing legal identity", () => {
    expect(billingReadiness(null)).toEqual({
      is_complete_for_paid_conversion: false,
      missing_required_fields: [
        "legal_entity_name",
        "legal_entity_type",
        "billing_country_code",
        "billing_address",
      ],
    });
  });

  it.each([
    ["registeredCompanyName", "legal_entity_name"],
    ["legalEntityType", "legal_entity_type"],
    ["billingCountryCode", "billing_country_code"],
    ["corporateBillingAddress", "billing_address"],
  ] as const)("reports missing %s", (property, expected) => {
    const source = {
      registeredCompanyName: "Acme",
      legalEntityType: "LLC",
      billingCountryCode: "US",
      corporateBillingAddress: "100 Main Street",
    };
    source[property] = "";
    expect(billingReadiness(source)).toMatchObject({
      is_complete_for_paid_conversion: false,
      missing_required_fields: [expected],
    });
  });

  it("marks all required canonical fields complete without GSTIN", () => {
    expect(
      billingReadiness({
        registeredCompanyName: canonicalInput.legalEntityName,
        legalEntityType: canonicalInput.legalEntityType,
        billingCountryCode: canonicalInput.billingCountryCode,
        corporateBillingAddress: canonicalInput.billingAddress,
      }),
    ).toEqual({
      is_complete_for_paid_conversion: true,
      missing_required_fields: [],
    });
  });
});

describe("BS-03 Billing lifecycle and authorization", () => {
  const user = { id: "user-1", email: "owner@example.test" } as AuthUser;

  function harness(role: BrandRole, existing: Record<string, unknown> | null) {
    const findUnique = vi.fn().mockResolvedValue(existing);
    const upsert = vi.fn().mockImplementation(({ create, update }) =>
      Promise.resolve({
        id: "billing-1",
        ...(existing ? { ...existing, ...update } : create),
        updatedAt: new Date("2026-08-28T12:00:00.000Z"),
      }),
    );
    const createVersion = vi.fn().mockResolvedValue({ id: "version-1" });
    const transactionClient = {
      brandBillingProfile: { findUnique, upsert },
      brandBillingProfileVersion: { create: createVersion },
    };
    const prisma = {
      brandBillingProfile: { findUnique, upsert },
      $transaction: (run: (tx: typeof transactionClient) => unknown) =>
        run(transactionClient),
    } as unknown as PrismaService;
    const access = {
      resolveBrandContext: vi.fn().mockResolvedValue({
        brandProfileId: "brand-1",
        membership: { role },
      }),
      assertFinancialMutation(requestedRole: BrandRole) {
        if (requestedRole === BrandRole.CAMPAIGN_MANAGER)
          throw new ForbiddenException("Read-only");
      },
      isFinancialReadOnly: (requestedRole: BrandRole) =>
        requestedRole === BrandRole.CAMPAIGN_MANAGER,
    } as unknown as BrandSettingsAccessService;
    return {
      service: new BrandSettingsService(
        prisma,
        access,
        {} as BrandTeamService,
        {} as BrandTeamInvitationsService,
      ),
      findUnique,
      upsert,
      createVersion,
    };
  }

  it.each([BrandRole.BRAND_OWNER, BrandRole.FINANCE_ADMIN])(
    "%s creates a CONFIGURED profile",
    async (role) => {
      const { service, upsert, createVersion } = harness(role, null);
      const result = await service.upsertBillingProfile(user, canonicalInput);
      expect(result.billing_profile.profile_state).toBe("CONFIGURED");
      expect(result.is_complete_for_paid_conversion).toBe(true);
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ profileState: "CONFIGURED" }),
        }),
      );
      expect(createVersion).toHaveBeenCalledTimes(1);
    },
  );

  it("a subsequent material Finance Admin update becomes UPDATED", async () => {
    const { service, createVersion } = harness(BrandRole.FINANCE_ADMIN, {
      registeredCompanyName: canonicalInput.legalEntityName,
      legalEntityType: canonicalInput.legalEntityType,
      billingCountryCode: "US",
      corporateBillingAddress: canonicalInput.billingAddress,
      gstin: null,
      profileState: "CONFIGURED",
      configuredAt: new Date("2026-08-27T12:00:00.000Z"),
    });
    const result = await service.upsertBillingProfile(user, canonicalInput);
    expect(result.billing_profile.profile_state).toBe("UPDATED");
    expect(createVersion).toHaveBeenCalledTimes(1);
  });

  it("a no-op update does not create a history version", async () => {
    const { service, createVersion } = harness(BrandRole.BRAND_OWNER, {
      registeredCompanyName: canonicalInput.legalEntityName,
      legalEntityType: canonicalInput.legalEntityType,
      billingCountryCode: canonicalInput.billingCountryCode,
      corporateBillingAddress: canonicalInput.billingAddress,
      gstin: null,
      profileState: "CONFIGURED",
      configuredAt: new Date("2026-08-27T12:00:00.000Z"),
    });
    await service.upsertBillingProfile(user, canonicalInput);
    expect(createVersion).not.toHaveBeenCalled();
  });

  it("Campaign Manager can read but cannot mutate", async () => {
    const { service } = harness(BrandRole.CAMPAIGN_MANAGER, null);
    await expect(service.getBillingProfile(user)).resolves.toMatchObject({
      billing_profile: null,
      profile_state: "NOT_CONFIGURED",
      is_read_only: true,
      is_complete_for_paid_conversion: false,
    });
    await expect(
      service.upsertBillingProfile(user, canonicalInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("BS-03 Co-Pilot compatibility", () => {
  const confirm = Reflect.get(
    CoPilotHitlService.prototype,
    "confirmSettingsUpdateBilling",
  ) as (
    this: unknown,
    args: { userId: string; threadId: string },
    staged: Record<string, unknown>,
  ) => Promise<unknown>;

  it("writes only canonical Billing fields after HITL confirmation", async () => {
    const upsertBillingProfile = vi.fn().mockResolvedValue({});
    const actor = {
      id: "actor",
      email: "actor@example.test",
      role: "BRAND",
    } as AuthUser;
    const context = {
      brandSettings: { upsertBillingProfile },
      optionalString: (value: unknown) =>
        typeof value === "string" && value.trim() ? value.trim() : undefined,
      confirmSettingsAction: ({
        run,
      }: {
        run: (user: AuthUser) => Promise<unknown>;
      }) => run(actor),
    };
    await expect(
      confirm.call(
        context,
        { userId: actor.id, threadId: "thread" },
        canonicalInput,
      ),
    ).resolves.toBe("Billing profile saved.");
    expect(upsertBillingProfile).toHaveBeenCalledWith(
      actor,
      expect.objectContaining(canonicalInput),
    );
    expect(upsertBillingProfile.mock.calls[0]?.[1]).not.toHaveProperty("pan");
    expect(upsertBillingProfile.mock.calls[0]?.[1]).not.toHaveProperty(
      "defaultTdsPercentage",
    );
    expect(upsertBillingProfile.mock.calls[0]?.[1]).not.toHaveProperty(
      "currencyPreference",
    );
  });

  it.each(["pan", "defaultTdsPercentage", "currencyPreference"])(
    "cannot bypass canonical validation with staged %s",
    async (field) => {
      const upsertBillingProfile = vi.fn();
      const context = {
        brandSettings: { upsertBillingProfile },
        optionalString: (value: unknown) => value,
        confirmSettingsAction: ({
          run,
        }: {
          run: (user: AuthUser) => Promise<unknown>;
        }) => run({ id: "actor", email: "actor@example.test" } as AuthUser),
      };
      await expect(
        confirm.call(
          context,
          { userId: "actor", threadId: "thread" },
          { ...canonicalInput, [field]: "legacy" },
        ),
      ).resolves.toBe("Billing profile saved.");
      expect(upsertBillingProfile.mock.calls[0]?.[1]).not.toHaveProperty(field);
    },
  );
});
