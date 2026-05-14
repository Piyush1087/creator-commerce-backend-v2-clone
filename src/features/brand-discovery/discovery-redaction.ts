/**
 * Redacts URLs before they appear in logs or metrics to reduce accidental
 * leakage of full marketing URLs and query strings.
 */
export function redactUrlForLogs(raw: string): string {
  const trimmed = raw.trim().slice(0, 256);
  if (!trimmed) {
    return "[empty]";
  }
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const u = new URL(withProtocol);
    const host = u.hostname.toLowerCase();
    const segments = host.split(".");
    const redactedHost =
      segments.length <= 2
        ? host
        : `${segments[0].slice(0, 2)}***.${segments.slice(-2).join(".")}`;
    const path =
      u.pathname && u.pathname !== "/" ? u.pathname.slice(0, 48) : "";
    return `${u.protocol}//${redactedHost}${path}`;
  } catch {
    return "[unparseable]";
  }
}
