import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../co-pilot/pipes/zod-validation.pipe";
import {
  BrandBillingProfileSchema,
  BrandWithdrawalAccountSchema,
  BulkNotificationSettingsSchema,
  InviteTeamMemberSchema,
  UpdateBrandGeneralProfileSchema,
  UpdateTeamRoleSchema,
} from "./schemas/brand-settings.schema";
import { BrandSettingsService } from "./services/brand-settings.service";

@Controller("api/v1/brand/settings")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandSettingsController {
  constructor(private readonly settings: BrandSettingsService) {}

  @Get()
  getOverview(@Req() req: RequestWithAuthUser) {
    return this.settings.getOverview(req.user);
  }

  @Get("general")
  getGeneral(@Req() req: RequestWithAuthUser) {
    return this.settings.getGeneral(req.user);
  }

  @Patch("general")
  @UsePipes(new ZodValidationPipe(UpdateBrandGeneralProfileSchema))
  updateGeneral(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof UpdateBrandGeneralProfileSchema.parse>,
  ) {
    return this.settings.updateGeneral(req.user, body);
  }

  @Get("billing-profile")
  getBillingProfile(@Req() req: RequestWithAuthUser) {
    return this.settings.getBillingProfile(req.user);
  }

  @Patch("billing-profile")
  @UsePipes(new ZodValidationPipe(BrandBillingProfileSchema))
  upsertBillingProfile(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof BrandBillingProfileSchema.parse>,
  ) {
    return this.settings.upsertBillingProfile(req.user, body);
  }

  @Get("withdrawal-account")
  getWithdrawalAccount(@Req() req: RequestWithAuthUser) {
    return this.settings.getWithdrawalAccount(req.user);
  }

  @Post("withdrawal-account")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(BrandWithdrawalAccountSchema))
  linkWithdrawalAccount(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof BrandWithdrawalAccountSchema.parse>,
  ) {
    return this.settings.linkWithdrawalAccount(req.user, body);
  }

  @Get("notifications")
  getNotifications(@Req() req: RequestWithAuthUser) {
    return this.settings.getNotifications(req.user);
  }

  @Patch("notifications")
  @UsePipes(new ZodValidationPipe(BulkNotificationSettingsSchema))
  updateNotifications(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof BulkNotificationSettingsSchema.parse>,
  ) {
    return this.settings.updateNotifications(req.user, body);
  }

  @Patch("team/role")
  @UsePipes(new ZodValidationPipe(UpdateTeamRoleSchema))
  updateTeamRole(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof UpdateTeamRoleSchema.parse>,
  ) {
    return this.settings.updateTeamRole(req.user, body);
  }

  @Post("team/invite")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(InviteTeamMemberSchema))
  inviteTeamMember(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof InviteTeamMemberSchema.parse>,
  ) {
    return this.settings.inviteTeamMember(req.user, body);
  }

  @Delete("team/:membershipId")
  revokeTeamMember(
    @Req() req: RequestWithAuthUser,
    @Param("membershipId") membershipId: string,
  ) {
    return this.settings.revokeTeamMember(req.user, membershipId);
  }

  @Delete("team/invitations/:invitationId")
  cancelTeamInvitation(
    @Req() req: RequestWithAuthUser,
    @Param("invitationId") invitationId: string,
  ) {
    return this.settings.cancelTeamInvitation(req.user, invitationId);
  }
}
