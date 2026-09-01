import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CreatorEntryController } from "./creator-entry.controller";
import { CreatorEntryProvisioningService } from "./creator-entry-provisioning.service";
import { CreatorEntryRegistrationService } from "./creator-entry-registration.service";
import { CreatorEntryStateService } from "./creator-entry-state.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CreatorEntryController],
  providers: [
    CreatorEntryProvisioningService,
    CreatorEntryRegistrationService,
    CreatorEntryStateService,
  ],
  exports: [CreatorEntryStateService],
})
export class CreatorEntryModule {}
