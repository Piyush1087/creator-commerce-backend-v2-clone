import { Module } from "@nestjs/common";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { CreatorBrandController } from "./creator-brand.controller";
import { CreatorBrandService } from "./creator-brand.service";
import { CreatorBrandRepository } from "./creator-brand.repository";
@Module({
  imports: [CreatorTeamModule],
  controllers: [CreatorBrandController],
  providers: [CreatorBrandService, CreatorBrandRepository],
})
export class CreatorBrandModule {}
