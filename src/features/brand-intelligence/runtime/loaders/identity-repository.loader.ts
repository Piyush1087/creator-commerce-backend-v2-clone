import { RuntimeConfigError, SafeYamlLoader } from "./yaml_loader";
import type { ExecutionProfile } from "../compiler/compiler";

const ROOT = "engines/brand_intelligence/branches/identity";

const PROCESSORS: Record<string, string> = {
  industry_classification: `${ROOT}/processors/industry_classification.yaml`,
  identity_core: `${ROOT}/processors/identity_core.yaml`,
  market_geography: `${ROOT}/processors/market_geography.yaml`,
};

const ARTIFACT_DIR: Record<string, string> = {
  industry_classification: `${ROOT}/artifacts/industry_classification`,
  identity_core: `${ROOT}/artifacts/identity_core`,
  market_geography: `${ROOT}/artifacts/market_geography`,
};

function versioned(id: string, raw: unknown) {
  const record = raw as { version?: string } | null;
  return { id, version: record?.version ?? "frozen", content: raw };
}

export class IdentityRepositoryLoader {
  constructor(private readonly yaml: SafeYamlLoader) {}

  async loadExecutionProfile(profileId: string): Promise<ExecutionProfile> {
    if (profileId !== "identity_test") {
      throw new RuntimeConfigError(
        "PROFILE_NOT_ALLOWED",
        `Unknown Identity profile '${profileId}'`,
      );
    }
    const raw = (await this.yaml.load(
      `execution_profiles/${profileId}.yaml`,
    )) as {
      id: string;
      defaults?: { persist_results?: boolean };
      tasks?: Array<{
        id: string;
        processor_id: string;
        processor_scope?: string;
        kind: "AI" | "DETERMINISTIC";
        active_outputs?: string[];
        dependencies?: string[];
        canonical_dependencies?: string[];
        required?: boolean;
      }>;
    };

    return {
      id: raw.id,
      persistResultsDefault: raw.defaults?.persist_results ?? false,
      tasks: (raw.tasks ?? []).map((t) => ({
        id: t.id,
        processorId: t.processor_id,
        processorScope: t.processor_scope,
        kind: t.kind,
        activeOutputs: t.active_outputs ?? [],
        dependsOn: t.dependencies ?? [],
        canonicalDependencies: t.canonical_dependencies ?? [],
        required: t.required !== false,
      })),
    };
  }

  async loadProcessor(processorId: string, scope?: string) {
    const file = PROCESSORS[processorId];
    if (!file) {
      throw new RuntimeConfigError(
        "PROCESSOR_NOT_CONFIGURED",
        `Unknown processor '${processorId}'`,
      );
    }
    const definition = (await this.yaml.load(file)) as Record<string, unknown> & {
      id: string;
      purpose?: unknown;
      inputs?: unknown;
      outputs?: string[];
    };
    return {
      ...definition,
      processor_id: definition.id,
      processor_scope: scope,
      purpose: definition.purpose,
      input_contract: definition.inputs,
      output_ownership: definition.outputs,
    };
  }

  async loadObjects(activeOutputs: string[]) {
    const registry = (await this.yaml.load(`${ROOT}/objects.yaml`)) as {
      version?: string;
      objects?: Array<Record<string, unknown> & { id?: string; object_id?: string; producer?: string | null }>;
      intelligence_objects?: Array<Record<string, unknown> & { id?: string; object_id?: string; producer?: string | null }>;
    };
    const rows = registry.objects ?? registry.intelligence_objects ?? [];
    const byId = new Map(
      rows.map((row) => [row.id ?? row.object_id, row] as const),
    );
    return activeOutputs.map((id) => {
      const row = byId.get(id);
      if (!row) {
        throw new RuntimeConfigError(
          "OBJECT_DEFINITION_MISSING",
          `Identity Object '${id}' not found`,
        );
      }
      return {
        id,
        version: registry.version,
        producer: row.producer ?? null,
        definition: row,
      };
    });
  }

  async loadGlobalArtifacts() {
    const base = "artifacts/global";
    const runtime_context = await this.yaml.load(`${base}/runtime_context.yaml`);
    const evidence_grounding = await this.yaml.load(
      `${base}/evidence_grounding.yaml`,
    );
    const output_discipline = await this.yaml.load(
      `${base}/output_discipline.yaml`,
    );
    return {
      runtime_context: versioned("global.runtime_context", runtime_context),
      evidence_grounding: versioned(
        "global.evidence_grounding",
        evidence_grounding,
      ),
      output_discipline: versioned(
        "global.output_discipline",
        output_discipline,
      ),
    };
  }

  async loadProcessorArtifacts(processorId: string, scope?: string) {
    const dir = ARTIFACT_DIR[processorId];
    if (!dir) {
      throw new RuntimeConfigError(
        "ARTIFACT_PROCESSOR_NOT_CONFIGURED",
        `No artifact directory for '${processorId}'`,
      );
    }

    const reasoningCandidates = scope
      ? [`${dir}/${scope}/reasoning.yaml`, `${dir}/reasoning.yaml`]
      : [`${dir}/reasoning.yaml`];

    let reasoning: unknown;
    let lastError: unknown;
    for (const candidate of reasoningCandidates) {
      try {
        reasoning = await this.yaml.load(candidate);
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!reasoning) {
      throw (
        lastError ??
        new RuntimeConfigError(
          "ARTIFACT_MISSING",
          `Reasoning artifact missing for ${processorId}`,
        )
      );
    }

    const output_contract = await this.yaml.load(`${dir}/output_contract.yaml`);
    const artifacts: {
      reasoning: ReturnType<typeof versioned>;
      output_contract: ReturnType<typeof versioned>;
      taxonomy?: ReturnType<typeof versioned>;
    } = {
      reasoning: versioned(
        `${processorId}${scope ? `.${scope}` : ""}.reasoning`,
        reasoning,
      ),
      output_contract: versioned(
        `${processorId}.output_contract`,
        output_contract,
      ),
    };

    if (processorId === "industry_classification") {
      const taxonomy = await this.yaml.load(`${dir}/taxonomy.yaml`);
      artifacts.taxonomy = versioned(
        `${processorId}.taxonomy`,
        taxonomy,
      );
    }

    return artifacts;
  }
}
