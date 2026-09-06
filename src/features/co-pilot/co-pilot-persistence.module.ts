import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import {
  CoPilotInteractionLogService,
  CoPilotThreadService,
} from "./services/co-pilot-thread.service";

@Module({
  imports: [PrismaModule],
  providers: [CoPilotThreadService, CoPilotInteractionLogService],
  exports: [CoPilotThreadService, CoPilotInteractionLogService],
})
export class CoPilotPersistenceModule {}
