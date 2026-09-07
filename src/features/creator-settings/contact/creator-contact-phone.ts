export type NormalizedCreatorContactPhone = {
  countryCallingCode: string;
  nationalNumber: string;
  e164: string;
};

const SEPARATOR_PATTERN = /[\s().-]/g;

/**
 * Normalizes an explicit calling-code/national-number pair without guessing a
 * country from legacy text. Full country-specific validation belongs at a
 * dedicated phone provider boundary; this enforces the E.164 storage shape.
 */
export function normalizeCreatorContactPhone(
  callingCodeInput: string | null | undefined,
  nationalNumberInput: string | null | undefined,
): NormalizedCreatorContactPhone | null {
  const callingCode = callingCodeInput?.trim() || null;
  const nationalNumber = nationalNumberInput?.trim() || null;

  if (!callingCode && !nationalNumber) {
    return null;
  }
  if (!callingCode || !nationalNumber) {
    throw new Error(
      "Phone country calling code and national number must be supplied together.",
    );
  }
  if (!/^\+?[0-9\s.-]+$/.test(callingCode)) {
    throw new Error("Phone country calling code contains invalid characters.");
  }
  if (!/^[0-9\s().-]+$/.test(nationalNumber)) {
    throw new Error("Phone national number contains invalid characters.");
  }

  const callingDigits = callingCode
    .replace(/^\+/, "")
    .replace(SEPARATOR_PATTERN, "");
  const nationalDigits = nationalNumber.replace(SEPARATOR_PATTERN, "");

  if (!/^[1-9][0-9]{0,2}$/.test(callingDigits)) {
    throw new Error("Phone country calling code must contain 1 to 3 digits.");
  }
  if (!/^[0-9]{4,14}$/.test(nationalDigits)) {
    throw new Error("Phone national number must contain 4 to 14 digits.");
  }
  if (callingDigits.length + nationalDigits.length > 15) {
    throw new Error("Phone number exceeds the E.164 maximum of 15 digits.");
  }

  return {
    countryCallingCode: `+${callingDigits}`,
    nationalNumber: nationalDigits,
    e164: `+${callingDigits}${nationalDigits}`,
  };
}
