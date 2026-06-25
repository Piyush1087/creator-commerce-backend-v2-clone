const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function domainToPublicSlug(domain: string): string {
  return domain.trim().toLowerCase().replace(/\./g, "-");
}

export function publicSlugToDomain(slug: string): string {
  const decoded = decodeURIComponent(slug).trim().toLowerCase();
  if (decoded.includes(".")) {
    return decoded;
  }
  return decoded.replace(/-/g, ".");
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function buildPublicBrandPath(slug: string): string {
  return `/brand/${encodeURIComponent(slug)}`;
}
