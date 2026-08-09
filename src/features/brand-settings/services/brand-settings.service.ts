import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BrandRole,
  SettingsNotificationCategory,
  SettingsNotificationChannel,
} from "@prisma/client";
import { randomBytes } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  decryptField,
  encryptField,
  maskAccountLast4,
  maskSensitiveString,
} from "../../../shared/crypto/field-encryption.util";
import type { AuthUser } from "../../auth/types/auth-user";
import type {
  BrandBillingProfileInput,
  BrandWithdrawalAccountInput,
  BulkNotificationSettingsInput,
  InviteTeamMemberInput,
  UpdateBrandGeneralProfileInput,
  UpdateTeamRoleInput,
} from "../schemas/brand-settings.schema";
import {
  BRAND_SETTINGS_MAX_SEATS,
  BrandSettingsAccessService,
} from "./brand-settings-access.service";
import { decimalToNumber } from "../../brand-uce/utils/uce-decimal.util";

const DEFAULT_NOTIFICATION_MATRIX: Array<{
  category: SettingsNotificationCategory;
  channel: SettingsNotificationChannel;
  isEnabled: boolean;
}> = [
  { category: "ESCROW_LOW_BALANCE", channel: "IN_APP", isEnabled: true },
  { category: "ESCROW_LOW_BALANCE", channel: "EMAIL", isEnabled: true },
  { category: "MILESTONE_RELEASE_REQUEST", channel: "IN_APP", isEnabled: true },
  {
    category: "TAX_COMPLIANCE_ALERT",
    channel: "IN_APP",
    isEnabled: true,
  },
  { category: "TAX_COMPLIANCE_ALERT", channel: "EMAIL", isEnabled: true },
  {
    category: "CAMPAIGN_BUDGET_OVERRUN",
    channel: "IN_APP",
    isEnabled: true,
  },
];

@Injectable()
export class BrandSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandSettingsAccessService,
  ) {}

  async getOverview(user: AuthUser) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);

    const [profile, teamCount, pendingInvites] = await Promise.all([
      this.prisma.brandProfile.findUnique({
        where: { id: brandProfileId },
        select: {
          id: true,
          name: true,
          domain: true,
          countryCode: true,
          currencyCode: true,
          logoUrl: true,
        },
      }),
      this.prisma.brandTeamMember.count({
        where: { brandProfileId, isActive: true },
      }),
      this.prisma.teamInvitation.count({
        where: { brandProfileId, status: "PENDING" },
      }),
    ]);

    return {
      brand_profile_id: brandProfileId,
      current_user_role: membership.role,
      is_financial_read_only: this.access.isFinancialReadOnly(membership.role),
      brand_identity: profile,
      seat_usage: {
        active_members: teamCount,
        pending_invitations: pendingInvites,
        max_seats: BRAND_SETTINGS_MAX_SEATS,
        is_at_capacity: teamCount + pendingInvites >= BRAND_SETTINGS_MAX_SEATS,
      },
    };
  }

  async getGeneral(user: AuthUser) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);

    const [userRow, profile, team, invitations] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id } }),
      this.prisma.brandProfile.findUnique({ where: { id: brandProfileId } }),
      this.prisma.brandTeamMember.findMany({
        where: { brandProfileId, isActive: true },
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      }),
      this.prisma.teamInvitation.findMany({
        where: { brandProfileId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    const { firstName, lastName } = splitDisplayName(userRow?.name);

    return {
      current_user_role: membership.role,
      personal_profile: {
        first_name: firstName,
        last_name: lastName,
        email: user.email,
        avatar_url: profile.logoUrl,
      },
      organization: {
        company_legal_name: profile.name,
        corporate_address: null,
        country_code: profile.countryCode,
        currency_code: profile.currencyCode,
        tax_id: null,
      },
      brand_identity: {
        display_name: profile.name,
        website_url: profile.domain,
        logo_url: profile.logoUrl,
        is_locked: true,
      },
      team: {
        members: team.map((row) => ({
          membership_id: row.id,
          user_id: row.userId,
          name: row.user.name,
          email: row.user.email,
          role: row.role,
          status: "ACTIVE",
          is_current_user: row.userId === user.id,
        })),
        pending_invitations: invitations.map((row) => ({
          invitation_id: row.id,
          email: row.email,
          role: row.role,
          status: row.status,
          expires_at: row.expiresAt.toISOString(),
        })),
        seat_usage: {
          active_members: team.length,
          pending_invitations: invitations.length,
          max_seats: BRAND_SETTINGS_MAX_SEATS,
        },
      },
    };
  }

  async updateGeneral(user: AuthUser, input: UpdateBrandGeneralProfileInput) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);

    if (membership.role === BrandRole.CAMPAIGN_MANAGER) {
      throw new ForbiddenException(
        "Campaign Managers cannot modify organization settings.",
      );
    }

    const updates: {
      name?: string;
      countryCode?: string;
      currencyCode?: string;
    } = {};

    if (input.organizationLegalName) {
      updates.name = input.organizationLegalName;
    }
    if (input.countryCode) {
      updates.countryCode = input.countryCode.toUpperCase();
    }
    if (input.currencyCode) {
      updates.currencyCode = input.currencyCode.toUpperCase();
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

    if (Object.keys(updates).length > 0) {
      await this.prisma.brandProfile.update({
        where: { id: brandProfileId },
        data: updates,
      });
    }

    return this.getGeneral(user);
  }

  async getBillingProfile(user: AuthUser) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    const readOnly = this.access.isFinancialReadOnly(membership.role);

    const profile = await this.prisma.brandBillingProfile.findUnique({
      where: { brandProfileId },
    });

    if (!profile) {
      return { billing_profile: null, is_read_only: readOnly };
    }

    return {
      is_read_only: readOnly,
      billing_profile: {
        registered_company_name: profile.registeredCompanyName,
        corporate_billing_address: profile.corporateBillingAddress,
        gstin: readOnly
          ? maskSensitiveString(profile.gstin, 2, 4)
          : profile.gstin,
        pan: readOnly ? maskSensitiveString(profile.pan, 1, 1) : profile.pan,
        default_tds_percentage: decimalToNumber(profile.defaultTdsPercentage),
        currency_preference: profile.currencyPreference,
        updated_at: profile.updatedAt.toISOString(),
      },
    };
  }

  async upsertBillingProfile(user: AuthUser, input: BrandBillingProfileInput) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    this.access.assertFinancialMutation(membership.role);

    const profile = await this.prisma.brandBillingProfile.upsert({
      where: { brandProfileId },
      create: {
        brandProfileId,
        registeredCompanyName: input.registeredCompanyName,
        corporateBillingAddress: input.corporateBillingAddress,
        gstin: input.gstin,
        pan: input.pan,
        defaultTdsPercentage: input.defaultTdsPercentage,
        currencyPreference: input.currencyPreference,
      },
      update: {
        registeredCompanyName: input.registeredCompanyName,
        corporateBillingAddress: input.corporateBillingAddress,
        gstin: input.gstin,
        pan: input.pan,
        defaultTdsPercentage: input.defaultTdsPercentage,
        currencyPreference: input.currencyPreference,
      },
    });

    return {
      billing_profile: {
        profile_id: profile.id,
        registered_company_name: profile.registeredCompanyName,
        default_tds_percentage: decimalToNumber(profile.defaultTdsPercentage),
        updated_at: profile.updatedAt.toISOString(),
      },
    };
  }

  async getWithdrawalAccount(user: AuthUser) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    const readOnly = this.access.isFinancialReadOnly(membership.role);

    const account = await this.prisma.brandWithdrawalAccount.findFirst({
      where: { brandProfileId },
      orderBy: { updatedAt: "desc" },
    });

    if (!account) {
      return { withdrawal_account: null, is_read_only: readOnly };
    }

    let accountLast4: string | null = null;
    if (!readOnly) {
      try {
        const plain = decryptField(account.accountNumberEncrypted);
        accountLast4 = maskAccountLast4(plain);
      } catch {
        accountLast4 = "****";
      }
    } else {
      accountLast4 = "****";
    }

    return {
      is_read_only: readOnly,
      withdrawal_account: {
        account_id: account.id,
        beneficiary_name: account.beneficiaryName,
        bank_name: account.bankName,
        account_last_4: accountLast4,
        ifsc_code: readOnly
          ? maskSensitiveString(account.ifscCode, 4, 0)
          : account.ifscCode,
        is_verified: account.isVerifiedPayoutDestination,
        updated_at: account.updatedAt.toISOString(),
      },
    };
  }

  async linkWithdrawalAccount(
    user: AuthUser,
    input: BrandWithdrawalAccountInput,
  ) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    this.access.assertFinancialMutation(membership.role);

    const encrypted = encryptField(input.accountNumber);

    const account = await this.prisma.brandWithdrawalAccount.create({
      data: {
        brandProfileId,
        beneficiaryName: input.beneficiaryName,
        bankName: input.bankName,
        accountNumberEncrypted: encrypted,
        ifscCode: input.ifscCode,
        isVerifiedPayoutDestination: true,
      },
    });

    return {
      account_id: account.id,
      is_verified: account.isVerifiedPayoutDestination,
    };
  }

  async getNotifications(user: AuthUser) {
    const { brandProfileId } = await this.access.resolveBrandContext(user);

    let settings = await this.prisma.brandNotificationSetting.findMany({
      where: { brandProfileId },
      orderBy: [{ category: "asc" }, { channel: "asc" }],
    });

    if (settings.length === 0) {
      await this.prisma.brandNotificationSetting.createMany({
        data: DEFAULT_NOTIFICATION_MATRIX.map((row) => ({
          brandProfileId,
          ...row,
        })),
      });
      settings = await this.prisma.brandNotificationSetting.findMany({
        where: { brandProfileId },
        orderBy: [{ category: "asc" }, { channel: "asc" }],
      });
    }

    return {
      settings: settings.map((row) => ({
        setting_id: row.id,
        category: row.category,
        channel: row.channel,
        is_enabled: row.isEnabled,
        slack_webhook_url: row.slackWebhookUrl,
      })),
    };
  }

  async updateNotifications(
    user: AuthUser,
    input: BulkNotificationSettingsInput,
  ) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);

    if (membership.role === BrandRole.CAMPAIGN_MANAGER) {
      throw new ForbiddenException(
        "Campaign Managers cannot modify notification settings.",
      );
    }

    await this.prisma.$transaction(
      input.settings.map((line) =>
        this.prisma.brandNotificationSetting.upsert({
          where: {
            brandProfileId_category_channel: {
              brandProfileId,
              category: line.category,
              channel: line.channel,
            },
          },
          create: {
            brandProfileId,
            category: line.category,
            channel: line.channel,
            isEnabled: line.isEnabled,
            slackWebhookUrl:
              line.channel === "SLACK_WEBHOOK"
                ? (line.slackWebhookUrl ?? null)
                : null,
          },
          update: {
            isEnabled: line.isEnabled,
            slackWebhookUrl:
              line.channel === "SLACK_WEBHOOK"
                ? (line.slackWebhookUrl ?? null)
                : null,
          },
        }),
      ),
    );

    return this.getNotifications(user);
  }

  async updateTeamRole(user: AuthUser, input: UpdateTeamRoleInput) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    this.access.assertTeamAdmin(membership.role);

    const target = await this.access.getMembershipOrThrow(
      input.membershipId,
      brandProfileId,
    );

    if (
      target.role === BrandRole.BRAND_OWNER &&
      input.role !== BrandRole.BRAND_OWNER
    ) {
      const ownerCount = await this.prisma.brandTeamMember.count({
        where: {
          brandProfileId,
          isActive: true,
          role: BrandRole.BRAND_OWNER,
        },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          "At least one Brand Owner must remain on the workspace.",
        );
      }
    }

    const updated = await this.prisma.brandTeamMember.update({
      where: { id: input.membershipId },
      data: { role: input.role },
      include: { user: true },
    });

    return {
      membership_id: updated.id,
      user_id: updated.userId,
      email: updated.user.email,
      role: updated.role,
    };
  }

  async inviteTeamMember(user: AuthUser, input: InviteTeamMemberInput) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    this.access.assertTeamAdmin(membership.role);

    const [activeMembers, pendingInvites] = await Promise.all([
      this.prisma.brandTeamMember.count({
        where: { brandProfileId, isActive: true },
      }),
      this.prisma.teamInvitation.count({
        where: { brandProfileId, status: "PENDING" },
      }),
    ]);

    if (activeMembers + pendingInvites >= BRAND_SETTINGS_MAX_SEATS) {
      throw new BadRequestException(
        "Workspace seat capacity fully exhausted (5/5). Revoke a member or cancel a pending invitation.",
      );
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.teamInvitation.create({
      data: {
        brandProfileId,
        email: normalizedEmail,
        role: mapBrandRoleToLegacyInviteRole(input.role),
        token,
        expiresAt,
      },
    });

    return {
      invitation_id: invitation.id,
      email: invitation.email,
      role: input.role,
      expires_at: invitation.expiresAt.toISOString(),
    };
  }

  async revokeTeamMember(user: AuthUser, membershipId: string) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    this.access.assertTeamAdmin(membership.role);

    const target = await this.access.getMembershipOrThrow(
      membershipId,
      brandProfileId,
    );

    if (target.userId === user.id) {
      throw new BadRequestException("You cannot revoke your own access.");
    }

    if (target.role === BrandRole.BRAND_OWNER) {
      const ownerCount = await this.prisma.brandTeamMember.count({
        where: {
          brandProfileId,
          isActive: true,
          role: BrandRole.BRAND_OWNER,
        },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          "Cannot revoke the last Brand Owner on this workspace.",
        );
      }
    }

    await this.prisma.brandTeamMember.update({
      where: { id: membershipId },
      data: { isActive: false },
    });

    return { revoked: true, membership_id: membershipId };
  }

  async cancelTeamInvitation(user: AuthUser, invitationId: string) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    this.access.assertTeamAdmin(membership.role);

    const invitation = await this.prisma.teamInvitation.findFirst({
      where: { id: invitationId, brandProfileId, status: "PENDING" },
    });
    if (!invitation) {
      throw new NotFoundException("Pending invitation not found");
    }

    await this.prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: "EXPIRED" },
    });

    return { cancelled: true, invitation_id: invitationId };
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

function mapBrandRoleToLegacyInviteRole(role: BrandRole): string {
  switch (role) {
    case BrandRole.BRAND_OWNER:
      return "ADMIN";
    case BrandRole.FINANCE_ADMIN:
      return "FINANCE_ADMIN";
    default:
      return "CAMPAIGN_MANAGER";
  }
}
