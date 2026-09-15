import { Module } from "@nestjs/common";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { PortfolioController } from "./portfolio.controller";
import { PortfolioRepository } from "./portfolio.repository";
import { PortfolioService } from "./portfolio.service";
import { PortfolioSourceReader } from "./portfolio-source-reader";
@Module({
  imports: [CreatorTeamModule],
  controllers: [PortfolioController],
  providers: [PortfolioRepository, PortfolioService, PortfolioSourceReader],
  exports: [PortfolioRepository, PortfolioService],
})
export class PortfolioModule {}
