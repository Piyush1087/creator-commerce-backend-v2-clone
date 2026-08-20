import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GatekeeperArtifactLoader } from "./runtime/gatekeeper-artifact.loader";
import { GatekeeperPromptService } from "./runtime/gatekeeper-prompt.service";

describe("Gatekeeper canonical runtime bindings", () => {
  const loader = new GatekeeperArtifactLoader();
  const prompts = new GatekeeperPromptService(loader);

  it("loads the canonical processor and execution profile artifacts", async () => {
    const [profile, artifacts] = await Promise.all([
      loader.loadExecutionProfile(),
      loader.loadPromptArtifacts(),
    ]);

    expect(profile.id).toBe("gatekeeper_scan");
    expect(artifacts.processor.id).toBe("gatekeeper_site_assessment");
    expect(artifacts.reasoning.id).toBe("gatekeeper_site_assessment_reasoning");
    expect(artifacts.rules.id).toBe("gatekeeper_site_assessment_rules");
    expect(artifacts.taxonomy.id).toBe("admission_industry_taxonomy");
    expect(artifacts.outputContract.id).toBe(
      "gatekeeper_site_assessment_output_contract",
    );
  });

  it("composes processor, reasoning, rules, taxonomy, evidence and output contract", async () => {
    const prompt = await prompts.build({
      executionId: "execution-test",
      stage: "primary",
      normalizedUrl: "https://example.com/",
      normalizedDomain: "example.com",
      evidence: { source: "normalized-test-evidence" },
      evidenceRefs: ["evidence-1"],
    });

    expect(prompt.instruction).toContain("gatekeeper_site_assessment");
    expect(prompt.instruction).toContain("assessment_tasks");
    expect(prompt.instruction).toContain("semantic_validation");
    expect(prompt.instruction).toContain("industry_vertical_values");
    expect(prompt.instruction).toContain("normalized-test-evidence");
    expect(prompt.instruction).toContain("additional_properties");
    expect(Object.keys(prompt.artifactVersions)).toEqual(
      expect.arrayContaining([
        "global_runtime_context",
        "global_evidence_grounding",
        "global_output_discipline",
        "gatekeeper_site_assessment",
        "gatekeeper_site_assessment_reasoning",
        "gatekeeper_site_assessment_rules",
        "admission_industry_taxonomy",
        "gatekeeper_site_assessment_output_contract",
      ]),
    );
  });

  it("resolves the frozen Gatekeeper primary model to gemini-2.5-flash", async () => {
    await expect(loader.resolvePrimaryModel("test")).resolves.toMatchObject({
      model_profile: "gatekeeper_v1_primary",
      model_alias: "gemini_gatekeeper_v1",
      provider: "google_gemini",
      model_id: "gemini-2.5-flash",
    });
  });

  it("keeps the hand-written prompt explicitly legacy", async () => {
    const source = await readFile(
      path.resolve(__dirname, "../prompts/gatekeeper.prompt.md"),
      "utf8",
    );
    expect(source).toContain("LEGACY REFERENCE");
    expect(source).toContain("NOT GATEKEEPER V1 PRODUCTION AUTHORITY");
  });
});
