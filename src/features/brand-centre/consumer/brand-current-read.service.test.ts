import { describe, expect, it, vi } from "vitest";

import type { CanonicalBrandStateReader } from "../../brand-intelligence/input/canonical-state/canonical-brand-state.port";
import { BrandCurrentReadService } from "./brand-current-read.service";

describe("BrandCurrentReadService", () => {
  it("projects only canonical application state and excludes candidateValue", async () => {
    const read = vi.fn().mockResolvedValue({
      brandId: "brand-1",
      lifecycleMode: "POST_PROFILE",
      observedAt: new Date(0).toISOString(),
      canonicalSnapshotRef: "canonical:brand-1",
      entries: [
        {
          semantic: "brand_name",
          value: "Current Brand",
          candidateValue: "Unverified Candidate",
          source: "BRAND_PROFILE",
          authority: "BRAND_CONFIRMED",
          fallbackUsed: false,
          conflictDetected: true,
          provenanceStatus: "PROVEN",
          resolutionStatus: "RESOLVED",
          businessStateReference: {},
        },
      ],
    });
    const result = await new BrandCurrentReadService({
      read,
    } as unknown as CanonicalBrandStateReader).read("brand-1");
    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({ brandId: "brand-1" }),
    );
    expect(result.fields[0]).toEqual({
      semantic: "brand_name",
      value: "Current Brand",
      authority: "BRAND_CONFIRMED",
      provenanceStatus: "PROVEN",
      resolutionStatus: "RESOLVED",
      fallbackUsed: false,
      conflictDetected: true,
    });
    expect(result.fields[0]).not.toHaveProperty("candidateValue");
  });
});
