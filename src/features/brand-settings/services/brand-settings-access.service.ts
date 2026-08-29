import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BrandRole } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";

export const BRAND_SETTINGS_MAX_SEATS = 5;

const FINANCIAL_MUTATION_ROLES: BrandRole[] = [
  BrandRole.BRAND_OWNER,
  BrandRole.FINANCE_ADMIN,
];

export type InstagramIntegrationAction =
  | "READ"
  | "INITIAL_CONNECT"
  | "SAME_ID_RECONNECT"
  | "CONTROLLED_ACCOUNT_CHANGE"
  | "LEGACY_IDENTITY_RECONCILIATION"
  | "DISCONNECT"
  | "DELETE_MY_DATA";

const INSTAGRAM_ACTIONS: Record<
  BrandRole,
  readonly InstagramIntegrationAction[]
> = {
  [BrandRole.BRAND_OWNER]: [
    "READ",
    "INITIAL_CONNECT",
    "SAME_ID_RECONNECT",
    "CONTROLLED_ACCOUNT_CHANGE",
    "LEGACY_IDENTITY_RECONCILIATION",
    "DISCONNECT",
    "DELETE_MY_DATA",
  ],
  [BrandRole.CAMPAIGN_MANAGER]: ["READ", "SAME_ID_RECONNECT"],
  [BrandRole.FINANCE_ADMIN]: ["READ"],
};

@Injectable()
export class BrandSettingsAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: BrandWorkspaceAuthorizationService,
  ) {}

  async resolveBrandContext(user: AuthUser) {
    return this.workspace.resolveBrandContext(user);
  }

  assertInstagramAction(
    role: BrandRole,
    action: InstagramIntegrationAction,
  ): void {
    if (!INSTAGRAM_ACTIONS[role].includes(action)) {
      throw new ForbiddenException(
        `Brand role ${role} cannot perform Instagram action ${action}.`,
      );
    }
  }

  async ensureMembership(brandProfileId: string, user: AuthUser) {
    // Legacy notification caller compatibility: this method now only authorizes.
    const context = await this.workspace.resolveBrandContext(user);
    if (context.brandProfileId !== brandProfileId) {
      throw new ForbiddenException("Brand workspace mismatch");
    }
    return context.membership;
  }

  assertFinancialMutation(role: BrandRole): void {
    if (!FINANCIAL_MUTATION_ROLES.includes(role)) {
      throw new ForbiddenException(
        "Read-only: contact a Finance Admin or Brand Owner to modify billing and withdrawal settings.",
      );
    }
  }

  assertTeamAdmin(role: BrandRole): void {
    if (role === BrandRole.CAMPAIGN_MANAGER) {
      throw new ForbiddenException(
        "Campaign Managers cannot manage team membership.",
      );
    }
  }

  canManageTeam(role: BrandRole): boolean {
    return role !== BrandRole.CAMPAIGN_MANAGER;
  }

  async getMembershipOrThrow(membershipId: string, brandProfileId: string) {
    const membership = await this.prisma.brandTeamMember.findFirst({
      where: { id: membershipId, brandProfileId, isActive: true },
      include: { user: true },
    });
    if (!membership) {
      throw new NotFoundException("Team membership not found");
    }
    return membership;
  }

  isFinancialReadOnly(role: BrandRole): boolean {
    return role === BrandRole.CAMPAIGN_MANAGER;
  }
}
