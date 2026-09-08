import { Module } from "@nestjs/common";

import { CREATOR_PAYOUT_METHOD_SUMMARY_PORT } from "./creator-payout-method-summary.port";
import { PrismaCreatorPayoutMethodSummaryService } from "./prisma-creator-payout-method-summary.service";

@Module({
  providers: [
    PrismaCreatorPayoutMethodSummaryService,
    {
      provide: CREATOR_PAYOUT_METHOD_SUMMARY_PORT,
      useExisting: PrismaCreatorPayoutMethodSummaryService,
    },
  ],
  exports: [CREATOR_PAYOUT_METHOD_SUMMARY_PORT],
})
export class CreatorPayoutMethodSummaryModule {}
