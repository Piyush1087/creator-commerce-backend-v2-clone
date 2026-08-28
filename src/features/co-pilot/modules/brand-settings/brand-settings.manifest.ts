/**
 * Brand Settings Function Manifest — Part 2 contract adapted to Nest co-pilot.
 * Maps AI tools → submodule → backend BrandSettingsService methods.
 */

import type { WriteIntentKind } from "../../core/write-intent.types";

export type BrandSettingsSubmodule =
  | "GENERAL"
  | "FINANCE"
  | "INTEGRATIONS"
  | "OVERVIEW";

export type BrandSettingsManifestEntry = {
  tool: string;
  intent?: WriteIntentKind;
  description: string;
  submodule: BrandSettingsSubmodule;
  backendRoute: string;
  serviceMethod: string;
  hitl: boolean;
  recoveryMode: "CHAT" | "REDIRECT" | "NONE";
  deepLinkPath?: string;
};

export const BRAND_SETTINGS_FUNCTION_MANIFEST: BrandSettingsManifestEntry[] = [
  {
    tool: "settings.getOverview",
    description: "Brand settings overview (identity + seats)",
    submodule: "OVERVIEW",
    backendRoute: "GET /api/v1/brand/settings",
    serviceMethod: "getOverview",
    hitl: false,
    recoveryMode: "NONE",
  },
  {
    tool: "settings.getGeneral",
    description: "Read general settings (personal profile + organization)",
    submodule: "GENERAL",
    backendRoute: "GET /api/v1/brand/settings/general",
    serviceMethod: "getGeneral",
    hitl: false,
    recoveryMode: "NONE",
    deepLinkPath: "/brand/settings/general",
  },
  {
    tool: "settings.updateGeneral",
    intent: "SETTINGS_UPDATE_GENERAL",
    description:
      "Update operational Organization name or personal first/last name (not email/password, country, or currency)",
    submodule: "GENERAL",
    backendRoute: "PATCH /api/v1/brand/settings/general",
    serviceMethod: "updateGeneral",
    hitl: true,
    recoveryMode: "REDIRECT",
    deepLinkPath: "/brand/settings/general",
  },
  {
    tool: "settings.getBillingProfile",
    description: "Read finance billing profile (GST, PAN, address)",
    submodule: "FINANCE",
    backendRoute: "GET /api/v1/brand/settings/billing-profile",
    serviceMethod: "getBillingProfile",
    hitl: false,
    recoveryMode: "NONE",
    deepLinkPath: "/brand/settings/billing",
  },
  {
    tool: "settings.upsertBillingProfile",
    intent: "SETTINGS_UPDATE_BILLING",
    description: "Create or update billing profile (GST/PAN/company)",
    submodule: "FINANCE",
    backendRoute: "PATCH /api/v1/brand/settings/billing-profile",
    serviceMethod: "upsertBillingProfile",
    hitl: true,
    recoveryMode: "CHAT",
    deepLinkPath: "/brand/settings/billing",
  },
  {
    tool: "settings.getWithdrawalAccount",
    description: "Read linked withdrawal / bank account (masked)",
    submodule: "FINANCE",
    backendRoute: "GET /api/v1/brand/settings/withdrawal-account",
    serviceMethod: "getWithdrawalAccount",
    hitl: false,
    recoveryMode: "NONE",
    deepLinkPath: "/brand/settings/billing",
  },
  {
    tool: "settings.linkWithdrawalAccount",
    intent: "SETTINGS_LINK_WITHDRAWAL",
    description: "Link brand withdrawal bank account",
    submodule: "FINANCE",
    backendRoute: "POST /api/v1/brand/settings/withdrawal-account",
    serviceMethod: "linkWithdrawalAccount",
    hitl: true,
    recoveryMode: "CHAT",
    deepLinkPath: "/brand/settings/billing",
  },
  {
    tool: "settings.viewIntegrations",
    description:
      "Explain integration connection status and deep-link to Settings (OAuth completes in UI)",
    submodule: "INTEGRATIONS",
    backendRoute: "N/A — guided redirect",
    serviceMethod: "n/a",
    hitl: false,
    recoveryMode: "REDIRECT",
    deepLinkPath: "/brand/settings/integrations",
  },
];

export const BRAND_SETTINGS_INTENTS = [
  "VIEW_SETTINGS_OVERVIEW",
  "VIEW_GENERAL_SETTINGS",
  "VIEW_PERSONAL_PROFILE",
  "VIEW_FINANCE_SETTINGS",
  "VIEW_INTEGRATION_STATUS",
  "UPDATE_COMPANY_NAME",
  "UPDATE_FIRST_NAME",
  "UPDATE_LAST_NAME",
  "UPDATE_GST",
  "UPDATE_PAN",
  "UPDATE_BANK_DETAILS",
  "EXPLAIN_SETTING",
] as const;

export type BrandSettingsIntent = (typeof BRAND_SETTINGS_INTENTS)[number];
