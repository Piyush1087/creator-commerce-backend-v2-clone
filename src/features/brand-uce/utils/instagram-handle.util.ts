export function normalizeInstagramHandle(handle: string): string {
  const trimmed = handle.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}
