import { Injectable } from "@nestjs/common";

import type { AuthUser } from "../../../auth/types/auth-user";
import { BrandSettingsService } from "../../../brand-settings/services/brand-settings.service";
import type { MetricItem } from "../../schemas/copilot-payload.schema";

@Injectable()
export class BrandSettingsCoPilotToolsService {
  constructor(private readonly settings: BrandSettingsService) {}

  getOverview(authUser: AuthUser) {
    return this.settings.getOverview(authUser);
  }

  getGeneral(authUser: AuthUser) {
    return this.settings.getGeneral(authUser);
  }

  getBillingProfile(authUser: AuthUser) {
    return this.settings.getBillingProfile(authUser);
  }

  getWithdrawalAccount(authUser: AuthUser) {
    return this.settings.getWithdrawalAccount(authUser);
  }

  overviewNarrative(
    overview: Awaited<ReturnType<BrandSettingsService["getOverview"]>>,
  ): string {
    const name = overview.brand_identity?.name ?? "Your brand";
    const seats = overview.seat_usage;
    return `${name} settings overview: role ${overview.current_user_role}, ${seats.active_members} active team seat(s), ${seats.pending_invitations} pending invite(s) (max ${seats.max_seats}). Ask about general, finance/billing, or integrations anytime.`;
  }

  generalNarrative(
    general: Awaited<ReturnType<BrandSettingsService["getGeneral"]>>,
    userText = "",
  ): string {
    const n = userText.toLowerCase();
    const personal = general.personal_profile;
    const first = personal.first_name?.trim() || "—";
    const last = personal.last_name?.trim() || "—";
    const email = personal.email?.trim() || "—";
    const displayPersonal =
      [personal.first_name, personal.last_name].filter(Boolean).join(" ") ||
      "—";

    if (
      n.includes("password") &&
      /\b(update|change|set|rename|reset|modify)\b/.test(n)
    ) {
      return "I can’t change passwords from co-pilot. Use your account security flow or contact support.";
    }
    if (
      (n.includes("email") || n.includes("email address")) &&
      /\b(update|change|set|rename|modify)\b/.test(n) &&
      !n.includes("billing email")
    ) {
      return `Account email is ${email}. Email changes aren’t allowed from Settings or co-pilot — contact system support for identity routing changes.`;
    }

    if (
      n.includes("first name") ||
      n.includes("last name") ||
      n.includes("personal profile") ||
      n.includes("personal name") ||
      n.includes("user name") ||
      n.includes("my name") ||
      n.includes("account email") ||
      n.includes("brand owner") ||
      (n.includes("owner") && n.includes("name"))
    ) {
      const owner = general.team.members.find((m) => m.role === "BRAND_OWNER");
      const ownerLabel = owner?.name?.trim() || displayPersonal;
      if (n.includes("first name") && !n.includes("last name")) {
        return `Your first name on personal profile is “${first}”.`;
      }
      if (n.includes("last name") && !n.includes("first name")) {
        return `Your last name on personal profile is “${last}”.`;
      }
      if (n.includes("account email") || (n.includes("email") && !n.includes("billing"))) {
        return `Account email on personal profile is ${email}. Email can’t be changed from co-pilot.`;
      }
      if (n.includes("brand owner") || (n.includes("owner") && n.includes("name"))) {
        return `Brand owner on this workspace is “${ownerLabel}” (${owner?.email ?? email}). Your personal profile name is “${displayPersonal}”.`;
      }
      return `Personal profile: first name “${first}”, last name “${last}”, account email ${email}. I can update first/last name after you confirm — email and password can’t be changed here.`;
    }

    const org = general.organization;
    return `General settings: personal profile “${displayPersonal}” (${email}). Organization “${org.company_legal_name}”, country ${org.country_code ?? "—"}, currency ${org.currency_code ?? "—"}. Brand display name “${general.brand_identity.display_name}”${general.brand_identity.website_url ? ` · ${general.brand_identity.website_url}` : ""}.`;
  }

  financeNarrative(
    billing: Awaited<ReturnType<BrandSettingsService["getBillingProfile"]>>,
    withdrawal: Awaited<
      ReturnType<BrandSettingsService["getWithdrawalAccount"]>
    >,
    userText: string,
  ): string {
    const n = userText.toLowerCase();
    const profile = billing.billing_profile;
    const account = withdrawal.withdrawal_account;

    if (/\bgst(in)?\b/.test(n)) {
      return profile?.gstin
        ? `GSTIN on file: ${profile.gstin}.`
        : "No GSTIN is saved on the billing profile yet.";
    }
    if (/\bpan\b/.test(n)) {
      return "PAN is not part of the canonical Billing Profile.";
    }
    if (n.includes("withdrawal") || n.includes("bank") || n.includes("ifsc")) {
      if (!account) {
        return "No withdrawal bank account is linked yet. You can link one from chat (I’ll confirm first) or open Settings → Billing.";
      }
      return `Withdrawal account: ${account.beneficiary_name} · ${account.bank_name} · ****${account.account_last_4} · IFSC ${account.ifsc_code}.`;
    }

    if (!profile) {
      return "No billing profile is set up yet. I can help create one (legal entity name/type, billing country/address, and optional GSTIN) after you confirm.";
    }

    return `Finance / billing: “${profile.legal_entity_name}” (${profile.legal_entity_type ?? "entity type missing"}), ${profile.billing_country_code ?? "billing country missing"}, GSTIN ${profile.gstin ?? "—"}. Paid-conversion readiness: ${billing.is_complete_for_paid_conversion ? "complete" : `missing ${billing.missing_required_fields.join(", ")}`}.${
      account
        ? ` Withdrawal bank linked (****${account.account_last_4}).`
        : " No withdrawal bank linked yet."
    }`;
  }

  integrationsNarrative(): string {
    return "Integrations (Instagram / Meta) need OAuth in the browser — I can’t complete connect or reconnect inside chat. Open Settings → Integrations to manage connections, then ask me to check status again.";
  }

  generalMetrics(
    general: Awaited<ReturnType<BrandSettingsService["getGeneral"]>>,
    userText = "",
  ): MetricItem[] {
    const n = userText.toLowerCase();
    const personalFocused =
      n.includes("first name") ||
      n.includes("last name") ||
      n.includes("personal profile") ||
      n.includes("personal name") ||
      n.includes("user name") ||
      n.includes("my name") ||
      n.includes("account email") ||
      n.includes("brand owner");

    const personalMetrics: MetricItem[] = [
      {
        label: "First name",
        value: general.personal_profile.first_name ?? "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Last name",
        value: general.personal_profile.last_name ?? "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Account email",
        value: general.personal_profile.email ?? "—",
        statusColor: "NEUTRAL",
      },
    ];

    if (personalFocused) {
      return personalMetrics;
    }

    return [
      ...personalMetrics,
      {
        label: "Organization",
        value: general.organization.company_legal_name ?? "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Country",
        value: general.organization.country_code ?? "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Currency",
        value: general.organization.currency_code ?? "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Website",
        value: general.brand_identity.website_url ?? "—",
        statusColor: "NEUTRAL",
      },
    ];
  }

  financeMetrics(
    billing: Awaited<ReturnType<BrandSettingsService["getBillingProfile"]>>,
    withdrawal: Awaited<
      ReturnType<BrandSettingsService["getWithdrawalAccount"]>
    >,
  ): MetricItem[] {
    const profile = billing.billing_profile;
    const account = withdrawal.withdrawal_account;
    return [
      {
        label: "Legal entity",
        value: profile?.legal_entity_name ?? "Not set",
        statusColor: profile ? "GREEN" : "YELLOW",
      },
      {
        label: "Entity type",
        value: profile?.legal_entity_type ?? "Not set",
        statusColor: profile?.legal_entity_type ? "GREEN" : "YELLOW",
      },
      {
        label: "Billing country",
        value: profile?.billing_country_code ?? "Not set",
        statusColor: profile?.billing_country_code ? "GREEN" : "YELLOW",
      },
      {
        label: "GSTIN",
        value: profile?.gstin ?? "—",
        statusColor: profile?.gstin ? "GREEN" : "YELLOW",
      },
      {
        label: "Withdrawal bank",
        value: account ? `****${account.account_last_4}` : "Not linked",
        statusColor: account ? "GREEN" : "YELLOW",
      },
    ];
  }
}
