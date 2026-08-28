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

function titleCaseToken(raw: string): string {
  const cleaned = raw.replace(/[.,!?;:]+$/g, "").trim();
  if (!cleaned) {
    return cleaned;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Personal profile (first/last name, account email read) — not org/company. */
export function isPersonalProfileAsk(normalizedText: string): boolean {
  const n = normalizedText.toLowerCase();
  return (
    n.includes("first name") ||
    n.includes("last name") ||
    n.includes("personal profile") ||
    n.includes("personal name") ||
    n.includes("account email") ||
    n.includes("user name") ||
    n.includes("my name") ||
    n.includes("brand owner name") ||
    n.includes("who is the brand owner") ||
    n.includes("who is brand owner") ||
    n.includes("who is brand_owner") ||
    (n.includes("owner") &&
      (n.includes("name") || n.includes("who is")) &&
      !n.includes("company"))
  );
}

/** Explicitly blocked identity mutations (email / password). */
export function isDeniedIdentityMutationAsk(normalizedText: string): boolean {
  const n = normalizedText.toLowerCase();
  const mutates = /\b(update|change|set|rename|reset|modify)\b/.test(n);
  if (!mutates) {
    return false;
  }
  return (
    n.includes("password") ||
    n.includes("email address") ||
    (n.includes("email") &&
      !n.includes("billing email") &&
      !n.includes("contact email"))
  );
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
    isPersonalProfileAsk(n) ||
    isDeniedIdentityMutationAsk(n) ||
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

  // Email/password change attempts → general read with refusal narrative
  if (isDeniedIdentityMutationAsk(n)) {
    return "SETTINGS_GENERAL";
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
    isPersonalProfileAsk(n) ||
    n.includes("general setting") ||
    n.includes("company name") ||
    n.includes("organization name") ||
    n.includes("legal name") ||
    n.includes("company profile") ||
    (n.includes("organization") && n.includes("setting")) ||
    (n.includes("general") &&
      (n.includes("within") || n.includes("in ") || n.includes("setting")))
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

  // Never stage HITL for email / password changes
  if (isDeniedIdentityMutationAsk(n)) {
    return null;
  }

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

  // Personal profile: first name / last name only (not email or password)
  const wantsPersonalName =
    /\b(update|set|change|rename)\b/.test(n) &&
    (n.includes("first name") ||
      n.includes("last name") ||
      n.includes("my name") ||
      n.includes("personal name") ||
      n.includes("personal profile") ||
      (n.includes("user name") && !n.includes("company")));

  if (wantsPersonalName) {
    const stagedPayload: Record<string, unknown> = {
      personal_profile_only: true,
    };
    const missingSlots: SlotFillingData["missingSlots"] = [];
    const wantsFirst =
      n.includes("first name") ||
      n.includes("my name") ||
      n.includes("personal name") ||
      n.includes("personal profile") ||
      n.includes("user name") ||
      (!n.includes("last name") && n.includes("name"));
    const wantsLast = n.includes("last name");

    const fromTo = n.match(/\bfrom\s+(\S+)\s+to\s+(\S+)/i);
    const toOnly = n.match(
      /\b(?:to|as)\s+([a-z][a-z'-]{0,40})(?:\s|$)/i,
    );

    if (wantsFirst) {
      const nextFirst = fromTo
        ? titleCaseToken(fromTo[2])
        : toOnly && !n.includes("last name")
          ? titleCaseToken(toOnly[1])
          : undefined;
      if (nextFirst) {
        stagedPayload.firstName = nextFirst;
      } else {
        missingSlots.push(
          textSlot("firstName", "First name", "e.g. Brian"),
        );
      }
    }

    if (wantsLast) {
      const nextLast = fromTo
        ? titleCaseToken(fromTo[2])
        : toOnly
          ? titleCaseToken(toOnly[1])
          : undefined;
      if (nextLast && n.includes("last name")) {
        stagedPayload.lastName = nextLast;
      } else if (!stagedPayload.lastName) {
        missingSlots.push(textSlot("lastName", "Last name", "e.g. Silva"));
      }
    }

    // "update my name from Amar to Brian" → first name only
    if (
      !wantsLast &&
      wantsFirst &&
      !stagedPayload.firstName &&
      missingSlots.every((s) => s.fieldName !== "firstName")
    ) {
      missingSlots.push(textSlot("firstName", "First name", "e.g. Brian"));
    }

    return {
      kind: "SETTINGS_UPDATE_GENERAL",
      stagedPayload,
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
          "Organization name",
          "Workspace or organization name",
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
          "Organization name",
          "Workspace or organization name",
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
