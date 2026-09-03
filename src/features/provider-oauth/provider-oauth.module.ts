import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { CreatorInstagramOAuthTransactionService } from "./creator-instagram-oauth-transaction.service";
import { ProviderOAuthTransactionService } from "./provider-oauth-transaction.service";

@Module({
  imports: [PrismaModule],
  providers: [
    ProviderOAuthTransactionService,
    CreatorInstagramOAuthTransactionService,
  ],
  exports: [
    ProviderOAuthTransactionService,
    CreatorInstagramOAuthTransactionService,
  ],
})
export class ProviderOAuthModule {}
