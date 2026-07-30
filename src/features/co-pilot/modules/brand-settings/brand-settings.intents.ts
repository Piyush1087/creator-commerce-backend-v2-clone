import type { ReadQueryKind } from "../../core/read-kind.types";
import type { DetectedWriteIntent } from "../../core/write-intent.types";
import type { SlotFillingData } from "../../schemas/copilot-payload.schema";

function textSlot(
  fieldName: string,
  uiLabel: string,
  placeholderText: string,
): SlotFillingData["missingSlots"][number] {
  return {
    fieldName,
    uiLabel,
    inputType: "TEXT",
    selectOptions: [],
    placeholderText,
  };
}

/** Soft gate: message may belong to Brand Settings. */
export function looksLikeBrandSettingsUtterance(normalizedText: string): boolean {
  const n = normalizedText.toLowerCase();
  if (
    n.includes("collaboration") ||
    n.includes("collab") ||
    n.includes("campaign") ||
    n.includes("escrow vault") ||
    n.includes("ledger")
  ) {
    return false;
  }
  return (
    n.includes("settings") ||
    n.includes("billing profile") ||
    n.includes("company name") ||
    n.includes("organization name") ||
    n.includes("legal name") ||
    /\bgst(in)?\b/.test(n) ||
    /\bpan\b/.test(n) ||
    n.includes("withdrawal account") ||
    n.includes("bank account") ||
    n.includes("ifsc") ||
    n.includes("corporate address") ||
    n.includes("billing address") ||
    (n.includes("integration") &&
      (n.includes("instagram") ||
        n.includes("meta") ||
        n.includes("connect") ||
        n.includes("status"))) ||
    (n.includes("finance") && n.includes("setting")) ||
    (n.includes("general") && n.includes("setting"))
  );
}

export function detectBrandSettingsRead(
  userText: string,
): ReadQueryKind | null {
  const n = userText.toLowerCase().trim();
  if (!looksLikeBrandSettingsUtterance(n) && !n.includes("settings")) {
    // Allow GST/PAN even without "settings" word
    if (!/\bgst(in)?\b/.test(n) && !/\bpan\b/.test(n) && !n.includes("ifsc")) {
      return null;
    }
  }

  // Don't steal escrow vault TDS asks
  if (
    (n.includes("tds") && (n.includes("buffer") || n.includes("vault"))) ||
    n.includes("escrow vault") ||
    n.includes("ledger")
  ) {
    return null;
  }

  if (
    n.includes("integration") ||
    n.includes("instagram connect") ||
    n.includes("meta connect") ||
    n.includes("oauth")
  ) {
    return "SETTINGS_INTEGRATIONS";
  }

  if (
    /\bgst(in)?\b/.test(n) ||
    /\bpan\b/.test(n) ||
    n.includes("billing") ||
    n.includes("withdrawal") ||
    n.includes("bank account") ||
    n.includes("ifsc") ||
    n.includes("finance setting") ||
    n.includes("tax")
  ) {
    return "SETTINGS_FINANCE";
  }

  if (
    n.includes("general setting") ||
    n.includes("company name") ||
    n.includes("organization name") ||
    n.includes("legal name") ||
    n.includes("company profile") ||
    (n.includes("organization") && n.includes("setting"))
  ) {
    return "SETTINGS_GENERAL";
  }

  if (
    n.includes("settings") ||
    n.includes("settings overview") ||
    n.includes("brand settings")
  ) {
    return "SETTINGS_OVERVIEW";
  }

  return null;
}

export function detectBrandSettingsWrite(
  userText: string,
): DetectedWriteIntent | null {
  const n = userText.toLowerCase().trim();

  if (
    /\b(link|add|update|set)\b/.test(n) &&
    (n.includes("withdrawal") ||
      n.includes("bank account") ||
      n.includes("ifsc"))
  ) {
    return {
      kind: "SETTINGS_LINK_WITHDRAWAL",
      stagedPayload: {},
      missingSlots: [
        textSlot("beneficiaryName", "Account holder name", "e.g. Acme Pvt Ltd"),
        textSlot("bankName", "Bank name", "e.g. HDFC Bank"),
        textSlot("accountNumber", "Account number", "Digits only"),
        textSlot(
          "confirmAccountNumber",
          "Confirm account number",
          "Re-enter account number",
        ),
        textSlot("ifscCode", "IFSC code", "e.g. HDFC0001234"),
      ],
    };
  }

  if (
    (/\b(update|set|change|save)\b/.test(n) &&
      (/\bgst(in)?\b/.test(n) ||
        /\bpan\b/.test(n) ||
        n.includes("billing profile") ||
        n.includes("billing address") ||
        n.includes("registered company"))) ||
    n.includes("update gst") ||
    n.includes("update pan")
  ) {
    const missingSlots: SlotFillingData["missingSlots"] = [
      textSlot(
        "registeredCompanyName",
        "Registered company name",
        "Legal company name on invoices",
      ),
      textSlot(
        "corporateBillingAddress",
        "Corporate billing address",
        "Full address (min 10 characters)",
      ),
    ];
    if (/\bgst(in)?\b/.test(n) || n.includes("billing")) {
      missingSlots.push(
        textSlot("gstin", "GSTIN (optional)", "15-character GSTIN or blank"),
      );
    }
    if (/\bpan\b/.test(n) || n.includes("billing")) {
      missingSlots.push(
        textSlot("pan", "PAN (optional)", "10-character PAN or blank"),
      );
    }
    return {
      kind: "SETTINGS_UPDATE_BILLING",
      stagedPayload: {
        defaultTdsPercentage: 2,
        currencyPreference: "INR",
      },
      missingSlots,
    };
  }

  if (
    (/\b(update|set|change|rename)\b/.test(n) &&
      (n.includes("company name") ||
        n.includes("organization name") ||
        n.includes("legal name") ||
        n.includes("country") ||
        n.includes("currency"))) ||
    n.includes("update general settings")
  ) {
    const missingSlots: SlotFillingData["missingSlots"] = [];
    if (
      n.includes("company") ||
      n.includes("organization") ||
      n.includes("legal name") ||
      n.includes("general")
    ) {
      missingSlots.push(
        textSlot(
          "organizationLegalName",
          "Organization legal name",
          "Company legal name",
        ),
      );
    }
    if (n.includes("country")) {
      missingSlots.push(
        textSlot("countryCode", "Country code", "e.g. IN"),
      );
    }
    if (n.includes("currency")) {
      missingSlots.push(
        textSlot("currencyCode", "Currency code", "e.g. INR"),
      );
    }
    if (missingSlots.length === 0) {
      missingSlots.push(
        textSlot(
          "organizationLegalName",
          "Organization legal name",
          "Company legal name",
        ),
      );
    }
    return {
      kind: "SETTINGS_UPDATE_GENERAL",
      stagedPayload: {},
      missingSlots,
    };
  }

  return null;
}
