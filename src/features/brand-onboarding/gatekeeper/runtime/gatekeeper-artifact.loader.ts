import path from "node:path";

import { Injectable } from "@nestjs/common";

import { SafeYamlLoader } from "../../../../intelligence/runtime/loaders/safe-yaml.loader";
import { ModelRegistryResolver } from "../../../../intelligence/runtime/models/model-registry.resolver";
import type { VersionedArtifact } from "../../../../intelligence/runtime/prompt-builder/intelligence-prompt.builder";

export type GatekeeperExecutionProfileArtifact = {
  id: string;
  version: string;
  stages: Array<{
    id: string;
    processor_id?: string;
    requested_capability?: string;
    model_profile?: { model?: string; provider?: string };
  }>;
};

function versioned(
  id: string,
  raw: Record<string, unknown>,
): VersionedArtifact {
  return {
    id,
    version: typeof raw.version === "string" ? raw.version : "unknown",
    content: raw,
  };
}

@Injectable()
export class GatekeeperArtifactLoader {
  private readonly yaml = new SafeYamlLoader(path.join(__dirname, "artifacts"));

  loadExecutionProfile(): Promise<GatekeeperExecutionProfileArtifact> {
    return this.yaml.load<GatekeeperExecutionProfileArtifact>(
      "gatekeeper_scan.yaml",
    );
  }

  async loadPromptArtifacts() {
    const [
      runtimeContext,
      evidenceGrounding,
      outputDiscipline,
      processor,
      reasoning,
      rules,
      taxonomy,
      outputContract,
    ] = await Promise.all([
      this.yaml.load<Record<string, unknown>>("global/runtime_context.yaml"),
      this.yaml.load<Record<string, unknown>>("global/evidence_grounding.yaml"),
      this.yaml.load<Record<string, unknown>>("global/output_discipline.yaml"),
      this.yaml.load<Record<string, unknown>>(
        "gatekeeper_site_assessment/processor.yaml",
      ),
      this.yaml.load<Record<string, unknown>>(
        "gatekeeper_site_assessment/reasoning.yaml",
      ),
      this.yaml.load<Record<string, unknown>>(
        "gatekeeper_site_assessment/rules.yaml",
      ),
      this.yaml.load<Record<string, unknown>>("taxonomy_contract.yaml"),
      this.yaml.load<Record<string, unknown>>(
        "gatekeeper_site_assessment/output_contract.yaml",
      ),
    ]);

    return {
      globalArtifacts: {
        runtimeContext: versioned("global_runtime_context", runtimeContext),
        evidenceGrounding: versioned(
          "global_evidence_grounding",
          evidenceGrounding,
        ),
        outputDiscipline: versioned(
          "global_output_discipline",
          outputDiscipline,
        ),
      },
      processor: versioned("gatekeeper_site_assessment", processor),
      reasoning: versioned("gatekeeper_site_assessment_reasoning", reasoning),
      rules: versioned("gatekeeper_site_assessment_rules", rules),
      taxonomy: versioned("admission_industry_taxonomy", taxonomy),
      outputContract: versioned(
        "gatekeeper_site_assessment_output_contract",
        outputContract,
      ),
    };
  }

  resolvePrimaryModel(environment: "development" | "test" | "production") {
    return new ModelRegistryResolver(this.yaml, environment).resolve(
      "gatekeeper_site_assessment",
    );
  }
}
