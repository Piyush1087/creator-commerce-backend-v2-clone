export function normalizeInstagramHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}
