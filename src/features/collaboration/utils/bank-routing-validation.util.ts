const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/i;

export function isValidBankRoutingCode(code: string): boolean {
  const trimmed = code.trim();
  if (trimmed.length < 4) {
    return false;
  }
  if (/^[A-Z]{4}0/i.test(trimmed)) {
    return IFSC_PATTERN.test(trimmed);
  }
  return trimmed.length >= 6;
}
