import { createHash } from "node:crypto";

/** Deterministic non-secret identity shared by the authority producer and consumer. */
export function countryAuthorityFingerprint(binding: {
  source: "CREATOR_DECLARED" | "PAYOUT_BANK";
  sourceReference: string;
  sourceVersion: number;
  legalProfileVersion: number | null;
  country: string;
  currency: "INR" | "USD";
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "commercial-country-v0.1",
        binding.source,
        binding.sourceReference,
        binding.sourceVersion,
        binding.legalProfileVersion,
        binding.country,
        binding.currency,
      ]),
    )
    .digest("hex");
}
