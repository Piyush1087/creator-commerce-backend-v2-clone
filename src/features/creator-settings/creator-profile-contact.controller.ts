import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../co-pilot/pipes/zod-validation.pipe";
import {
  UpdateCreatorCanonicalProfileSchema,
  UpsertCreatorDefaultContactSchema,
} from "./schemas/creator-profile-contact.schema";
import { CreatorProfileContactService } from "./services/creator-profile-contact.service";
import { CreatorWorkspaceActorService } from "./team/creator-workspace-actor.service";

/** Canonical C-05 profile/contact routes. */
@Controller("api/v1/creator/settings")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorProfileContactController {
  constructor(
    private readonly actors: CreatorWorkspaceActorService,
    private readonly settings: CreatorProfileContactService,
  ) {}

  @Get("profile")
  async getProfile(@Req() request: RequestWithAuthUser) {
    return this.settings.getProfile(await this.actors.resolve(request.user));
  }

  @Patch("profile")
  async updateProfile(
    @Req() request: RequestWithAuthUser,
    @Body(new ZodValidationPipe(UpdateCreatorCanonicalProfileSchema))
    body: ReturnType<typeof UpdateCreatorCanonicalProfileSchema.parse>,
  ) {
    return this.settings.updateProfile(
      await this.actors.resolve(request.user),
      body,
    );
  }

  @Get("contact")
  async getContact(@Req() request: RequestWithAuthUser) {
    return this.settings.getDefaultContact(
      await this.actors.resolve(request.user),
    );
  }

  @Put("contact")
  async upsertContact(
    @Req() request: RequestWithAuthUser,
    @Body(new ZodValidationPipe(UpsertCreatorDefaultContactSchema))
    body: ReturnType<typeof UpsertCreatorDefaultContactSchema.parse>,
  ) {
    return this.settings.upsertDefaultContact(
      await this.actors.resolve(request.user),
      body,
    );
  }
}
