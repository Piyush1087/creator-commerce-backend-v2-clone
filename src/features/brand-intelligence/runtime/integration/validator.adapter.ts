import type { SafeYamlLoader } from "../loaders/yaml_loader";
import {
  validateProcessorOutput,
  type ValidationIssue,
} from "../validation/validator";
import type { CanonicalIndustryTaxonomy } from "../validation/identity-schemas";
import type { OutputValidatorPort } from "./types";

const TAXONOMY_PATH =
  "engines/brand_intelligence/branches/identity/artifacts/industry_classification/taxonomy.yaml";

function canonicalTaxonomy(raw: {
  hierarchy?: Record<string, { sub_industries?: Array<{ id: string }> }>;
}): CanonicalIndustryTaxonomy {
  const hierarchy = raw?.hierarchy ?? {};
  return Object.fromEntries(
    Object.entries(hierarchy).map(([industry, value]) => [
      industry,
      (value?.sub_industries ?? []).map((item) => item.id),
    ]),
  );
}

function legacyIndustryValues(raw: {
  legacy_compatibility?: Record<string, Record<string, string>>;
}): string[] {
  const compatibility = raw?.legacy_compatibility ?? {};
  const values = new Set<string>();
  for (const mapping of Object.values(compatibility)) {
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      continue;
    }
    for (const key of Object.keys(mapping)) values.add(key);
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

  async validate({
    task,
    rawOutput,
  }: Parameters<OutputValidatorPort["validate"]>[0]) {
    let taxonomy: CanonicalIndustryTaxonomy | undefined;
    let legacy: string[] | undefined;

    if (
      task.processorId === "industry_classification" &&
      task.processorScope === "gatekeeper"
    ) {
      const raw = await this.yaml.load(TAXONOMY_PATH);
      taxonomy = canonicalTaxonomy(
        raw as {
          hierarchy?: Record<
            string,
            { sub_industries?: Array<{ id: string }> }
          >;
        },
      );
      legacy = legacyIndustryValues(
        raw as {
          legacy_compatibility?: Record<string, Record<string, string>>;
        },
      );
    }

    const result = validateProcessorOutput({
      processor_id: task.processorId as
        | "industry_classification"
        | "identity_core"
        | "market_geography",
      processor_scope: task.processorScope as
        | "gatekeeper"
        | "industry_niche"
        | undefined,
      active_outputs: task.activeOutputs,
      raw_output: rawOutput,
      taxonomy,
      legacy_industry_values: legacy,
    });

    if (result.ok) {
      return { ok: true as const, data: result.data as Record<string, unknown> };
    }
    return {
      ok: false as const,
      error: {
        code: result.code,
        message: issueSummary(result.validation_stage, result.issues),
        validation_stage: result.validation_stage,
        issues: result.issues,
      },
    };
  }
}
