import { resolve } from "node:path";
import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { ContractBundleIntegrityVerifier } from "../../contracts/bundle/contract-bundle.integrity";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import type { NormalizedEvidenceSet } from "../../input/evidence/intelligence-evidence.port";
import { supportsAudience } from "./audience-persona-evidence";
import {
  AUDIENCE_OBJECT,
  AUDIENCE_LIST_FIELDS,
  type AudienceOutput,
  type AudiencePersona,
  type AudienceMetadata,
  type AudiencePersonaMetadata,
} from "./audience-persona.types";

export const registryKey = {
  processorId: "audience_persona_synthesis",
  processorVersion: "1.0",
  outputContractId: "audience_persona_synthesis_output_contract",
  outputContractVersion: "1.0",
};
export const capabilities = [
  "owned_website.brand_messaging",
  "owned_website.brand_company_context",
  "owned_website.offering_context",
] as const;
export const scope = (brandId: string) => [
  {
    brandId,
    objectSemanticId: AUDIENCE_OBJECT,
    componentSemanticPath: "$",
    pathSchemeVersion: 1 as const,
  },
];
export function contracts() {
  const registry = new ContractRuntimeRegistry(
    new ContractBundleIntegrityVerifier(),
    new SemanticValidator(),
  );
  registry.verifyAtRoot(
    resolve(
      process.cwd(),
      "src/features/brand-intelligence/generated/contract-bundles",
    ),
  );
  return registry;
}
export function persona(
  id = "audience_small_teams",
  complete = false,
): AudiencePersona {
  return {
    semantic_id: id,
    label: "Small teams",
    summary:
      "Small teams evaluating creator partnership tools for reliable workflows.",
    lifecycle: "ACTIVE",
    motivations: [
      {
        semantic_id: "motivation_reliable_workflows",
        value: "Build reliable creator partnership workflows",
      },
    ],
    ...(complete
      ? {
          key_characteristics: [
            {
              semantic_id: "characteristic_small_team",
              value: "Small teams evaluating partnership tools",
            },
          ],
          barriers_or_concerns: [
            {
              semantic_id: "barrier_workflow_complexity",
              value: "Concern about complex partnership workflows",
            },
          ],
          trust_credibility_needs: [
            {
              semantic_id: "trust_clear_workflows",
              value: "Clear workflow explanations",
            },
          ],
        }
      : {}),
  };
}
export function audienceOutput(
  evidence: NormalizedEvidenceSet,
  personas: readonly AudiencePersona[] = [persona()],
  existing: readonly string[] = [],
): AudienceOutput {
  const ref =
    evidence.capabilityResults
      .flatMap((c) => c.evidence)
      .find((e) =>
        supportsAudience({
          evidenceRef: e.evidenceRef,
          semanticId: e.evidenceRef,
          revisionIdentity: e.captureVersion,
          capabilityId: e.capabilityId,
          representativeness: e.representativeness,
          normalizedPayload: e.boundedNormalizedPayload,
          polarity: e.polarity,
        }),
      )?.evidenceRef ?? "missing";
  const meta = (): AudienceMetadata => ({
    authority: "CREATOR_SHOP_DERIVED",
    source_class: "OWNED_WEBSITE",
    freshness: "CURRENT",
    evidence_refs: [ref],
  });
  return {
    audience_personas: personas,
    output_metadata: personas.map((p) => {
      const item_metadata: Record<
        string,
        Record<string, AudienceMetadata>
      > = {};
      for (const field of AUDIENCE_LIST_FIELDS)
        if (field in p)
          item_metadata[field] = Object.fromEntries(
            (p[field] ?? []).map((i) => [i.semantic_id, meta()]),
          );
      return {
        semantic_id: p.semantic_id,
        field_metadata: Object.fromEntries(
          Object.keys(p)
            .filter((k) => k !== "semantic_id")
            .map((k) => [k, meta()]),
        ),
        item_metadata,
      } satisfies AudiencePersonaMetadata;
    }),
    reconciliation: personas.map((p) => ({
      candidate_ref: p.semantic_id,
      relationship: existing.includes(p.semantic_id)
        ? "SAME_PERSONA"
        : "NEW_PERSONA",
      matched_persona_semantic_id: existing.includes(p.semantic_id)
        ? p.semantic_id
        : null,
    })),
  };
}

export function supersession(
  output: AudienceOutput,
  edges: Readonly<Record<string, readonly string[]>>,
): AudienceOutput {
  return {
    ...output,
    output_metadata: output.output_metadata!.map((m) => {
      const sources = Object.entries(edges)
        .filter(([, targets]) => targets.includes(m.semantic_id))
        .map(([id]) => id);
      return {
        ...m,
        field_metadata: {
          ...m.field_metadata,
          lifecycle: {
            ...m.field_metadata.lifecycle,
            ...(edges[m.semantic_id]
              ? {
                  superseded_by_ref: edges[m.semantic_id],
                  supersession_reason: "Conceptual replacement",
                }
              : {}),
            ...(sources.length
              ? {
                  supersedes_ref: sources,
                  supersession_reason: "Conceptual replacement",
                }
              : {}),
          },
        },
      };
    }),
  };
}
