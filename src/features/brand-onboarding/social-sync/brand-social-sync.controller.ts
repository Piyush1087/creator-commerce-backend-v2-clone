import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator";

import type { RequestWithAuthUser } from "../../auth/auth.controller";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { BrandSocialSyncService } from "./brand-social-sync.service";

class OauthUrlQueryDto {
  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}

class ConnectInstagramDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  redirectUri!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;
}

class InviteDto {
  @IsEmail()
  email!: string;
}

class InviteTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

class InviteOtpDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}

class InviteConnectDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  redirectUri!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;
}

class InviteOauthUrlQueryDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}

@Controller("api/v1/brand/social-sync")
@UseGuards(ThrottlerGuard)
export class BrandSocialSyncController {
  constructor(private readonly socialSync: BrandSocialSyncService) {}

  @Get("instagram/oauth-url")
  @UseGuards(JwtAuthGuard)
  oauthUrl(@Req() req: RequestWithAuthUser, @Query() query: OauthUrlQueryDto) {
    return this.socialSync.getOauthUrl(req.user, query.redirectUri);
  }

  @Post("instagram/connect")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  connect(@Req() req: RequestWithAuthUser, @Body() body: ConnectInstagramDto) {
    return this.socialSync.connectInstagram(req.user, body);
  }

  @Post("skip")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  skip(@Req() req: RequestWithAuthUser) {
    return this.socialSync.skipSocialSync(req.user);
  }

  @Post("invite")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  invite(@Req() req: RequestWithAuthUser, @Body() body: InviteDto) {
    return this.socialSync.inviteTeammate(req.user, body.email);
  }

  /** Public invitee gate — no JWT. */
  @Get("invite/start")
  startInvite(@Query() query: InviteTokenDto) {
    return this.socialSync.startInviteVerification(query.token);
  }

  @Post("invite/verify-otp")
  @HttpCode(200)
  verifyInviteOtp(@Body() body: InviteOtpDto) {
    return this.socialSync.verifyInviteOtp(body.token, body.otp);
  }

  @Post("invite/connect")
  @HttpCode(200)
  connectForInvite(@Body() body: InviteConnectDto) {
    return this.socialSync.connectInstagramForInvite(body.token, {
      code: body.code,
      redirectUri: body.redirectUri,
      state: body.state,
    });
  }

  @Get("invite/instagram/oauth-url")
  inviteOauthUrl(@Query() query: InviteOauthUrlQueryDto) {
    return this.socialSync.getInviteOauthUrl(query.token, query.redirectUri);
  }
}
