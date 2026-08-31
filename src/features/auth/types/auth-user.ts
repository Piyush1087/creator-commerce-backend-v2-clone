import { UserRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  sessionId?: string;
  email: string;
  name: string | null;
  role: UserRole;
  organizationId: string | null;
};

export type JwtPayload = {
  sub: string;
  sid: string;
  email: string;
  role: UserRole;
  /** Legacy fields are accepted only for compile-time compatibility; authorization never trusts them. */
  name?: string | null;
  organizationId?: string | null;
};
