import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { Public } from "./decorators/public.decorator";
import { CompleteBrandRegistrationDto } from "./dto/complete-brand-registration.dto";
import { GoogleSignInDto } from "./dto/google-signin.dto";
import { LoginDto } from "./dto/login.dto";
import { AuthService } from "./auth.service";
import { GoogleAuthService } from "./google-auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { AuthUser } from "./types/auth-user";

export type RequestWithAuthUser = {
  user: AuthUser;
};

@Controller("api/v1/auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post("google/signin")
  @HttpCode(200)
  googleSignIn(@Body() dto: GoogleSignInDto) {
    return this.googleAuth.signInWithGoogle({
      idToken: dto.idToken,
      onboardingTrackId: dto.onboardingTrackId,
    });
  }

  @Public()
  @Post("brand/complete-registration")
  @HttpCode(200)
  completeBrandRegistration(@Body() dto: CompleteBrandRegistrationDto) {
    return this.authService.completeBrandRegistration(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: RequestWithAuthUser) {
    return this.authService.getMe(req.user);
  }
}
