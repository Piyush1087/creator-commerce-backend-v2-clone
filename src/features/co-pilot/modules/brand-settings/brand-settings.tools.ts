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
  ): string {
    const org = general.organization;
    return `General settings: company “${org.company_legal_name}”, country ${org.country_code ?? "—"}, currency ${org.currency_code ?? "—"}. Brand display name “${general.brand_identity.display_name}”${general.brand_identity.website_url ? ` · ${general.brand_identity.website_url}` : ""}.`;
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
      return profile?.pan
        ? `PAN on file: ${profile.pan}.`
        : "No PAN is saved on the billing profile yet.";
    }
    if (n.includes("withdrawal") || n.includes("bank") || n.includes("ifsc")) {
      if (!account) {
        return "No withdrawal bank account is linked yet. You can link one from chat (I’ll confirm first) or open Settings → Billing.";
      }
      return `Withdrawal account: ${account.beneficiary_name} · ${account.bank_name} · ****${account.account_last_4} · IFSC ${account.ifsc_code}.`;
    }

    if (!profile) {
      return "No billing profile is set up yet. I can help create one (company name, address, GST/PAN) after you confirm.";
    }

    return `Finance / billing: “${profile.registered_company_name}”, GST ${profile.gstin ?? "—"}, PAN ${profile.pan ?? "—"}, TDS default ${profile.default_tds_percentage}%, currency ${profile.currency_preference}.${
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
  ): MetricItem[] {
    return [
      {
        label: "Company",
        value: general.organization.company_legal_name,
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
        label: "Registered company",
        value: profile?.registered_company_name ?? "Not set",
        statusColor: profile ? "GREEN" : "YELLOW",
      },
      {
        label: "GSTIN",
        value: profile?.gstin ?? "—",
        statusColor: profile?.gstin ? "GREEN" : "YELLOW",
      },
      {
        label: "PAN",
        value: profile?.pan ?? "—",
        statusColor: profile?.pan ? "GREEN" : "YELLOW",
      },
      {
        label: "Default TDS %",
        value: profile ? String(profile.default_tds_percentage) : "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Withdrawal bank",
        value: account ? `****${account.account_last_4}` : "Not linked",
        statusColor: account ? "GREEN" : "YELLOW",
      },
    ];
  }
}
