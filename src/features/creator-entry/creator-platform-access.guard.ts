import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { CreatorEntryStateService } from "./creator-entry-state.service";
import { CREATOR_ENTRY_ERROR } from "./creator-entry.types";

/** Persisted-state capability gate for normal Creator product surfaces. */
@Injectable()
export class CreatorPlatformAccessGuard implements CanActivate {
  constructor(private readonly state: CreatorEntryStateService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuthUser>();
    const projection = await this.state.read(request.user);
    if (!projection.canEnterCreatorPlatform) {
      throw new ForbiddenException({
        code: CREATOR_ENTRY_ERROR.CREATOR_PLATFORM_ACCESS_REQUIRED,
        message:
          "Creator platform access requires an active Instagram capability.",
      });
    }
    return true;
  }
}
