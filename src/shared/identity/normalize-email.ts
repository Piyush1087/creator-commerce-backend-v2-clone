/** Canonical permanent-email normalization. Provider-specific alias rules are forbidden. */
export function normalizeEmail(value: string): string {
  return value.trim().normalize("NFC").toLowerCase();
}
