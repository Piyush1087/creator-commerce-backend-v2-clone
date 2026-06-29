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
  Put,
  Req,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { SocialNetworkProvider } from "@prisma/client";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../co-pilot/pipes/zod-validation.pipe";
import {
  creatorShippingAddressSchema,
  inviteWorkspaceMemberSchema,
  paymentGatewayVerificationSchema,
  updateCreatorProfileSchema,
  updateWorkspaceMemberRoleSchema,
  updateWorkspaceProfileSchema,
} from "./schemas/creator-settings.schema";
import { CreatorSettingsService } from "./services/creator-settings.service";

@Controller("api/v1/creator/settings")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorSettingsController {
  constructor(private readonly settings: CreatorSettingsService) {}

  @Get("profile")
  getProfile(@Req() req: RequestWithAuthUser) {
    return this.settings.getProfile(req.user);
  }

  @Patch("profile")
  @UsePipes(new ZodValidationPipe(updateCreatorProfileSchema))
  updateProfile(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof updateCreatorProfileSchema.parse>,
  ) {
    return this.settings.updateProfile(req.user, body);
  }

  @Get("shipping")
  getShipping(@Req() req: RequestWithAuthUser) {
    return this.settings.getShipping(req.user);
  }

  @Put("shipping")
  @UsePipes(new ZodValidationPipe(creatorShippingAddressSchema))
  upsertShipping(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof creatorShippingAddressSchema.parse>,
  ) {
    return this.settings.upsertShipping(req.user, body);
  }

  @Get("workspace")
  getWorkspace(@Req() req: RequestWithAuthUser) {
    return this.settings.getWorkspace(req.user);
  }

  @Patch("workspace")
  @UsePipes(new ZodValidationPipe(updateWorkspaceProfileSchema))
  updateWorkspace(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof updateWorkspaceProfileSchema.parse>,
  ) {
    return this.settings.updateWorkspace(req.user, body);
  }

  @Post("team/invite")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(inviteWorkspaceMemberSchema))
  inviteTeamMember(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof inviteWorkspaceMemberSchema.parse>,
  ) {
    return this.settings.inviteWorkspaceMember(req.user, body);
  }

  @Patch("team/role")
  @UsePipes(new ZodValidationPipe(updateWorkspaceMemberRoleSchema))
  updateTeamRole(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof updateWorkspaceMemberRoleSchema.parse>,
  ) {
    return this.settings.updateWorkspaceMemberRole(
      req.user,
      body.memberId,
      body.allocatedRole,
    );
  }

  @Delete("team/:memberId")
  revokeTeamMember(
    @Req() req: RequestWithAuthUser,
    @Param("memberId") memberId: string,
  ) {
    return this.settings.revokeWorkspaceMember(req.user, memberId);
  }

  @Delete("team/invitations/:invitationId")
  cancelInvitation(
    @Req() req: RequestWithAuthUser,
    @Param("invitationId") invitationId: string,
  ) {
    return this.settings.cancelWorkspaceInvitation(req.user, invitationId);
  }

  @Get("social")
  listSocial(@Req() req: RequestWithAuthUser) {
    return this.settings.listSocialIntegrations(req.user);
  }

  @Delete("social/:platform")
  disconnectSocial(
    @Req() req: RequestWithAuthUser,
    @Param("platform") platform: SocialNetworkProvider,
  ) {
    return this.settings.disconnectSocialIntegration(req.user, platform);
  }

  @Get("payouts")
  getPayouts(@Req() req: RequestWithAuthUser) {
    return this.settings.getPayoutSettings(req.user);
  }

  @Post("payouts/bank")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(paymentGatewayVerificationSchema))
  upsertPayoutBank(
    @Req() req: RequestWithAuthUser,
    @Body() body: ReturnType<typeof paymentGatewayVerificationSchema.parse>,
  ) {
    return this.settings.upsertPayoutBank(req.user, body);
  }
}
