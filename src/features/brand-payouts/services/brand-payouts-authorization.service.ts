import { ForbiddenException, Injectable } from "@nestjs/common";
import { BrandRole } from "@prisma/client";

import type { AuthUser } from "../../auth/types/auth-user";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";
import type { BrandPayoutsAuthorizationScopeV1 } from "../contracts/brand-payouts-authorization.contract";

@Injectable()
export class BrandPayoutsAuthorizationService {
  constructor(
    private readonly workspaceAuthorization: BrandWorkspaceAuthorizationService,
  ) {}

  async resolve(user: AuthUser): Promise<BrandPayoutsAuthorizationScopeV1> {
    const { brandProfileId, membership } =
      await this.workspaceAuthorization.resolveBrandContextReadOnly(user);
    const common = {
      brandProfileId,
      membershipId: membership.id,
      authorizedAsOf: new Date(),
      authorizationVersion: `membership:${membership.updatedAt.toISOString()}`,
    } as const;

    if (
      membership.role === BrandRole.BRAND_OWNER ||
      membership.role === BrandRole.FINANCE_ADMIN
    ) {
      return { ...common, kind: "FULL_FINANCIAL", role: membership.role };
    }
    if (membership.role === BrandRole.CAMPAIGN_MANAGER) {
      return {
        ...common,
        kind: "NO_FINANCIAL_ROWS",
        role: "CAMPAIGN_MANAGER",
        reason: "CANONICAL_ENTITY_SCOPE_UNAVAILABLE",
      };
    }
    throw new ForbiddenException("Brand Payouts role is not authorized");
  }
}
