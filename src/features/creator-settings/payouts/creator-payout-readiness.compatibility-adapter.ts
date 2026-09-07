import { Injectable } from "@nestjs/common";

import { CreatorPayoutProfileService } from "../../brand-escrow/services/creator-payout-profile.service";
import type {
  CreatorPayoutReadinessInvalidationReason,
  CreatorPayoutReadinessInvalidator,
} from "./creator-payout-settings.types";

/**
 * COMPATIBILITY_RECONCILIATION_ONLY.
 *
 * C-05 owns no provider provisioning, KYC, verification, transfer, settlement,
 * or reconciliation behavior. This adapter can only fail closed by invoking
 * the already-existing C-06 readiness invalidation hook before canonical
 * payout or legal identity changes are persisted.
 */
@Injectable()
export class CreatorPayoutReadinessCompatibilityAdapter implements CreatorPayoutReadinessInvalidator {
  constructor(private readonly payoutProfiles: CreatorPayoutProfileService) {}

  async invalidateReadiness(
    creatorProfileId: string,
    reason: CreatorPayoutReadinessInvalidationReason,
  ): Promise<void> {
    await this.payoutProfiles.invalidateReadiness(creatorProfileId, reason);
  }
}
