import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import type { BrandWorkspaceAuthorizationService } from "../brand-centre/brand-workspace-authorization.service";
import type { BrandConsumerService } from "../brand-centre/consumer/brand-consumer.service";
import type { SubscriptionCapabilityService } from "../pricing/services/subscription-capability.service";
import { SUBSCRIPTION_CAPABILITIES } from "../pricing/types/subscription-capability.types";
import { BrandWorkspaceReadinessConsumerService } from "./brand-workspace-readiness-consumer.service";

const actor: AuthUser = {
  id: "user-1",
  email: "owner@example.test",
  name: "Owner",
  role: UserRole.BRAND,
  organizationId: "organization-1",
};

function harness(options?: {
  workspaceReadiness?: "READY" | "PARTIAL" | "NOT_READY";
  subscription?: boolean;
  billingComplete?: boolean;
  fullAccess?: boolean;
}) {
  const fullAccess = options?.fullAccess ?? true;
  const getCapabilityDecision = vi.fn().mockImplementation(() =>
    Promise.resolve({
      allowed: fullAccess,
      code: fullAccess ? "ALLOWED" : "SUBSCRIPTION_RESTRICTED",
      access_mode: fullAccess ? "FULL_ACCESS" : "RESTRICTED_WIND_DOWN",
      lifecycle_status: fullAccess ? "TRIALING" : "HALTED",
      required_action: fullAccess ? "NONE" : "PAYMENT_REQUIRED",
      blocked_capability: null,
    }),
  );
  const complete = options?.billingComplete ?? true;
  const service = new BrandWorkspaceReadinessConsumerService(
    {
      brandSubscription: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            (options?.subscription ?? true) ? { id: "s" } : null,
          ),
      },
      brandBillingProfile: {
        findUnique: vi.fn().mockResolvedValue(
          complete
            ? {
                registeredCompanyName: "Acme",
                legalEntityType: "LLC",
                billingCountryCode: "IN",
                corporateBillingAddress: "1 Main Street",
              }
            : null,
        ),
      },
    } as unknown as PrismaService,
    {
      resolveBrandContext: vi.fn().mockResolvedValue({
        brandProfileId: "brand-1",
      }),
    } as unknown as BrandWorkspaceAuthorizationService,
    {
      readForWorkspace: vi.fn().mockResolvedValue({
        brandId: "brand-1",
        workspaceReadiness: options?.workspaceReadiness ?? "READY",
      }),
    } as unknown as BrandConsumerService,
    { getCapabilityDecision } as unknown as SubscriptionCapabilityService,
  );
  return { service, getCapabilityDecision };
}

describe("BrandWorkspaceReadinessConsumerService", () => {
  it("maps the complete fixture-equivalent state to ready/full-access/ready", async () => {
    const { service, getCapabilityDecision } = harness();
    const result = await service.read(actor);
    expect(result).toMatchObject({
      contractVersion: "1.0",
      brandId: "brand-1",
      workspace: { state: "READY", reasonCodes: [] },
      subscription: {
        state: "FULL_ACCESS",
        lifecycleStatus: "TRIALING",
        requiredAction: "NONE",
      },
      billing: { state: "READY", recoveryDestinationId: null },
      setupItems: [],
    });
    expect(getCapabilityDecision).toHaveBeenCalledTimes(
      SUBSCRIPTION_CAPABILITIES.length,
    );
  });

  it("reuses billing semantics and reports bounded recovery metadata", async () => {
    const result = await harness({
      workspaceReadiness: "PARTIAL",
      billingComplete: false,
    }).service.read(actor);
    expect(result.workspace).toMatchObject({ state: "ACTION_REQUIRED" });
    expect(result.billing).toEqual({
      state: "ACTION_REQUIRED",
      missingFieldCodes: [
        "legal_entity_name",
        "legal_entity_type",
        "billing_country_code",
        "billing_address",
      ],
      recoveryDestinationId: "SETTINGS_BILLING",
    });
    expect(result.setupItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ destinationId: "BRAND_CENTRE" }),
        expect.objectContaining({ destinationId: "SETTINGS_BILLING" }),
      ]),
    );
  });

  it("marks billing not applicable only when no subscription exists", async () => {
    const result = await harness({
      subscription: false,
      billingComplete: false,
      fullAccess: false,
    }).service.read(actor);
    expect(result.billing).toEqual({
      state: "NOT_APPLICABLE",
      missingFieldCodes: [],
      recoveryDestinationId: null,
    });
    expect(result.subscription.state).toBe("RESTRICTED_WIND_DOWN");
  });
});
