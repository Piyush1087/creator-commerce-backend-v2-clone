import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { ZodValidationPipe } from "../co-pilot/pipes/zod-validation.pipe";
import {
  AcceptTeamInvitationSchema,
  InspectTeamInvitationSchema,
  type AcceptTeamInvitationInput,
} from "./schemas/team-invitation.schema";
import { BrandTeamInvitationsService } from "./services/brand-team-invitations.service";

@Controller("api/v1/brand/team-invitations")
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class BrandTeamInvitationsController {
  constructor(private readonly invitations: BrandTeamInvitationsService) {}

  @Post("inspect")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  inspect(
    @Body(new ZodValidationPipe(InspectTeamInvitationSchema))
    body: {
      token: string;
    },
  ) {
    return this.invitations.inspect(body.token);
  }

  @Post("accept")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  accept(
    @Body(new ZodValidationPipe(AcceptTeamInvitationSchema))
    body: AcceptTeamInvitationInput,
  ) {
    return this.invitations.accept(body);
  }
}
