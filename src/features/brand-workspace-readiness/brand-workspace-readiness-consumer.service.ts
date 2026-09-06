import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { BrandWorkspaceAuthorizationService } from "../brand-centre/brand-workspace-authorization.service";
import { BrandConsumerService } from "../brand-centre/consumer/brand-consumer.service";
import { billingReadiness } from "../brand-settings/billing/billing-readiness";
import { SUBSCRIPTION_CAPABILITIES } from "../pricing/types/subscription-capability.types";
import { SubscriptionCapabilityService } from "../pricing/services/subscription-capability.service";

@Injectable()
export class BrandWorkspaceReadinessConsumerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: BrandWorkspaceAuthorizationService,
    private readonly brandConsumer: BrandConsumerService,
    private readonly subscriptionCapabilities: SubscriptionCapabilityService,
  ) {}

  async read(user: AuthUser) {
    const observedAt = new Date();
    const { brandProfileId } = await this.workspace.resolveBrandContext(user);
    const brandState = await this.brandConsumer.readForWorkspace(user);
    if (brandState.brandId !== brandProfileId) {
      throw new Error("Brand workspace readiness scope mismatch");
    }

    const [subscription, billingProfile, capabilityDecisions] =
      await Promise.all([
        this.prisma.brandSubscription.findUnique({
          where: { brandProfileId },
          select: { id: true },
        }),
        this.prisma.brandBillingProfile.findUnique({
          where: { brandProfileId },
          select: {
            registeredCompanyName: true,
            legalEntityType: true,
            billingCountryCode: true,
            corporateBillingAddress: true,
          },
        }),
        Promise.all(
          SUBSCRIPTION_CAPABILITIES.map((capability) =>
            this.subscriptionCapabilities.getCapabilityDecision(
              brandProfileId,
              capability,
              observedAt,
            ),
          ),
        ),
      ]);

    const subscriptionAuthority = capabilityDecisions[0];
    if (!subscriptionAuthority) {
      throw new Error("Subscription capability authority unavailable");
    }
    const billingAuthority = billingReadiness(billingProfile);
    const billing = !subscription
      ? {
          state: "NOT_APPLICABLE" as const,
          missingFieldCodes: [] as string[],
          recoveryDestinationId: null,
        }
      : billingAuthority.is_complete_for_paid_conversion
        ? {
            state: "READY" as const,
            missingFieldCodes: [] as string[],
            recoveryDestinationId: null,
          }
        : {
            state: "ACTION_REQUIRED" as const,
            missingFieldCodes: [...billingAuthority.missing_required_fields],
            recoveryDestinationId: "SETTINGS_BILLING" as const,
          };

    const reasonCodes: string[] = [];
    const setupItems: {
      reasonCode: string;
      title: string;
      destinationId: string;
    }[] = [];
    if (brandState.workspaceReadiness === "PARTIAL") {
      reasonCodes.push("BRAND_WORKSPACE_PARTIAL");
      setupItems.push({
        reasonCode: "BRAND_WORKSPACE_PARTIAL",
        title: "Complete the remaining Brand workspace details",
        destinationId: "BRAND_CENTRE",
      });
    } else if (brandState.workspaceReadiness === "NOT_READY") {
      reasonCodes.push("BRAND_WORKSPACE_INCOMPLETE");
      setupItems.push({
        reasonCode: "BRAND_WORKSPACE_INCOMPLETE",
        title: "Complete Brand workspace setup",
        destinationId: "BRAND_CENTRE",
      });
    }
    if (subscriptionAuthority.access_mode !== "FULL_ACCESS") {
      reasonCodes.push("SUBSCRIPTION_ACCESS_RESTRICTED");
      setupItems.push({
        reasonCode: "SUBSCRIPTION_ACCESS_RESTRICTED",
        title: "Review subscription access",
        destinationId: "SETTINGS_BILLING",
      });
    }
    if (billing.state === "ACTION_REQUIRED") {
      reasonCodes.push("BILLING_PROFILE_INCOMPLETE");
      setupItems.push({
        reasonCode: "BILLING_PROFILE_INCOMPLETE",
        title: "Complete billing profile",
        destinationId: "SETTINGS_BILLING",
      });
    }

    const hasRequiredAction = reasonCodes.some(
      (code) => code !== "BRAND_WORKSPACE_PARTIAL",
    );
    return {
      contractVersion: "1.0" as const,
      brandId: brandProfileId,
      observedAt: observedAt.toISOString(),
      workspace: {
        state: hasRequiredAction
          ? ("ACTION_REQUIRED" as const)
          : brandState.workspaceReadiness === "PARTIAL"
            ? ("PARTIAL" as const)
            : ("READY" as const),
        reasonCodes: [...new Set(reasonCodes)],
      },
      subscription: {
        state: subscriptionAuthority.access_mode,
        lifecycleStatus: subscriptionAuthority.lifecycle_status,
        requiredAction: subscriptionAuthority.required_action,
      },
      applicationCapabilities: SUBSCRIPTION_CAPABILITIES.map(
        (capability, index) => {
          const decision = capabilityDecisions[index];
          if (!decision) {
            throw new Error(
              `Subscription capability decision missing: ${capability}`,
            );
          }
          return {
            id: capability,
            state: decision.allowed
              ? ("AVAILABLE" as const)
              : ("BLOCKED" as const),
            reasonCode: decision.code,
          };
        },
      ),
      billing,
      setupItems,
      limitations: [] as string[],
    };
  }
}
