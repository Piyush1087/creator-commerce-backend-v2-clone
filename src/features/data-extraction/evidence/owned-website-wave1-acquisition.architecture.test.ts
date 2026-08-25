import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const productionPath = join(
  process.cwd(),
  "src/features/data-extraction/evidence/acquisition/owned-website-wave1-acquisition.service.ts",
);
const source = readFileSync(productionPath, "utf8");
const runtimePorts = readFileSync(
  join(
    process.cwd(),
    "src/features/data-extraction/evidence/ports/evidence-runtime.ports.ts",
  ),
  "utf8",
);

describe("DE-W1.0D owned-site acquisition architecture", () => {
  it("does not import Brand Intelligence, frontend, controller, resolver or Instagram", () => {
    for (const forbidden of [
      "brand-intelligence/persistence",
      "brand-intelligence/process",
      "frontend",
      "@Controller",
      "@Resolver",
      "instagram",
    ]) {
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("does not create semantic Evidence or semantic observations in production", () => {
    expect(source).not.toContain("evidenceItems.insert");
    expect(source).not.toContain("semanticObservations.createOrGet");
    expect(source).not.toContain("semanticObservations.attachSupport");
    expect(source).not.toContain("asEvidenceRef(");
    expect(source).not.toContain("asSemanticObservationKey(");
  });

  it("keeps readExisting and request as distinct command/query boundaries", () => {
    expect(runtimePorts).toContain("readExisting(");
    expect(runtimePorts).toContain("request(");
    const readSection = runtimePorts.slice(
      runtimePorts.indexOf(
        "export interface DataExtractionEvidenceQueryPortV1",
      ),
      runtimePorts.indexOf(
        "export interface DataExtractionCapabilityAcquisitionRequestV1",
      ),
    );
    expect(readSection).not.toContain("request(");
  });

  it("uses exactly the existing five Wave 1 capabilities and PUBLIC_OWNED_SITE semantics", () => {
    expect(source).toContain("WAVE1_EVIDENCE_CAPABILITIES");
    expect(source).toContain('sourceClass: "OWNED_WEBSITE"');
    expect(source).not.toMatch(/PUBLIC_WEB_SEARCH|INSTAGRAM_CONNECTED/);
  });

  it("contains no startup trigger or hidden Preview dual-write", () => {
    expect(source).not.toMatch(/onModuleInit|onApplicationBootstrap/);
    expect(source).not.toContain("BrandPreviewRun");
    expect(source).not.toContain("brandPreview");
  });
});
