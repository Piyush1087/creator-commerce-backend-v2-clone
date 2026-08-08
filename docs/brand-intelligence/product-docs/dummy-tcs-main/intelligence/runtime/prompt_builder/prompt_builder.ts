/*
 * Intelligence Prompt Builder — reference MVP implementation.
 *
 * This module is intentionally provider-neutral. The Intelligence Compiler
 * resolves execution/model context and passes already-loaded definitions,
 * artifacts and evidence. Provider adapters translate the returned structured
 * output schema into provider-specific request configuration.
 */

export type VersionedArtifact = {
  id: string;
  version: string;
  content: unknown;
};

export type IntelligenceObjectDefinition = {
  id: string;
  version?: string;
  producer?: string | null;
  processor_scope?: string | null;
  definition: unknown;
};

export type ProcessorDefinition = {
  processor_id: string;
  version?: string;
  purpose?: unknown;
  responsibility?: unknown;
  input_contract?: unknown;
  output_ownership?: string[];
  scopes?: Record<string, { output_ownership?: string[] }>;
};

export type PromptEvidence = {
  refs?: string[];
  content: unknown;
};

export type PromptBuilderInput = {
  executionContext: {
    execution_id: string;
    processor_execution_id: string;
    entity_type: string;
    entity_id: string;
    processor_id: string;
    processor_scope?: string;
    active_outputs: string[];
    execution_reason?: string;
  };
  processorDefinition: ProcessorDefinition;
  globalArtifacts: {
    runtime_context: VersionedArtifact;
    evidence_grounding: VersionedArtifact;
    output_discipline: VersionedArtifact;
  };
  processorArtifacts: {
    reasoning: VersionedArtifact;
    output_contract: VersionedArtifact;
    taxonomy?: VersionedArtifact;
    rules?: VersionedArtifact;
  };
  intelligenceObjects: IntelligenceObjectDefinition[];
  canonicalDependencies?: Record<string, unknown>;
  requiredDependencyIds?: string[];
  evidence: PromptEvidence;
  evidenceRequired?: boolean;
  resolvedModelRuntime: {
    model_profile: string;
    access_mode: "normalized_evidence" | "website_direct";
  };
};

export type PromptPackage = {
  prompt_build_id: string;
  system_instructions: unknown[];
  task_payload: Array<{ section: string; content: unknown }>;
  structured_output_schema: unknown;
  metadata: {
    prompt_builder_version: string;
    global_artifacts: Array<{ id: string; version: string }>;
    processor_id: string;
    processor_scope?: string;
    processor_artifacts: Array<{ id: string; version: string }>;
    active_output_ids: string[];
    intelligence_object_versions: Array<{ id: string; version?: string }>;
    evidence_refs: string[];
    output_contract: { id: string; version: string };
    model_profile: string;
    access_mode: string;
  };
};

export class PromptBuildError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "PromptBuildError";
  }
}

const PROMPT_BUILDER_VERSION = "0.1-working";

function ownedOutputs(def: ProcessorDefinition, scope?: string): string[] {
  if (scope && def.scopes?.[scope]?.output_ownership) {
    return def.scopes[scope].output_ownership ?? [];
  }
  return def.output_ownership ?? [];
}

function assertPreconditions(input: PromptBuilderInput): void {
  const { executionContext, processorDefinition } = input;

  if (!executionContext.active_outputs?.length) {
    throw new PromptBuildError(
      "PROMPT_ACTIVE_OUTPUT_INVALID",
      "At least one active output is required."
    );
  }

  if (processorDefinition.processor_id !== executionContext.processor_id) {
    throw new PromptBuildError(
      "PROMPT_ACTIVE_OUTPUT_INVALID",
      "Processor definition does not match runtime processor_id."
    );
  }

  const owned = new Set(
    ownedOutputs(processorDefinition, executionContext.processor_scope)
  );
  for (const output of executionContext.active_outputs) {
    if (owned.size > 0 && !owned.has(output)) {
      throw new PromptBuildError(
        "PROMPT_ACTIVE_OUTPUT_INVALID",
        `Output '${output}' is not owned by the active processor/scope.`
      );
    }
  }

  const objectIds = new Set(input.intelligenceObjects.map((item) => item.id));
  for (const output of executionContext.active_outputs) {
    if (!objectIds.has(output)) {
      throw new PromptBuildError(
        "PROMPT_OBJECT_DEFINITION_MISSING",
        `Missing Intelligence Object definition for '${output}'.`
      );
    }
  }

  if (!input.processorArtifacts.reasoning) {
    throw new PromptBuildError(
      "PROMPT_REQUIRED_ARTIFACT_MISSING",
      "Processor reasoning artifact is required."
    );
  }

  if (!input.processorArtifacts.output_contract) {
    throw new PromptBuildError(
      "PROMPT_OUTPUT_CONTRACT_MISSING",
      "Processor output contract is required."
    );
  }

  for (const dependencyId of input.requiredDependencyIds ?? []) {
    if (
      !input.canonicalDependencies ||
      !(dependencyId in input.canonicalDependencies)
    ) {
      throw new PromptBuildError(
        "PROMPT_REQUIRED_DEPENDENCY_MISSING",
        `Missing canonical dependency '${dependencyId}'.`
      );
    }
  }

  if (
    input.resolvedModelRuntime.access_mode === "normalized_evidence" &&
    input.evidenceRequired !== false &&
    (input.evidence.content === undefined || input.evidence.content === null)
  ) {
    throw new PromptBuildError(
      "PROMPT_REQUIRED_EVIDENCE_MISSING",
      "Normalized evidence is required for this processor execution."
    );
  }
}

function filterActiveObjects(
  objects: IntelligenceObjectDefinition[],
  activeOutputs: string[]
): IntelligenceObjectDefinition[] {
  const active = new Set(activeOutputs);
  return objects.filter((object) => active.has(object.id));
}

function activeOutputSchema(
  outputContract: VersionedArtifact,
  activeOutputs: string[],
  processorScope?: string
): unknown {
  /*
   * The YAML contract remains the source specification. This function marks
   * the exact boundary where a contract loader/schema adapter should produce
   * a machine schema filtered to active outputs/scope. Until that adapter is
   * implemented, preserve the contract plus explicit filtering metadata rather
   * than silently pretending the schema has been transformed.
   */
  return {
    source_contract: outputContract.content,
    active_outputs: activeOutputs,
    processor_scope: processorScope ?? null,
  };
}

function buildId(input: PromptBuilderInput): string {
  return [
    "pb",
    input.executionContext.execution_id,
    input.executionContext.processor_execution_id,
    Date.now().toString(36),
  ].join("_");
}

export function buildPrompt(input: PromptBuilderInput): PromptPackage {
  assertPreconditions(input);

  const { executionContext, processorArtifacts } = input;
  const activeObjects = filterActiveObjects(
    input.intelligenceObjects,
    executionContext.active_outputs
  );

  const systemInstructions = [
    input.globalArtifacts.runtime_context.content,
    input.globalArtifacts.evidence_grounding.content,
    input.globalArtifacts.output_discipline.content,
  ];

  const taskPayload: PromptPackage["task_payload"] = [
    {
      section: "task",
      content: {
        processor_id: executionContext.processor_id,
        processor_scope: executionContext.processor_scope ?? null,
        entity_type: executionContext.entity_type,
        entity_id: executionContext.entity_id,
        active_outputs: executionContext.active_outputs,
        purpose:
          input.processorDefinition.purpose ??
          input.processorDefinition.responsibility ??
          null,
        input_contract: input.processorDefinition.input_contract ?? null,
      },
    },
    {
      section: "processor_reasoning",
      content: processorArtifacts.reasoning.content,
    },
  ];

  if (processorArtifacts.taxonomy || processorArtifacts.rules) {
    taskPayload.push({
      section: "taxonomy_and_processor_rules",
      content: {
        taxonomy: processorArtifacts.taxonomy?.content ?? null,
        rules: processorArtifacts.rules?.content ?? null,
      },
    });
  }

  taskPayload.push({
    section: "active_output_definitions",
    content: activeObjects.map((object) => ({
      id: object.id,
      definition: object.definition,
    })),
  });

  if (
    input.canonicalDependencies &&
    Object.keys(input.canonicalDependencies).length > 0
  ) {
    taskPayload.push({
      section: "canonical_dependencies",
      content: input.canonicalDependencies,
    });
  }

  taskPayload.push({ section: "evidence", content: input.evidence.content });

  const processorArtifactMetadata = [
    processorArtifacts.reasoning,
    processorArtifacts.output_contract,
    processorArtifacts.taxonomy,
    processorArtifacts.rules,
  ]
    .filter((artifact): artifact is VersionedArtifact => Boolean(artifact))
    .map(({ id, version }) => ({ id, version }));

  return {
    prompt_build_id: buildId(input),
    system_instructions: systemInstructions,
    task_payload: taskPayload,
    structured_output_schema: activeOutputSchema(
      processorArtifacts.output_contract,
      executionContext.active_outputs,
      executionContext.processor_scope
    ),
    metadata: {
      prompt_builder_version: PROMPT_BUILDER_VERSION,
      global_artifacts: Object.values(input.globalArtifacts).map(
        ({ id, version }) => ({ id, version })
      ),
      processor_id: executionContext.processor_id,
      processor_scope: executionContext.processor_scope,
      processor_artifacts: processorArtifactMetadata,
      active_output_ids: executionContext.active_outputs,
      intelligence_object_versions: activeObjects.map(({ id, version }) => ({
        id,
        version,
      })),
      evidence_refs: input.evidence.refs ?? [],
      output_contract: {
        id: processorArtifacts.output_contract.id,
        version: processorArtifacts.output_contract.version,
      },
      model_profile: input.resolvedModelRuntime.model_profile,
      access_mode: input.resolvedModelRuntime.access_mode,
    },
  };
}
