import { ForbiddenException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type {
  SubscriptionCapability,
  SubscriptionCapabilityDecision,
} from "../types/subscription-capability.types";
import { SubscriptionAccessService } from "./subscription-access.service";

@Injectable()
export class SubscriptionCapabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SubscriptionAccessService,
  ) {}

  async getCapabilityDecision(
    brandProfileId: string,
    capability: SubscriptionCapability,
    now = new Date(),
  ): Promise<SubscriptionCapabilityDecision> {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
    });
    const authority = subscription
      ? this.access.derive(subscription, now)
      : {
          lifecycleStatus: "HALTED" as const,
          accessMode: "RESTRICTED_WIND_DOWN" as const,
          requiredAction: "PAYMENT_REQUIRED" as const,
        };
    const allowed = authority.accessMode === "FULL_ACCESS";
    return {
      allowed,
      code: allowed ? "ALLOWED" : "SUBSCRIPTION_RESTRICTED",
      access_mode: authority.accessMode,
      lifecycle_status: authority.lifecycleStatus,
      required_action: authority.requiredAction,
      blocked_capability: allowed ? null : capability,
    };
  }

  async assertCapability(
    brandProfileId: string,
    capability: SubscriptionCapability,
  ): Promise<void> {
    const decision = await this.getCapabilityDecision(
      brandProfileId,
      capability,
    );
    if (!decision.allowed) {
      throw new ForbiddenException(decision);
    }
  }
}
