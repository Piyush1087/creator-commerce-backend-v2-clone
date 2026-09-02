const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const BANNED_PUBLIC_EMAIL_PROVIDERS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "mail.com",
  "proton.me",
  "protonmail.com",
] as const;

export function isBannedPublicEmailProvider(email: string): boolean {
  const domain = emailDomainFromAddress(email);
  return (BANNED_PUBLIC_EMAIL_PROVIDERS as readonly string[]).includes(domain);
}

export function normalizeVerificationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidVerificationEmail(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeVerificationEmail(email));
}

export function emailLocalPart(email: string): string {
  const normalized = normalizeVerificationEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) {
    return "there";
  }
  return normalized.slice(0, at);
}

export function emailDomainFromAddress(email: string): string {
  const normalized = normalizeVerificationEmail(email);
  const at = normalized.indexOf("@");
  if (at < 0) {
    return "";
  }
  return normalized.slice(at + 1).replace(/^www\./, "");
}

export function normalizeBrandDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

export function isSafeBrandDomainAuthority(domain: string): boolean {
  const normalized = normalizeBrandDomain(domain);
  if (!normalized || normalized.length > 253 || !normalized.includes(".")) {
    return false;
  }
  return normalized
    .split(".")
    .every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    );
}

export function emailDomainMatchesBrandDomain(
  email: string,
  brandDomain: string,
): boolean {
  const emailHost = emailDomainFromAddress(email);
  const site = normalizeBrandDomain(brandDomain);
  if (!emailHost || !site) {
    return false;
  }
  return (
    emailHost === site ||
    emailHost.endsWith(`.${site}`) ||
    site.endsWith(`.${emailHost}`)
  );
}

export function verificationCodeIdentifier(
  brandProfileId: string,
  email: string,
): string {
  return `${brandProfileId}:${normalizeVerificationEmail(email)}`;
}
