import { UserRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  organizationId: string | null;
};

export type JwtPayload = {
  sub: string;
  email: string;
  name: string | null;
  role: UserRole;
  organizationId: string | null;
};
