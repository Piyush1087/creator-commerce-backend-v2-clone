import path from "node:path";

import { Injectable } from "@nestjs/common";

import { SafeYamlLoader } from "../../../../intelligence/runtime/loaders/safe-yaml.loader";
import { ModelRegistryResolver } from "../../../../intelligence/runtime/models/model-registry.resolver";
import type { VersionedArtifact } from "../../../../intelligence/runtime/prompt-builder/intelligence-prompt.builder";
import type { CanonicalArchetype } from "../../../../intelligence/runtime/validation/brand-preview.validation";

export type BrandPreviewExecutionProfileArtifact = {
  id: string;
  version: string;
  status: string;
  stages: Array<{ id: string; processor_id?: string }>;
};

function versioned(
  id: string,
  content: Record<string, unknown>,
): VersionedArtifact {
  return { id, version: String(content.version ?? "unknown"), content };
}

@Injectable()
export class BrandPreviewArtifactLoader {
  private readonly local = new SafeYamlLoader(
    path.join(__dirname, "artifacts"),
  );
  private readonly shared = new SafeYamlLoader(
    path.join(__dirname, "../../gatekeeper/runtime/artifacts"),
  );

  loadExecutionProfile() {
    return this.local.load<BrandPreviewExecutionProfileArtifact>(
      "brand_preview_fast.yaml",
    );
  }

  loadMinimumOutputContract() {
    return this.local.load<Record<string, unknown>>(
      "brand_preview_minimum_output_contract.yaml",
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
      this.shared.load<Record<string, unknown>>("global/runtime_context.yaml"),
      this.shared.load<Record<string, unknown>>(
        "global/evidence_grounding.yaml",
      ),
      this.shared.load<Record<string, unknown>>(
        "global/output_discipline.yaml",
      ),
      this.local.load<Record<string, unknown>>(
        "brand_preview_synthesis/processor.yaml",
      ),
      this.local.load<Record<string, unknown>>(
        "brand_preview_synthesis/reasoning.yaml",
      ),
      this.local.load<Record<string, unknown>>(
        "brand_preview_archetype_reasoning.yaml",
      ),
      this.local.load<Record<string, unknown>>("creator_archetypes.yaml"),
      this.local.load<Record<string, unknown>>(
        "brand_preview_synthesis/output_contract.yaml",
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
      processor: versioned("brand_preview_synthesis", processor),
      reasoning: versioned("brand_preview_synthesis_reasoning", reasoning),
      rules: versioned("brand_preview_archetype_reasoning", rules),
      taxonomy: versioned("creator_archetypes", taxonomy),
      outputContract: versioned(
        "brand_preview_synthesis_output_contract",
        outputContract,
      ),
    };
  }

  async loadArchetypes(): Promise<CanonicalArchetype[]> {
    const artifact = await this.local.load<{
      archetypes: Array<{ id: string; label: string; is_active: boolean }>;
    }>("creator_archetypes.yaml");
    return artifact.archetypes.map((item) => ({
      id: item.id,
      label: item.label,
      isActive: item.is_active,
    }));
  }

  private resolver(): ModelRegistryResolver {
    const environment = (process.env.NODE_ENV ?? "development") as
      | "development"
      | "test"
      | "production";
    return new ModelRegistryResolver(this.shared, environment);
  }

  resolvePrimaryModel() {
    return this.resolver().resolve("brand_preview_synthesis");
  }

  resolveFallbackModel() {
    return this.resolver().resolveTechnicalFallback("brand_preview_synthesis");
  }
}
