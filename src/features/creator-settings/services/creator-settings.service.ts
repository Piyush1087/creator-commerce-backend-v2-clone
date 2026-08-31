import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreatorBankVerificationStatus,
  CreatorTeamRole,
  OAuthTokenStatus,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SocialNetworkProvider,
  WorkspaceInvitationStatus,
} from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  maskAccountLast4,
  maskSensitiveString,
} from "../../../shared/crypto/field-encryption.util";
import type { AuthUser } from "../../auth/types/auth-user";
import type {
  CreatorShippingAddressInput,
  InviteWorkspaceMemberInput,
  PaymentGatewayVerificationInput,
  UpdateCreatorProfileInput,
  UpdateWorkspaceProfileInput,
} from "../schemas/creator-settings.schema";
import {
  CREATOR_SETTINGS_MAX_SEATS,
  CreatorSettingsAccessService,
} from "./creator-settings-access.service";
import { CreatorPayoutProfileService } from "../../brand-escrow/services/creator-payout-profile.service";

@Injectable()
export class CreatorSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreatorSettingsAccessService,
    private readonly payoutProfiles: CreatorPayoutProfileService,
  ) {}

  async getProfile(user: AuthUser) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );

    const userRow = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    const { firstName, lastName } = splitDisplayName(userRow?.name);

    return {
      current_user_role: role,
      is_read_only: this.access.isAssistantReadOnly(role),
      profile: {
        display_name: profile.displayName,
        first_name: firstName,
        last_name: lastName,
        email: user.email,
        avatar_url: profile.avatarUrl,
        primary_region: profile.primaryRegion,
      },
      workspace: {
        workspace_id: workspace.id,
        organization_display_name: workspace.organizationDisplayName,
      },
    };
  }

  async updateProfile(user: AuthUser, input: UpdateCreatorProfileInput) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );

    if (this.access.isAssistantReadOnly(role)) {
      throw new ForbiddenException("Assistant profiles cannot edit profile.");
    }

    if (input.firstName || input.lastName) {
      const current = await this.prisma.user.findUnique({
        where: { id: user.id },
      });
      const { firstName: existingFirst, lastName: existingLast } =
        splitDisplayName(current?.name);
      const nextName = [
        input.firstName ?? existingFirst,
        input.lastName ?? existingLast,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { name: nextName || null },
      });
    }

    if (input.displayName) {
      await this.prisma.creatorProfile.update({
        where: { id: profile.id },
        data: { displayName: input.displayName },
      });
    }

    return this.getProfile(user);
  }

  async getShipping(user: AuthUser) {
    const profile = await this.access.resolveCreatorProfile(user);
    const address = await this.prisma.creatorShippingAddress.findFirst({
      where: { creatorProfileId: profile.id, isDefault: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!address) {
      return { shipping_address: null };
    }

    return {
      shipping_address: mapShippingAddress(address),
    };
  }

  async upsertShipping(user: AuthUser, input: CreatorShippingAddressInput) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );

    if (this.access.isAssistantReadOnly(role)) {
      throw new ForbiddenException(
        "Assistant profiles cannot modify shipping addresses.",
      );
    }

    if (input.isPrimaryDestination) {
      await this.prisma.creatorShippingAddress.updateMany({
        where: { creatorProfileId: profile.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const existing = await this.prisma.creatorShippingAddress.findFirst({
      where: { creatorProfileId: profile.id, isDefault: true },
    });

    const payload = {
      recipientName: input.recipientLegalName,
      addressLine1: input.streetAddressLine1,
      addressLine2: input.streetAddressLine2,
      city: input.city,
      stateRegion: input.stateProvince,
      postalCode: input.postalCodeZip,
      countryCode: input.countryIsoCode,
      deliveryInstructionsNarrative: input.deliveryInstructionsNarrative,
      isDefault: input.isPrimaryDestination,
    };

    const saved = existing
      ? await this.prisma.creatorShippingAddress.update({
          where: { id: existing.id },
          data: payload,
        })
      : await this.prisma.creatorShippingAddress.create({
          data: {
            creatorProfileId: profile.id,
            ...payload,
          },
        });

    return { shipping_address: mapShippingAddress(saved) };
  }

  async getWorkspace(user: AuthUser) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );

    const [members, invitations] = await Promise.all([
      this.prisma.creatorWorkspaceMember.findMany({
        where: { workspaceId: workspace.id, isActive: true },
        include: { assignedProfile: { include: { user: true } } },
        orderBy: { joinedAt: "asc" },
      }),
      this.prisma.creatorWorkspaceInvitation.findMany({
        where: {
          workspaceId: workspace.id,
          invitationStatus: WorkspaceInvitationStatus.PENDING,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      current_user_role: role,
      workspace: {
        workspace_id: workspace.id,
        organization_display_name: workspace.organizationDisplayName,
      },
      team: {
        members: members.map((row) => ({
          member_id: row.id,
          email: row.associatedEmail,
          name:
            row.assignedProfile?.displayName ?? row.assignedProfile?.user.name,
          role: row.securityRole,
          status: "ACTIVE",
          is_current_user:
            row.assignedProfileId === profile.id ||
            row.associatedEmail === user.email.toLowerCase(),
        })),
        pending_invitations: invitations.map((row) => ({
          invitation_id: row.id,
          email: row.recipientEmail,
          role: row.allocatedRole,
          expires_at: row.expiresAt.toISOString(),
        })),
        seat_usage: {
          active_members: members.length,
          pending_invitations: invitations.length,
          max_seats: CREATOR_SETTINGS_MAX_SEATS,
          is_at_capacity:
            members.length + invitations.length >= CREATOR_SETTINGS_MAX_SEATS,
        },
      },
    };
  }

  async updateWorkspace(user: AuthUser, input: UpdateWorkspaceProfileInput) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );
    this.access.assertWorkspaceAdmin(role);

    await this.prisma.creatorWorkspace.update({
      where: { id: workspace.id },
      data: { organizationDisplayName: input.organizationDisplayName },
    });

    return this.getWorkspace(user);
  }

  async inviteWorkspaceMember(
    user: AuthUser,
    input: InviteWorkspaceMemberInput,
  ) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );
    this.access.assertWorkspaceAdmin(role);

    if (
      input.allocatedRole === CreatorTeamRole.OWNER &&
      role !== CreatorTeamRole.OWNER
    ) {
      throw new ForbiddenException("Only owners can invite other owners.");
    }

    const [activeMembers, pendingInvites] = await Promise.all([
      this.prisma.creatorWorkspaceMember.count({
        where: { workspaceId: workspace.id, isActive: true },
      }),
      this.prisma.creatorWorkspaceInvitation.count({
        where: {
          workspaceId: workspace.id,
          invitationStatus: WorkspaceInvitationStatus.PENDING,
        },
      }),
    ]);

    if (activeMembers + pendingInvites >= CREATOR_SETTINGS_MAX_SEATS) {
      throw new BadRequestException(
        "Workspace seat capacity fully exhausted (5/5).",
      );
    }

    const token = randomBytes(32).toString("hex");
    const secureTokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.creatorWorkspaceInvitation.create({
      data: {
        workspaceId: workspace.id,
        recipientEmail: input.recipientEmail.trim().toLowerCase(),
        allocatedRole: input.allocatedRole,
        secureTokenHash,
        expiresAt,
      },
    });

    return {
      invitation_id: invitation.id,
      email: invitation.recipientEmail,
      role: invitation.allocatedRole,
      expires_at: invitation.expiresAt.toISOString(),
    };
  }

  async updateWorkspaceMemberRole(
    user: AuthUser,
    memberId: string,
    allocatedRole: CreatorTeamRole,
  ) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );
    this.access.assertWorkspaceAdmin(role);

    const member = await this.access.getWorkspaceMemberOrThrow(
      workspace.id,
      memberId,
    );

    if (
      member.securityRole === CreatorTeamRole.OWNER &&
      allocatedRole !== CreatorTeamRole.OWNER
    ) {
      const ownerCount = await this.prisma.creatorWorkspaceMember.count({
        where: {
          workspaceId: workspace.id,
          isActive: true,
          securityRole: CreatorTeamRole.OWNER,
        },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          "At least one workspace owner must remain active.",
        );
      }
    }

    const updated = await this.prisma.creatorWorkspaceMember.update({
      where: { id: memberId },
      data: { securityRole: allocatedRole },
    });

    return {
      member_id: updated.id,
      role: updated.securityRole,
    };
  }

  async revokeWorkspaceMember(user: AuthUser, memberId: string) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );
    this.access.assertWorkspaceAdmin(role);

    const member = await this.access.getWorkspaceMemberOrThrow(
      workspace.id,
      memberId,
    );

    if (member.assignedProfileId === profile.id) {
      throw new BadRequestException("You cannot revoke your own access.");
    }

    await this.prisma.creatorWorkspaceMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    return { revoked: true, member_id: memberId };
  }

  async cancelWorkspaceInvitation(user: AuthUser, invitationId: string) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );
    this.access.assertWorkspaceAdmin(role);

    const invitation = await this.prisma.creatorWorkspaceInvitation.findFirst({
      where: {
        id: invitationId,
        workspaceId: workspace.id,
        invitationStatus: WorkspaceInvitationStatus.PENDING,
      },
    });
    if (!invitation) {
      throw new NotFoundException("Pending invitation not found");
    }

    await this.prisma.creatorWorkspaceInvitation.update({
      where: { id: invitationId },
      data: { invitationStatus: WorkspaceInvitationStatus.EXPIRED },
    });

    return { cancelled: true, invitation_id: invitationId };
  }

  async listSocialIntegrations(user: AuthUser) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );

    const integrations = await this.prisma.creatorSocialIntegration.findMany({
      where: { creatorProfileId: profile.id },
      orderBy: { platformNetwork: "asc" },
    });

    return {
      is_read_only: this.access.isAssistantReadOnly(role),
      channels: integrations.map((row) => ({
        integration_id: row.id,
        platform: row.platformNetwork,
        handle: row.channelHandleString,
        display_title: row.channelDisplayTitle,
        avatar_url: row.verifiedAvatarUrl,
        token_state: row.tokenStateCondition,
        token_expires_at: row.tokenExpiresAt?.toISOString() ?? null,
        last_metadata_sync_at: row.lastMetadataSyncAt?.toISOString() ?? null,
        is_token_valid: row.tokenStateCondition === OAuthTokenStatus.ACTIVE,
      })),
    };
  }

  async disconnectSocialIntegration(
    user: AuthUser,
    platform: SocialNetworkProvider,
  ) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );

    if (this.access.isAssistantReadOnly(role)) {
      throw new ForbiddenException(
        "Assistant profiles cannot disconnect social channels.",
      );
    }

    const existing = await this.prisma.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: profile.id,
          platformNetwork: platform,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("Social integration not found");
    }

    await this.prisma.creatorSocialIntegration.update({
      where: { id: existing.id },
      data: {
        tokenStateCondition: OAuthTokenStatus.REVOKED,
        authorizationHealth: ProviderAuthorizationHealth.DISCONNECTED,
        authorizationHealthReasonCode: "USER_DISCONNECTED",
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
        insightsCapability: ProviderCapabilityState.UNAVAILABLE,
        disconnectedAt: new Date(),
      },
    });

    return { disconnected: true, platform };
  }

  async getPayoutSettings(user: AuthUser) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );
    const readOnly = this.access.isAssistantReadOnly(role);

    const [bank, settlement, payoutProfile] = await Promise.all([
      this.prisma.creatorBankDetails.findFirst({
        where: { creatorProfileId: profile.id, isPrimary: true },
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.creatorSettlementProfile.findUnique({
        where: { creatorProfileId: profile.id },
      }),
      this.prisma.creatorPayoutProfile.findUnique({
        where: { creatorProfileId: profile.id },
      }),
    ]);

    return {
      is_read_only: readOnly,
      bank_node: bank
        ? {
            bank_name: bank.bankName,
            beneficiary_name: bank.accountHolder,
            account_last_4: readOnly
              ? "****"
              : maskAccountLast4(bank.accountNumber),
            ifsc_code: readOnly
              ? maskSensitiveString(bank.ifscOrRouting, 4, 0)
              : bank.ifscOrRouting,
            verification_status: bank.verificationStatus,
          }
        : null,
      settlement_profile: settlement
        ? {
            account_holder_name: settlement.accountHolderName,
            is_pan_verified: settlement.isPanVerified,
            pan_masked: readOnly
              ? maskSensitiveString(settlement.panNumber, 1, 1)
              : settlement.panNumber,
            is_settlement_route_active: settlement.isSettlementRouteActive,
          }
        : null,
      route_payout_profile: payoutProfile
        ? {
            setup_status: payoutProfile.onboardingStatus,
            bank_status: payoutProfile.bankStatus,
            operational_eligibility: payoutProfile.operationalEligibility,
            is_ready:
              payoutProfile.operationalEligibility ===
                "ELIGIBLE_FOR_TRANSFER" &&
              payoutProfile.bankStatus === "BANK_VALIDATED",
            masked_bank_display: payoutProfile.maskedBankDisplay,
            last_provider_reconciled_at:
              payoutProfile.lastProviderReconciledAt?.toISOString() ?? null,
          }
        : {
            setup_status: "NOT_STARTED",
            bank_status: "BANK_NOT_CONFIGURED",
            operational_eligibility: "NO_LINKED_ACCOUNT",
            is_ready: false,
            masked_bank_display: null,
            last_provider_reconciled_at: null,
          },
    };
  }

  async upsertPayoutBank(
    user: AuthUser,
    input: PaymentGatewayVerificationInput,
  ) {
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );
    this.access.assertPayoutMutation(role);

    await this.prisma.creatorBankDetails.updateMany({
      where: { creatorProfileId: profile.id, isPrimary: true },
      data: { isPrimary: false },
    });

    const bank = await this.prisma.creatorBankDetails.create({
      data: {
        creatorProfileId: profile.id,
        accountHolder: input.beneficiaryLegalName,
        bankName: "Primary settlement bank",
        accountNumber: input.accountNumber,
        ifscOrRouting: input.routingIfscSwift,
        isPrimary: true,
        verificationStatus: CreatorBankVerificationStatus.PENDING,
      },
    });

    await this.prisma.creatorSettlementProfile.upsert({
      where: { creatorProfileId: profile.id },
      create: {
        creatorProfileId: profile.id,
        accountHolderName: input.beneficiaryLegalName,
        bankAccountNumber: input.accountNumber,
        ifscCode: input.routingIfscSwift,
      },
      update: {
        accountHolderName: input.beneficiaryLegalName,
        bankAccountNumber: input.accountNumber,
        ifscCode: input.routingIfscSwift,
      },
    });

    await this.payoutProfiles.invalidateReadiness(profile.id, "BANK_CHANGED");

    return {
      bank_id: bank.id,
      verification_status: bank.verificationStatus,
    };
  }
}

function splitDisplayName(name: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  if (!name?.trim()) {
    return { firstName: null, lastName: null };
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function mapShippingAddress(address: {
  id: string;
  recipientName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateRegion: string | null;
  postalCode: string;
  countryCode: string;
  deliveryInstructionsNarrative: string | null;
  isDefault: boolean;
  updatedAt: Date;
}) {
  return {
    address_id: address.id,
    recipient_legal_name: address.recipientName,
    street_address_line1: address.addressLine1,
    street_address_line2: address.addressLine2,
    city: address.city,
    state_province: address.stateRegion,
    postal_code_zip: address.postalCode,
    country_iso_code: address.countryCode,
    delivery_instructions_narrative: address.deliveryInstructionsNarrative,
    is_primary_destination: address.isDefault,
    updated_at: address.updatedAt.toISOString(),
  };
}
