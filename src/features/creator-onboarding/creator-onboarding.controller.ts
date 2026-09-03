import { Controller, Get, GoneException, Post } from "@nestjs/common";

import { Public } from "../auth/decorators/public.decorator";

@Controller("api/v1/creator-onboarding")
export class CreatorOnboardingController {
  @Public()
  @Post("handle-check")
  handleCheck(): never {
    throw this.routeRetired(
      "CREATOR_HANDLE_ADMISSION_RETIRED",
      "Creator handle admission is retired. Register through Creator Entry and authorize Instagram there.",
    );
  }

  @Public()
  @Post("stage-features")
  stageFeatures(): never {
    throw this.routeRetired(
      "CREATOR_FEATURE_STAGING_RETIRED",
      "Creator feature staging is retired. Use the canonical Creator Entry journey.",
    );
  }

  @Public()
  @Post("signup")
  signup(): never {
    throw this.accountCreationRetired();
  }

  @Public()
  @Post("verify-otp")
  verifyOtp(): never {
    throw this.accountCreationRetired();
  }

  @Public()
  @Post("meta-connect")
  metaConnect(): never {
    throw this.routeRetired(
      "CREATOR_ONBOARDING_INSTAGRAM_CONNECTION_RETIRED",
      "Legacy Creator Instagram connection is retired. Authorize through /api/v1/creator-entry/instagram/authorize.",
    );
  }

  @Public()
  @Post("activate-sync")
  activateSync(): never {
    throw this.routeRetired(
      "CREATOR_ONBOARDING_ACTIVATION_RETIRED",
      "Legacy Creator activation is retired. Complete the canonical Creator Entry Instagram journey.",
    );
  }

  @Public()
  @Get("track/:trackId")
  getTrack(): never {
    throw this.routeRetired(
      "CREATOR_ONBOARDING_TRACK_RUNTIME_RETIRED",
      "Legacy Creator onboarding-track runtime access is retired.",
    );
  }

  @Public()
  @Post("waitlist")
  joinWaitlist(): never {
    throw this.routeRetired(
      "CREATOR_WAITLIST_RETIRED",
      "The Creator waitlist is retired. Use the canonical Creator Entry journey.",
    );
  }

  private accountCreationRetired(): GoneException {
    return this.routeRetired(
      "CREATOR_ONBOARDING_ACCOUNT_CREATION_RETIRED",
      "Use the Creator Entry registration routes under /api/v1/creator-entry/register.",
    );
  }

  private routeRetired(code: string, message: string): GoneException {
    return new GoneException({ code, message });
  }
}
