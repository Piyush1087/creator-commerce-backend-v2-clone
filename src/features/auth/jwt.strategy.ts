import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import {
  resolveJwtAudience,
  resolveJwtIssuer,
  resolveJwtSecret,
} from "./auth-jwt.config";
import { AuthSessionService } from "./auth-session.service";
import type { AuthUser, JwtPayload } from "./types/auth-user";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly sessions: AuthSessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: resolveJwtSecret(config),
      algorithms: ["HS256"],
      issuer: resolveJwtIssuer(config),
      audience: resolveJwtAudience(config),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload?.sub || !payload?.sid) {
      throw new Error("Invalid access-token claims.");
    }
    return this.sessions.validate(payload.sub, payload.sid);
  }
}
