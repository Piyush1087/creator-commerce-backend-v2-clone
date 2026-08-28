import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DATA_EXTRACTION_EVIDENCE_CAPABILITIES,
  OFFERING_COMMERCIAL_EVIDENCE_CAPABILITIES,
  WAVE1_EVIDENCE_CAPABILITIES,
  WAVE2_EVIDENCE_CAPABILITIES,
} from "../../domain/evidence-vocabulary";
import { NORMALIZED_EVIDENCE_CAPABILITIES } from "../../../../brand-intelligence/input/evidence/intelligence-evidence.port";
import { ownedSiteObservationFragmentSchema } from "../../acquisition/owned-site-observation-fragment";
import { WAVE2_NORMALIZERS } from "./wave2-normalizers";

describe("DE-W2 bounded contracts and ownership", () => {
  it("preserves Wave 1/Wave 2 and adds one bounded commercial capability", () => {
    expect(WAVE1_EVIDENCE_CAPABILITIES).toHaveLength(5);
    expect(WAVE2_EVIDENCE_CAPABILITIES).toEqual([
      "explicit_factual_proof_or_claim_evidence",
      "owned_website.visual_evidence",
      "owned_website.serviceability_evidence",
      "owned_website.location_evidence",
    ]);
    expect(DATA_EXTRACTION_EVIDENCE_CAPABILITIES).toEqual(
      NORMALIZED_EVIDENCE_CAPABILITIES,
    );
    expect(OFFERING_COMMERCIAL_EVIDENCE_CAPABILITIES).toEqual([
      "owned_website.offering_commercial_evidence",
    ]);
    expect(WAVE2_NORMALIZERS.map((n) => n.capabilityId)).toEqual([
      ...WAVE2_EVIDENCE_CAPABILITIES,
      ...OFFERING_COMMERCIAL_EVIDENCE_CAPABILITIES,
    ]);
  });
  it("rejects external canonical references in retained source descriptors", () => {
    expect(
      ownedSiteObservationFragmentSchema.safeParse({
        version: "owned-site-observations/1.0",
        statements: [],
        visuals: [],
        locations: [],
        commercials: [],
        limitations: [],
        canonical_location_ref: "untrusted",
      }).success,
    ).toBe(false);
  });
  it("contains no network call, canonical mutation, processor execution or new media provider in normalizers", () => {
    const root = join(
      process.cwd(),
      "src/features/data-extraction/evidence/normalization/wave2",
    );
    const source = readdirSync(root)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => readFileSync(join(root, file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(
      /fetch\(|axios|\.create\(|\.update\(|\.delete\(|playwright|zyte|brand-preview|\.execute\(/i,
    );
  });
});
