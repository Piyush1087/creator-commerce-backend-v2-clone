import { Injectable } from "@nestjs/common";

import { SubscriptionCapabilityService } from "../../pricing/services/subscription-capability.service";
import {
  BrandEscrowComputationService,
  type ExecuteLockAllocationInput,
} from "./brand-escrow-computation.service";
import { IdempotencyManager } from "./idempotency.manager";

@Injectable()
export class BrandEscrowHardenedService {
  constructor(
    private readonly idempotencyManager: IdempotencyManager,
    private readonly subscriptionCapabilities: SubscriptionCapabilityService,
    private readonly canonicalReserve: BrandEscrowComputationService,
  ) {}

  async secureCollaborationFundsHardened(
    input: ExecuteLockAllocationInput,
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    const routePath = "/api/v1/hardened-escrow/lock-funds";
    await this.subscriptionCapabilities.assertCapability(
      input.brandProfileId,
      "ESCROW_RESERVE",
    );
    await this.idempotencyManager.registerIntent(idempotencyKey, routePath);

    try {
      const result = await this.canonicalReserve.executeStage2Lock(input);
      await this.idempotencyManager.finalizeExecution(idempotencyKey, result);
      return result;
    } catch (error) {
      await this.idempotencyManager.rollbackIntent(idempotencyKey);
      throw error;
    }
  }
}
