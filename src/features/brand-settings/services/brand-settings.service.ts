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
import { BrandTeamService } from "./brand-team.service";
import { BrandTeamInvitationsService } from "./brand-team-invitations.service";
import { canonicalInvitationRole } from "../team/brand-team-policy";

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

export const BILLING_REQUIRED_FIELDS = [
  "legal_entity_name",
  "legal_entity_type",
  "billing_country_code",
  "billing_address",
] as const;

type BillingReadinessSource = {
  registeredCompanyName: string | null;
  legalEntityType: string | null;
  billingCountryCode: string | null;
  corporateBillingAddress: string | null;
} | null;

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
    private readonly team: BrandTeamService,
    private readonly invitations: BrandTeamInvitationsService,
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
        where: {
          brandProfileId,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
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
      this.prisma.brandProfile.findUnique({
        where: { id: brandProfileId },
        include: { organization: { select: { name: true } } },
      }),
      this.prisma.brandTeamMember.findMany({
        where: { brandProfileId, isActive: true },
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      }),
      this.prisma.teamInvitation.findMany({
        where: {
          brandProfileId,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
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
        avatar_url: null,
      },
      organization: {
        company_legal_name: profile.organization?.name ?? null,
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
          role: canonicalInvitationRole(row.role),
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

    if (
      membership.role === BrandRole.CAMPAIGN_MANAGER &&
      input.organizationLegalName
    ) {
      throw new ForbiddenException(
        "Campaign Managers cannot modify organization settings.",
      );
    }

    // Resolve organization authority through the authorized Brand, never input.
    const profile = input.organizationLegalName
      ? await this.prisma.brandProfile.findUnique({
          where: { id: brandProfileId },
          select: { organizationId: true },
        })
      : null;
    if (input.organizationLegalName && !profile?.organizationId) {
      throw new NotFoundException("Organization not found for this Brand");
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

    if (input.organizationLegalName && profile?.organizationId) {
      await this.prisma.organization.update({
        where: { id: profile.organizationId },
        data: { name: input.organizationLegalName },
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

    const readiness = billingReadiness(profile);

    if (!profile)
      return {
        billing_profile: null,
        profile_state: "NOT_CONFIGURED" as const,
        is_read_only: readOnly,
        ...readiness,
      };

    return {
      is_read_only: readOnly,
      profile_state: profile.profileState,
      billing_profile: {
        legal_entity_name: profile.registeredCompanyName,
        legal_entity_type: profile.legalEntityType,
        billing_country_code: profile.billingCountryCode,
        billing_address: profile.corporateBillingAddress,
        gstin: readOnly
          ? maskSensitiveString(profile.gstin, 2, 4)
          : profile.gstin,
        profile_state: profile.profileState,
        configured_at: profile.configuredAt?.toISOString() ?? null,
        updated_at: profile.updatedAt.toISOString(),
      },
      ...readiness,
    };
  }

  async getBillingReadiness(brandProfileId: string) {
    const profile = await this.prisma.brandBillingProfile.findUnique({
      where: { brandProfileId },
      select: {
        registeredCompanyName: true,
        legalEntityType: true,
        billingCountryCode: true,
        corporateBillingAddress: true,
      },
    });
    return billingReadiness(profile);
  }

  async requireCompleteBillingProfile(brandProfileId: string) {
    const readiness = await this.getBillingReadiness(brandProfileId);
    if (!readiness.is_complete_for_paid_conversion) {
      throw new BadRequestException({
        message: "A complete Billing Profile is required for paid conversion.",
        ...readiness,
      });
    }
    return readiness;
  }

  async upsertBillingProfile(user: AuthUser, input: BrandBillingProfileInput) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    this.access.assertFinancialMutation(membership.role);

    const existing = await this.prisma.brandBillingProfile.findUnique({
      where: { brandProfileId },
    });
    const isMaterialUpdate =
      !!existing &&
      (existing.registeredCompanyName !== input.legalEntityName ||
        existing.legalEntityType !== input.legalEntityType ||
        existing.billingCountryCode !== input.billingCountryCode ||
        existing.corporateBillingAddress !== input.billingAddress ||
        existing.gstin !== input.gstin);
    const now = new Date();
    const profile = await this.prisma.brandBillingProfile.upsert({
      where: { brandProfileId },
      create: {
        brandProfileId,
        registeredCompanyName: input.legalEntityName,
        legalEntityType: input.legalEntityType,
        billingCountryCode: input.billingCountryCode,
        corporateBillingAddress: input.billingAddress,
        gstin: input.gstin,
        profileState: "CONFIGURED",
        configuredAt: now,
      },
      update: {
        registeredCompanyName: input.legalEntityName,
        legalEntityType: input.legalEntityType,
        billingCountryCode: input.billingCountryCode,
        corporateBillingAddress: input.billingAddress,
        gstin: input.gstin,
        ...(isMaterialUpdate ? { profileState: "UPDATED" as const } : {}),
      },
    });

    return {
      is_read_only: false,
      profile_state: profile.profileState,
      billing_profile: {
        profile_id: profile.id,
        legal_entity_name: profile.registeredCompanyName,
        legal_entity_type: profile.legalEntityType,
        billing_country_code: profile.billingCountryCode,
        billing_address: profile.corporateBillingAddress,
        gstin: profile.gstin,
        profile_state: profile.profileState,
        configured_at: profile.configuredAt?.toISOString() ?? null,
        updated_at: profile.updatedAt.toISOString(),
      },
      ...billingReadiness(profile),
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

  updateTeamRole(user: AuthUser, input: UpdateTeamRoleInput) {
    return this.team.updateRole(user, input);
  }

  inviteTeamMember(user: AuthUser, input: InviteTeamMemberInput) {
    return this.invitations.create(user, input);
  }

  revokeTeamMember(user: AuthUser, membershipId: string) {
    return this.team.revoke(user, membershipId);
  }

  cancelTeamInvitation(user: AuthUser, invitationId: string) {
    return this.team.cancel(user, invitationId);
  }
}

export function billingReadiness(profile: BillingReadinessSource) {
  const missingRequiredFields: (typeof BILLING_REQUIRED_FIELDS)[number][] = [];
  if (!profile?.registeredCompanyName?.trim())
    missingRequiredFields.push("legal_entity_name");
  if (!profile?.legalEntityType?.trim())
    missingRequiredFields.push("legal_entity_type");
  if (!profile?.billingCountryCode?.trim())
    missingRequiredFields.push("billing_country_code");
  if (!profile?.corporateBillingAddress?.trim())
    missingRequiredFields.push("billing_address");
  return {
    is_complete_for_paid_conversion: missingRequiredFields.length === 0,
    missing_required_fields: missingRequiredFields,
  };
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
