/**
 * Mask workspace admin emails in anonymous discovery responses.
 * e.g. admin@brand.com → a***@brand.com
 */
export function maskAdminEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) {
    return "***";
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}
