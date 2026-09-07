import { Module } from "@nestjs/common";

import { MailModule } from "../../../mail/mail.module";
import { CreatorTeamController } from "./creator-team.controller";
import { CreatorTeamInvitationsController } from "./creator-team-invitations.controller";
import { CreatorTeamInvitationsService } from "./creator-team-invitations.service";
import { CreatorTeamService } from "./creator-team.service";
import { CreatorWorkspaceActorController } from "./creator-workspace-actor.controller";
import { CreatorWorkspaceActorService } from "./creator-workspace-actor.service";

/** P2 imports this bounded module into CreatorSettingsModule. */
@Module({
  imports: [MailModule],
  controllers: [
    CreatorWorkspaceActorController,
    CreatorTeamController,
    CreatorTeamInvitationsController,
  ],
  providers: [
    CreatorWorkspaceActorService,
    CreatorTeamService,
    CreatorTeamInvitationsService,
  ],
  exports: [
    CreatorWorkspaceActorService,
    CreatorTeamService,
    CreatorTeamInvitationsService,
  ],
})
export class CreatorTeamModule {}
