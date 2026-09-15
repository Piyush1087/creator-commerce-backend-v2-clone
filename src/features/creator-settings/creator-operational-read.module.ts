import { Module } from "@nestjs/common";
import { PrismaCreatorPayoutCountryAuthorityAdapter } from "./payouts/prisma-creator-payout-country-authority.adapter";
import { CREATOR_PAYOUT_COUNTRY_AUTHORITY_PORT } from "./payouts/creator-payout-country-authority.port";
import { CreatorShippingReadinessAdapter } from "./services/creator-shipping-readiness.adapter";

/** Read-only owning ports, without importing unrelated Settings/provider runtimes. */
@Module({
  providers: [
    PrismaCreatorPayoutCountryAuthorityAdapter,
    CreatorShippingReadinessAdapter,
    {
      provide: CREATOR_PAYOUT_COUNTRY_AUTHORITY_PORT,
      useExisting: PrismaCreatorPayoutCountryAuthorityAdapter,
    },
  ],
  exports: [
    PrismaCreatorPayoutCountryAuthorityAdapter,
    CreatorShippingReadinessAdapter,
    CREATOR_PAYOUT_COUNTRY_AUTHORITY_PORT,
  ],
})
export class CreatorOperationalReadModule {}
