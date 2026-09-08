import { Module } from "@nestjs/common";
import { ApprovedApplicationCollaborationPort } from "../campaign-applications/approved-application-collaboration.port";
import { ApprovedApplicationCollaborationService } from "./services/approved-application-collaboration.service";

@Module({
  providers: [
    {
      provide: ApprovedApplicationCollaborationPort,
      useClass: ApprovedApplicationCollaborationService,
    },
  ],
  exports: [ApprovedApplicationCollaborationPort],
})
export class ApplicationHandoffModule {}
