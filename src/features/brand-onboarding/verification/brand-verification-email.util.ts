const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export function emailDomainMatchesBrandDomain(
  email: string,
  brandDomain: string,
): boolean {
  const emailHost = emailDomainFromAddress(email);
  const site = brandDomain
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
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
