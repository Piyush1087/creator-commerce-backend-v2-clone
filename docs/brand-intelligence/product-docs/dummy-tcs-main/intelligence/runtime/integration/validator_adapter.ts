import { validateProcessorOutput, type ValidationIssue } from "../validation/validator";
import type { CanonicalIndustryTaxonomy } from "../validation/identity_schemas";
import type { OutputValidatorPort } from "./types";
import type { SafeYamlLoader } from "../loaders/yaml_loader";

const TAXONOMY_PATH = "intelligence/engines/brand_intelligence/branches/identity/artifacts/industry_classification/taxonomy.yaml";

function canonicalTaxonomy(raw: any): CanonicalIndustryTaxonomy {
  const hierarchy = raw?.hierarchy ?? {};
  return Object.fromEntries(
    Object.entries(hierarchy).map(([industry, value]: [string, any]) => [
      industry,
      (value?.sub_industries ?? []).map((item: any) => item.id),
    ])
  );
}

function legacyIndustryValues(raw: any): string[] {
  const compatibility = raw?.legacy_compatibility ?? {};
  const values = new Set<string>();
  for (const mapping of Object.values(compatibility)) {
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) continue;
    for (const key of Object.keys(mapping as Record<string, unknown>)) values.add(key);
  }
  return [...values];
}

function issueSummary(stage: string, issues: ValidationIssue[]): string {
  const first = issues[0];
  if (!first) return `Output failed ${stage.toLowerCase()} validation`;
  const path = first.path.length ? ` at ${first.path.join(".")}` : "";
  return `${stage} validation failed${path}: ${first.message}`;
}

export class IdentityValidatorAdapter implements OutputValidatorPort {
  constructor(private readonly yaml: SafeYamlLoader) {}

  async validate({ task, rawOutput }: Parameters<OutputValidatorPort["validate"]>[0]) {
    let taxonomy: CanonicalIndustryTaxonomy | undefined;
    let legacy: string[] | undefined;

    if (task.processorId === "industry_classification" && task.processorScope === "gatekeeper") {
      const raw: any = await this.yaml.load(TAXONOMY_PATH);
      taxonomy = canonicalTaxonomy(raw);
      legacy = legacyIndustryValues(raw);
    }

    const result = validateProcessorOutput({
      processor_id: task.processorId as any,
      processor_scope: task.processorScope as any,
      active_outputs: task.activeOutputs,
      raw_output: rawOutput,
      taxonomy,
      legacy_industry_values: legacy,
    });

    if (result.ok) return { ok: true as const, data: result.data as Record<string, unknown> };
    return {
      ok: false as const,
      error: {
        code: result.code,
        message: issueSummary(result.validation_stage, result.issues),
        validation_stage: result.validation_stage,
        issues: result.issues,
      },
    } as any;
  }
}
