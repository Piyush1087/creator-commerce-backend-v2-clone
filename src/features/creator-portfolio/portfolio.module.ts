import { Module } from "@nestjs/common";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { PortfolioController } from "./portfolio.controller";
import { PortfolioRepository } from "./portfolio.repository";
import { PortfolioService } from "./portfolio.service";
@Module({
  imports: [CreatorTeamModule],
  controllers: [PortfolioController],
  providers: [PortfolioRepository, PortfolioService],
  exports: [PortfolioRepository, PortfolioService],
})
export class PortfolioModule {}
