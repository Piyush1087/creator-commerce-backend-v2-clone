import { Module } from "@nestjs/common";
import { RateCardPersistenceModule } from "./rate-card.persistence.module";
import { RateCardService } from "./rate-card.service";
import { RateCardController } from "./rate-card.controller";
@Module({
  imports: [RateCardPersistenceModule],
  providers: [RateCardService],
  controllers: [RateCardController],
  exports: [RateCardService, RateCardPersistenceModule],
})
export class RateCardModule {}
