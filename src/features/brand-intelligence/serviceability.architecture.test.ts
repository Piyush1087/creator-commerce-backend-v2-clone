import { describe, expect, it } from "vitest";
import {
  CONTRACT_SOURCE_SPECS,
  PROCESSOR_ARCHITECTURE_COMMITS,
} from "./contracts/bundle/contract-source.spec";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("serviceability_synthesis architecture boundaries", () => {
  it("pins the seventh executable and owns exactly the frozen 19 paths", () => {
    const spec = CONTRACT_SOURCE_SPECS.find(
      (candidate) => candidate.processorId === "serviceability_synthesis",
    )!;
    expect(PROCESSOR_ARCHITECTURE_COMMITS.serviceability_synthesis).toBe(
      "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
    );
    expect(spec.ownedObjectSemanticIds).toEqual(["serviceability_profile"]);
    expect(spec.ownedPathPatterns).toHaveLength(19);
  });
  it("does not add Offering availability persistence or reinterpret legacy fields", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    expect(schema).not.toContain("model OfferingAvailability");
    const source = readFileSync(
      join(
        process.cwd(),
        "src/features/brand-intelligence/input/canonical-state/canonical-serviceability-snapshot.ts",
      ),
      "utf8",
    );
    expect(source).toContain("offeringAvailabilityReferences: []");
    expect(source).toContain("offeringLocationReferences: []");
    expect(source).not.toContain("locationIds");
    expect(source).not.toContain("marketsServed");
  });
});
