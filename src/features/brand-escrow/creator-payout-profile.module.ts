import { Module } from "@nestjs/common";

import { CreatorPayoutProfileService } from "./services/creator-payout-profile.service";

/**
 * COMPATIBILITY_RECONCILIATION_ONLY.
 *
 * Exposes the existing fail-closed payout-readiness authority without making
 * Creator Settings import provider onboarding, transfer, settlement, or
 * reconciliation runtime from the full BrandEscrowModule.
 */
@Module({
  providers: [CreatorPayoutProfileService],
  exports: [CreatorPayoutProfileService],
})
export class CreatorPayoutProfileModule {}
