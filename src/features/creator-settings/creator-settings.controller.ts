import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  GoneException,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { SocialNetworkProvider } from "@prisma/client";
import { ThrottlerGuard } from "@nestjs/throttler";
import { z } from "zod";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../co-pilot/pipes/zod-validation.pipe";
import { CreatorInstagramSettingsService } from "./instagram/creator-instagram-settings.service";
import { creatorShippingAddressSchema } from "./schemas/creator-settings.schema";
import { CreatorProfileContactService } from "./services/creator-profile-contact.service";
import {
  CreatorTeamAssignableRoleSchema,
  InviteCreatorTeamMemberSchema,
} from "./team/creator-team.schema";
import { CreatorTeamInvitationsService } from "./team/creator-team-invitations.service";
import { CreatorTeamService } from "./team/creator-team.service";
import { CreatorWorkspaceActorService } from "./team/creator-workspace-actor.service";

const LegacyWorkspaceProfileSchema = z
  .object({ organizationDisplayName: z.string().trim().min(2).max(150) })
  .strict();

const LegacyTeamRoleSchema = z
  .object({
    memberId: z.string().uuid(),
    allocatedRole: CreatorTeamAssignableRoleSchema,
  })
  .strict();

/**
 * COMPATIBILITY_RECONCILIATION_ONLY.
 *
 * Old non-conflicting route shapes delegate to C-05 canonical services. This
 * controller owns no identity, Team, Instagram, profile, contact, or payout
 * persistence and therefore cannot bypass their locks and policies.
 */
@Controller("api/v1/creator/settings")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorSettingsController {
  constructor(
    private readonly actors: CreatorWorkspaceActorService,
    private readonly profileContact: CreatorProfileContactService,
    private readonly team: CreatorTeamService,
    private readonly invitations: CreatorTeamInvitationsService,
    private readonly instagram: CreatorInstagramSettingsService,
  ) {}

  @Get("shipping")
  async getShipping(@Req() request: RequestWithAuthUser) {
    const result = await this.profileContact.getDefaultContact(
      await this.actors.resolve(request.user),
    );
    return { shipping_address: mapLegacyShipping(result.default_contact) };
  }

  @Put("shipping")
  async upsertShipping(
    @Req() request: RequestWithAuthUser,
    @Body(new ZodValidationPipe(creatorShippingAddressSchema))
    body: ReturnType<typeof creatorShippingAddressSchema.parse>,
  ) {
    if (!body.isPrimaryDestination) {
      throw new BadRequestException(
        "Creator Settings supports one canonical default contact only.",
      );
    }
    const actor = await this.actors.resolve(request.user);
    const current = await this.profileContact.getDefaultContact(actor);
    if (current.default_contact?.has_legacy_unstructured_phone) {
      throw new ConflictException({
        code: "CREATOR_CONTACT_PHONE_RECONCILIATION_REQUIRED",
        message:
          "The historical contact phone must be reconciled before updating this address.",
      });
    }
    const result = await this.profileContact.upsertDefaultContact(actor, {
      recipientName: body.recipientLegalName,
      addressLine1: body.streetAddressLine1,
      addressLine2: body.streetAddressLine2,
      city: body.city,
      stateRegion: body.stateProvince,
      postalCode: body.postalCodeZip,
      countryCode: body.countryIsoCode,
      phoneCountryCallingCode:
        current.default_contact?.phone?.country_calling_code ?? null,
      phoneNationalNumber:
        current.default_contact?.phone?.national_number ?? null,
      deliveryInstructions: body.deliveryInstructionsNarrative,
    });
    return { shipping_address: mapLegacyShipping(result.default_contact) };
  }

  @Get("workspace")
  async getWorkspace(@Req() request: RequestWithAuthUser) {
    return mapLegacyWorkspace(await this.team.list(request.user));
  }

  @Patch("workspace")
  async updateWorkspace(
    @Req() request: RequestWithAuthUser,
    @Body(new ZodValidationPipe(LegacyWorkspaceProfileSchema))
    body: z.infer<typeof LegacyWorkspaceProfileSchema>,
  ) {
    await this.profileContact.updateProfile(
      await this.actors.resolve(request.user),
      { organizationName: body.organizationDisplayName },
    );
    return this.getWorkspace(request);
  }

  @Post("team/invite")
  @HttpCode(HttpStatus.CREATED)
  inviteTeamMember(
    @Req() request: RequestWithAuthUser,
    @Body(new ZodValidationPipe(InviteCreatorTeamMemberSchema))
    body: ReturnType<typeof InviteCreatorTeamMemberSchema.parse>,
  ) {
    return this.invitations.create(request.user, body);
  }

  @Patch("team/role")
  updateTeamRole(
    @Req() request: RequestWithAuthUser,
    @Body(new ZodValidationPipe(LegacyTeamRoleSchema))
    body: z.infer<typeof LegacyTeamRoleSchema>,
  ) {
    return this.team.updateRole(
      request.user,
      body.memberId,
      body.allocatedRole,
    );
  }

  @Delete("team/:memberId")
  revokeTeamMember(
    @Req() request: RequestWithAuthUser,
    @Param("memberId") memberId: string,
  ) {
    return this.team.remove(request.user, memberId);
  }

  @Get("social")
  async listSocial(@Req() request: RequestWithAuthUser) {
    const settings = await this.instagram.read(request.user);
    return {
      is_read_only: !settings.allowedActions.disconnect,
      channels:
        settings.lifecycleState === "NOT_CONNECTED"
          ? []
          : [
              {
                platform: SocialNetworkProvider.INSTAGRAM,
                handle: settings.identity.handle,
                display_title: settings.identity.displayTitle,
                avatar_url: settings.identity.avatarUrl,
                token_state: settings.authorization.health,
                token_expires_at: settings.authorization.tokenExpiresAt,
                last_metadata_sync_at:
                  settings.authorization.lastMetadataSyncAt,
                is_token_valid: settings.lifecycleState === "CONNECTED_HEALTHY",
              },
            ],
    };
  }

  @Delete("social/:platform")
  disconnectSocial(
    @Req() request: RequestWithAuthUser,
    @Param("platform") platform: SocialNetworkProvider,
  ) {
    if (platform !== SocialNetworkProvider.INSTAGRAM) {
      throw new BadRequestException(
        "Only Instagram is supported in Creator Settings MVP.",
      );
    }
    return this.instagram.disconnect(request.user);
  }

  @Post("payouts/bank")
  legacyPayoutBankWriterRetired(): never {
    throw new GoneException({
      code: "CREATOR_LEGACY_PLAINTEXT_PAYOUT_WRITER_RETIRED",
      message:
        "Use the canonical encrypted payout destination Settings endpoint.",
    });
  }
}

type CanonicalContact = Awaited<
  ReturnType<CreatorProfileContactService["getDefaultContact"]>
>["default_contact"];

function mapLegacyShipping(contact: CanonicalContact) {
  if (!contact) return null;
  return {
    address_id: contact.contact_id,
    recipient_legal_name: contact.recipient_name,
    street_address_line1: contact.address_line_1,
    street_address_line2: contact.address_line_2,
    city: contact.city,
    state_province: contact.state_region,
    postal_code_zip: contact.postal_code,
    country_iso_code: contact.country_code,
    delivery_instructions_narrative: contact.delivery_instructions,
    is_primary_destination: true,
    updated_at: contact.updated_at,
  };
}

function mapLegacyWorkspace(
  result: Awaited<ReturnType<CreatorTeamService["list"]>>,
) {
  return {
    current_user_role: result.actor.role,
    workspace: {
      workspace_id: result.workspace.workspace_id,
      organization_display_name: result.workspace.organization_name,
    },
    team: {
      members: result.team.members.map((member) => ({
        member_id: member.membership_id,
        email: member.email,
        name: member.name,
        role: member.role,
        status: member.status,
        is_current_user: member.is_current_actor,
      })),
      pending_invitations: result.team.pending_invitations,
      seat_usage: result.team.seat_usage,
    },
  };
}
