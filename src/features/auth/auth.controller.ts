import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request, Response } from "express";

import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "./auth-cookie.util";
import {
  AuthSessionService,
  type SessionIssueResult,
} from "./auth-session.service";
import { AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import {
  ChangePasswordDto,
  CompletePasswordResetDto,
  EmailOnlyDto,
  VerifyEmailOtpDto,
} from "./dto/auth-security.dto";
import { CompleteBrandRegistrationDto } from "./dto/complete-brand-registration.dto";
import { GoogleSignInDto } from "./dto/google-signin.dto";
import { LoginDto } from "./dto/login.dto";
import { GoogleAuthService } from "./google-auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PasswordResetService } from "./password-reset.service";
import type { AuthUser } from "./types/auth-user";

export type RequestWithAuthUser = Request & { user: AuthUser };

@Controller("api/v1/auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: AuthSessionService,
    private readonly passwordReset: PasswordResetService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(response, await this.authService.login(dto));
  }

  @Public()
  @Post("otp/request")
  @HttpCode(202)
  requestLoginOtp(@Body() dto: EmailOnlyDto) {
    return this.authService.requestLoginOtp(dto.email);
  }

  @Public()
  @Post("otp/verify")
  @HttpCode(200)
  async verifyLoginOtp(
    @Body() dto: VerifyEmailOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(
      response,
      await this.authService.loginWithOtp(dto.email, dto.code),
    );
  }

  @Public()
  @Post("google/signin")
  @HttpCode(200)
  async googleSignIn(
    @Body() dto: GoogleSignInDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(
      response,
      await this.googleAuth.signInWithGoogle({
        idToken: dto.idToken,
      }),
    );
  }

  @Public()
  @Post("brand/complete-registration")
  completeBrandRegistration(@Body() _dto: CompleteBrandRegistrationDto) {
    return this.authService.completeBrandRegistration();
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rawToken = readRefreshCookie(request);
    if (!rawToken) return this.sessions.refresh("");
    return this.withRefreshCookie(
      response,
      await this.sessions.refresh(rawToken),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() request: RequestWithAuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (request.user.sessionId) {
      await this.sessions.revoke(request.user.sessionId, "LOGOUT");
    }
    clearRefreshCookie(response);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout-all")
  @HttpCode(204)
  async logoutAll(
    @Req() request: RequestWithAuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.revokeAll(request.user.id, "USER_LOGOUT_ALL");
    clearRefreshCookie(response);
  }

  @Public()
  @Post("password/forgot")
  @HttpCode(202)
  forgotPassword(@Body() dto: EmailOnlyDto) {
    return this.passwordReset.request(dto.email);
  }

  @Public()
  @Post("password/reset")
  @HttpCode(204)
  resetPassword(@Body() dto: CompletePasswordResetDto) {
    return this.passwordReset.complete(dto.token, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post("password/change")
  @HttpCode(204)
  changePassword(
    @Req() request: RequestWithAuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    clearRefreshCookie(response);
    return this.passwordReset.changePassword(
      request.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() request: RequestWithAuthUser) {
    return this.authService.getMe(request.user);
  }

  private withRefreshCookie(response: Response, result: SessionIssueResult) {
    setRefreshCookie(response, result.refreshToken);
    const { refreshToken: _refreshToken, ...publicResult } = result;
    return publicResult;
  }
}
