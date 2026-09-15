import { Module } from "@nestjs/common";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { CreatorBrandController } from "./creator-brand.controller";
import { CreatorBrandService } from "./creator-brand.service";
import { CreatorBrandRepository } from "./creator-brand.repository";
import { BrandIntelligenceModule } from "../brand-intelligence/brand-intelligence.module";
import { CreatorBrandSuggestionsConsumer } from "./creator-brand-suggestions.consumer";
@Module({
  imports: [CreatorTeamModule, BrandIntelligenceModule],
  controllers: [CreatorBrandController],
  providers: [
    CreatorBrandService,
    CreatorBrandRepository,
    CreatorBrandSuggestionsConsumer,
  ],
})
export class CreatorBrandModule {}
