import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { PrismaModule } from "../../prisma/prisma.module";
import { MailModule } from "../../mail/mail.module";
import {
  JWT_EXPIRES_IN,
  resolveJwtAudience,
  resolveJwtIssuer,
  resolveJwtSecret,
  resolveOtpPepper,
} from "./auth-jwt.config";
import { AuthController } from "./auth.controller";
import { EmailOtpService } from "./email-otp.service";
import { PasswordResetService } from "./password-reset.service";
import { AuthSessionService } from "./auth-session.service";
import { AuthService } from "./auth.service";
import { GoogleAuthService } from "./google-auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { OptionalJwtAuthGuard } from "./optional-jwt-auth.guard";

@Module({
  imports: [
    PrismaModule,
    MailModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveJwtSecret(config),
        signOptions: {
          algorithm: "HS256",
          issuer: resolveJwtIssuer(config),
          audience: resolveJwtAudience(config),
          expiresIn: JWT_EXPIRES_IN as `${number}${"s" | "m" | "h" | "d"}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    EmailOtpService,
    PasswordResetService,
    GoogleAuthService,
    JwtStrategy,
    OptionalJwtAuthGuard,
    {
      provide: "AUTH_SECURITY_CONFIG_GUARD",
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        resolveOtpPepper(config);
        return true;
      },
    },
  ],
  exports: [
    AuthService,
    AuthSessionService,
    EmailOtpService,
    PasswordResetService,
    GoogleAuthService,
    JwtModule,
    OptionalJwtAuthGuard,
  ],
})
export class AuthModule {}
