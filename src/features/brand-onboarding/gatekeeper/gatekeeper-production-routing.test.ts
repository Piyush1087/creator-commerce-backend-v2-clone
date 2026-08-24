import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GatekeeperArtifactLoader } from "./runtime/gatekeeper-artifact.loader";

async function source(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("Gatekeeper production routing isolation", () => {
  it("binds all three canonical DE capabilities from gatekeeper_scan", async () => {
    const profile = await new GatekeeperArtifactLoader().loadExecutionProfile();
    const capabilities = profile.stages
      .map((stage) => stage.requested_capability)
      .filter(Boolean);
    expect(capabilities).toEqual(
      expect.arrayContaining([
        "gatekeeper_primary_web_assessment",
        "company_public_web_research",
        "openai_structured_assessment",
      ]),
    );
  });

  it("routes production validate to Gatekeeper v1 rather than the legacy stub path", async () => {
    const controller = await source("../brand-onboarding.controller.ts");
    const validateMethod = controller.slice(
      controller.indexOf('@Post("validate")'),
      controller.indexOf('@Post(":leadId/confirm-industry")'),
    );
    expect(validateMethod).toContain("this.gatekeeperV1.validate");
    expect(validateMethod).not.toContain("brandOnboarding.validateUrl");
    expect(validateMethod).not.toContain("StubIndustryClassifier");
  });

  it("keeps IE as an adapter to exported DE providers without provider client code", async () => {
    const adapter = await source(
      "runtime/data-extraction-gatekeeper.adapter.ts",
    );
    expect(adapter).toContain("GeminiGatekeeperProvider");
    expect(adapter).toContain("ParallelCompanyResearchProvider");
    expect(adapter).toContain("OpenAIStructuredProvider");
    expect(adapter).not.toMatch(
      /new GoogleGenAI|fetch\(|PARALLEL_API_KEY|OPENAI_API_KEY/,
    );
  });

  it("does not parse Parallel search output as a Gatekeeper assessment", async () => {
    const orchestrator = await source(
      "runtime/gatekeeper-runtime-orchestrator.service.ts",
    );
    const parallelSection = orchestrator.slice(
      orchestrator.indexOf("private async runParallelResearch"),
      orchestrator.indexOf("private async runOpenAi"),
    );
    expect(parallelSection).not.toContain(
      "GatekeeperSiteAssessmentSchema.parse",
    );
    expect(orchestrator).toContain("canonical_reassessment");
  });
});
