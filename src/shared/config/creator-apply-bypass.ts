/**
 * QA allowlist: emails that bypass campaign targeting eligibility for
 * marketplace visibility (ELIGIBLE_ONLY) and apply.
 *
 * Env: CREATOR_APPLY_BYPASS_EMAILS=test@creator.com,other@example.com
 * Empty / unset → no bypass (safe default for production).
 */

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw?.trim()) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

let cachedRaw: string | undefined;
let cachedSet: Set<string> = new Set();

function allowlist(): Set<string> {
  const raw = process.env.CREATOR_APPLY_BYPASS_EMAILS;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSet = parseAllowlist(raw);
  }
  return cachedSet;
}

export function isCreatorApplyBypassEmail(
  email: string | null | undefined,
): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return allowlist().has(normalized);
}

/** Test helper / docs — do not use for auth. */
export function listCreatorApplyBypassEmails(): string[] {
  return [...allowlist()].sort();
}
