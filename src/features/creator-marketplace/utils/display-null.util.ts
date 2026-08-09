/** API serializers use null for missing values; UI maps null/empty to "-". */
export function nullIfEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
