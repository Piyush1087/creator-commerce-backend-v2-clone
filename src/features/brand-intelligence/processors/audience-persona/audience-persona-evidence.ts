import type { EvidenceManifestEntry } from "../../contracts/validation/validation.types";

const CAPABILITIES = new Set([
  "owned_website.brand_messaging",
  "owned_website.brand_company_context",
  "owned_website.offering_context",
]);
export const audienceRecord = (
  value: unknown,
): Readonly<Record<string, unknown>> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};

/** Conservative first-party Audience signal admission, NOT Persona identity matching.
 * No capability, page count, coverage percentage, or collection-size minimum.
 * Reasoning still must justify each Persona; qualifying Evidence may yield zero.
 */
export function supportsAudience(entry: EvidenceManifestEntry): boolean {
  if (
    !CAPABILITIES.has(entry.capabilityId) ||
    !["PERSISTENT_BRAND_LEVEL", "REPEATED_REPRESENTATIVE"].includes(
      entry.representativeness ?? "",
    ) ||
    entry.polarity === "EXPLICIT_NEGATIVE"
  )
    return false;
  const payload = audienceRecord(entry.normalizedPayload);
  const text = String(
    payload.statement_text ??
      payload.text_or_normalized_message ??
      payload.observed_context ??
      "",
  );
  if (
    !text.trim() ||
    /\b(campaign|limited.time|this week|everyone|everybody|all people)\b/iu.test(
      text,
    )
  )
    return false;
  if (
    entry.capabilityId === "owned_website.offering_context" &&
    payload.generalization_scope !== "MULTIPLE_OFFERINGS" &&
    entry.representativeness !== "REPEATED_REPRESENTATIVE"
  )
    return false;
  // Existing DE normalized text is the input, not new DE annotations or a new capability.
  const explicitAudience =
    /\b(?:built|designed|made|platform|services?|solutions?|plans?|tools?) for\s+\S/iu.test(
      text,
    ) ||
    /\b(?:we help|we serve|our customers? (?:are|need)|our clients? (?:are|need))\s+\S/iu.test(
      text,
    );
  // The frozen contract also admits repeated customer need/use/decision context;
  // it does not require an explicit "designed for" statement in every execution.
  const repeatedContext =
    entry.representativeness === "REPEATED_REPRESENTATIVE" &&
    /\b(customers?|clients?|teams?|businesses?|operators?|founders?|creators?)\b/iu.test(
      text,
    ) &&
    /\b(need|struggle|seek|rely on|trust|concerns?|barriers?|prefer|use|workflows?)\b/iu.test(
      text,
    );
  return explicitAudience || repeatedContext;
}
