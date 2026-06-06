import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";

import { AppController } from "./app.controller";
import { AuthModule } from "./features/auth/auth.module";
import { BrandCentreModule } from "./features/brand-centre/brand-centre.module";
import { BrandCentreUceBridgeModule } from "./features/brand-centre-uce-bridge/brand-centre-uce-bridge.module";
import { BrandOnboardingModule } from "./features/brand-onboarding/brand-onboarding.module";
import { BrandUceModule } from "./features/brand-uce/brand-uce.module";
import { CollaborationModule } from "./features/collaboration/collaboration.module";
import { CreatorUceModule } from "./features/creator-uce/creator-uce.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { S3Module } from "./shared/s3/s3.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    S3Module,
    HealthModule,
    AuthModule,
    BrandOnboardingModule,
    BrandCentreModule,
    BrandCentreUceBridgeModule,
    BrandUceModule,
    CollaborationModule,
    CreatorUceModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
