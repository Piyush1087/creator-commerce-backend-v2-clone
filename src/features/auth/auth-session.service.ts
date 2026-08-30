import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { SecurityEventType, UserAuthState } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";
import {
  accessTtl,
  durationToMs,
  refreshTtlMs,
  resolveJwtAudience,
  resolveJwtIssuer,
  resolveJwtSecret,
} from "./auth-jwt.config";
import type { AuthUser, JwtPayload } from "./types/auth-user";

export type SessionIssueResult = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: AuthUser;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string): Promise<SessionIssueResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.authState !== UserAuthState.ACTIVE) {
      throw new UnauthorizedException("Authentication is not available.");
    }
    const refreshToken = randomBytes(32).toString("base64url");
    const refreshDigest = digest(refreshToken);
    const absoluteExpiresAt = new Date(Date.now() + refreshTtlMs(this.config));
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.authSession.create({
        data: {
          userId,
          currentRefreshTokenDigest: refreshDigest,
          absoluteExpiresAt,
          refreshCredentials: {
            create: { digest: refreshDigest, version: 1 },
          },
        },
      });
      await tx.securityEvent.create({
        data: {
          userId,
          sessionId: created.id,
          type: SecurityEventType.SESSION_CREATED,
        },
      });
      return created;
    });
    return this.response(user, session.id, refreshToken);
  }

  async refresh(rawToken: string): Promise<SessionIssueResult> {
    const requestStartedAt = new Date();
    const tokenDigest = digest(rawToken);
    const credential = await this.prisma.authRefreshCredential.findUnique({
      where: { digest: tokenDigest },
      include: { session: { include: { user: true } } },
    });
    if (!credential)
      throw new UnauthorizedException("Invalid refresh credential.");

    const session = credential.session;
    if (
      session.revokedAt ||
      session.absoluteExpiresAt <= new Date() ||
      session.user.authState !== UserAuthState.ACTIVE
    ) {
      if (!session.revokedAt)
        await this.revoke(session.id, "REFRESH_REUSE_OR_INVALID");
      throw new UnauthorizedException("Invalid refresh credential.");
    }
    if (credential.consumedAt) {
      if (credential.consumedAt <= requestStartedAt) {
        await this.revoke(session.id, "REFRESH_CREDENTIAL_REPLAY");
      }
      throw new UnauthorizedException("Invalid refresh credential.");
    }

    const nextToken = randomBytes(32).toString("base64url");
    const nextDigest = digest(nextToken);
    const now = new Date();
    const won = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.authRefreshCredential.updateMany({
        where: { id: credential.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return false;
      const nextVersion = credential.version + 1;
      await tx.authRefreshCredential.create({
        data: {
          sessionId: session.id,
          digest: nextDigest,
          version: nextVersion,
        },
      });
      await tx.authSession.update({
        where: { id: session.id },
        data: {
          currentRefreshTokenDigest: nextDigest,
          refreshVersion: nextVersion,
          lastRefreshedAt: now,
          lastUsedAt: now,
        },
      });
      return true;
    });
    if (!won) {
      throw new UnauthorizedException("Invalid refresh credential.");
    }
    return this.response(session.user, session.id, nextToken);
  }

  async validate(userId: string, sessionId: string): Promise<AuthUser> {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== userId ||
      session.revokedAt ||
      session.absoluteExpiresAt <= new Date() ||
      session.user.authState !== UserAuthState.ACTIVE
    ) {
      throw new UnauthorizedException("Session is not active.");
    }
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
    return this.toAuthUser(session.user, session.id);
  }

  async revoke(sessionId: string, reason = "LOGOUT"): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.authSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: reason },
      });
      if (result.count) {
        const session = await tx.authSession.findUnique({
          where: { id: sessionId },
        });
        await tx.securityEvent.create({
          data: {
            userId: session?.userId,
            sessionId,
            type: SecurityEventType.SESSION_REVOKED,
            reasonCode: reason,
          },
        });
      }
    });
  }

  async revokeAll(userId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: reason },
      });
      await tx.securityEvent.create({
        data: {
          userId,
          type: SecurityEventType.ALL_SESSIONS_REVOKED,
          reasonCode: reason,
        },
      });
    });
  }

  async disableUser(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { authState: UserAuthState.DISABLED },
      });
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: "AUTH_DISABLED" },
      });
      await tx.securityEvent.create({
        data: { userId, type: SecurityEventType.AUTH_DISABLED },
      });
    });
  }

  private async response(
    user: {
      id: string;
      email: string;
      name: string | null;
      role: AuthUser["role"];
      organizationId: string | null;
    },
    sessionId: string,
    refreshToken: string,
  ): Promise<SessionIssueResult> {
    const ttl = accessTtl(this.config);
    const payload: JwtPayload = {
      sub: user.id,
      sid: sessionId,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: resolveJwtSecret(this.config),
      algorithm: "HS256",
      issuer: resolveJwtIssuer(this.config),
      audience: resolveJwtAudience(this.config),
      expiresIn: ttl as `${number}${"s" | "m" | "h" | "d"}`,
    });
    return {
      accessToken,
      accessTokenExpiresAt: new Date(
        Date.now() + durationToMs(ttl, "15m"),
      ).toISOString(),
      refreshToken,
      user: this.toAuthUser(user, sessionId),
    };
  }

  private toAuthUser(
    user: {
      id: string;
      email: string;
      name: string | null;
      role: AuthUser["role"];
      organizationId: string | null;
    },
    sessionId: string,
  ): AuthUser {
    return {
      id: user.id,
      sessionId,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
  }
}
