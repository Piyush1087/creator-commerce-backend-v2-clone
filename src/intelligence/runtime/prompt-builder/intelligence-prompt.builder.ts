import { createHash, randomUUID } from "node:crypto";

export type VersionedArtifact = {
  id: string;
  version: string;
  content: unknown;
};

export type IntelligencePromptInput = {
  processor: VersionedArtifact;
  globalArtifacts: {
    runtimeContext: VersionedArtifact;
    evidenceGrounding: VersionedArtifact;
    outputDiscipline: VersionedArtifact;
  };
  reasoning: VersionedArtifact;
  rules: VersionedArtifact;
  taxonomy: VersionedArtifact;
  outputContract: VersionedArtifact;
  evidence: unknown;
  evidenceRefs: string[];
  executionContext: Record<string, unknown>;
};

export type IntelligencePromptPackage = {
  promptBuildId: string;
  instruction: string;
  outputContract: unknown;
  artifactVersions: Record<string, string>;
  evidenceRefs: string[];
};

/** Provider-neutral composition matching the shared Identity-era Prompt Builder. */
export function buildIntelligencePrompt(
  input: IntelligencePromptInput,
): IntelligencePromptPackage {
  const artifacts = [
    input.globalArtifacts.runtimeContext,
    input.globalArtifacts.evidenceGrounding,
    input.globalArtifacts.outputDiscipline,
    input.processor,
    input.reasoning,
    input.rules,
    input.taxonomy,
    input.outputContract,
  ];
  for (const artifact of artifacts) {
    if (!artifact?.id || artifact.content == null) {
      throw new Error("PROMPT_REQUIRED_ARTIFACT_MISSING");
    }
  }

  const sections = [
    ["global_runtime_context", input.globalArtifacts.runtimeContext.content],
    ["evidence_grounding", input.globalArtifacts.evidenceGrounding.content],
    ["output_discipline", input.globalArtifacts.outputDiscipline.content],
    ["processor_task", input.processor.content],
    ["processor_reasoning", input.reasoning.content],
    ["processor_rules", input.rules.content],
    ["taxonomy_contract", input.taxonomy.content],
    ["execution_context", input.executionContext],
    ["normalized_evidence_context", input.evidence],
    ["output_contract", input.outputContract.content],
  ] as const;
  const instruction = sections
    .map(([section, content]) =>
      [`## ${section}`, JSON.stringify(content, null, 2)].join("\n"),
    )
    .join("\n\n");
  const digest = createHash("sha256")
    .update(instruction)
    .digest("hex")
    .slice(0, 16);

  return {
    promptBuildId: `pb_${digest}_${randomUUID()}`,
    instruction,
    outputContract: input.outputContract.content,
    artifactVersions: Object.fromEntries(
      artifacts.map((artifact) => [artifact.id, artifact.version]),
    ),
    evidenceRefs: [...input.evidenceRefs],
  };
}
