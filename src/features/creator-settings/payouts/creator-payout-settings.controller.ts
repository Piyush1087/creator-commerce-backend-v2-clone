import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../../co-pilot/pipes/zod-validation.pipe";
import {
  creatorLegalProfileSchema,
  creatorPayoutDestinationSchema,
} from "./creator-payout-settings.schema";
import { CreatorPayoutSettingsService } from "./creator-payout-settings.service";
import {
  CreatorPayoutActorGuard,
  type CreatorPayoutActorRequest,
} from "./creator-payout-actor.guard";

@Controller("api/v1/creator/settings/payouts")
@UseGuards(ThrottlerGuard, JwtAuthGuard, CreatorPayoutActorGuard)
export class CreatorPayoutSettingsController {
  constructor(private readonly settings: CreatorPayoutSettingsService) {}

  @Get()
  getSettings(@Req() request: CreatorPayoutActorRequest) {
    return this.settings.getSettings(requireActor(request));
  }

  @Put("destination")
  @UsePipes(new ZodValidationPipe(creatorPayoutDestinationSchema))
  replaceDestination(
    @Req() request: CreatorPayoutActorRequest,
    @Body() body: ReturnType<typeof creatorPayoutDestinationSchema.parse>,
  ) {
    return this.settings.replaceDestination(requireActor(request), body);
  }

  @Delete("destination/:destinationId")
  disableDestination(
    @Req() request: CreatorPayoutActorRequest,
    @Param("destinationId", new ParseUUIDPipe()) destinationId: string,
  ) {
    return this.settings.disableDestination(
      requireActor(request),
      destinationId,
    );
  }

  @Put("legal-profile")
  @UsePipes(new ZodValidationPipe(creatorLegalProfileSchema))
  upsertLegalProfile(
    @Req() request: CreatorPayoutActorRequest,
    @Body() body: ReturnType<typeof creatorLegalProfileSchema.parse>,
  ) {
    return this.settings.upsertLegalProfile(requireActor(request), body);
  }
}

function requireActor(request: CreatorPayoutActorRequest) {
  if (!request.creatorWorkspaceActor) {
    throw new Error("Creator workspace actor guard did not resolve context");
  }
  return request.creatorWorkspaceActor;
}
