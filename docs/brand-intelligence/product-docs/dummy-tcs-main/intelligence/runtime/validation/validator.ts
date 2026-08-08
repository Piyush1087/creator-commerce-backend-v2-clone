import { z } from "zod";
import {
  buildIdentityCoreSchema,
  GatekeeperSchema,
  IndustryNicheSchema,
  MarketGeographySchema,
  validateGatekeeperTaxonomy,
  type CanonicalIndustryTaxonomy,
  type IdentityCoreOutputId,
} from "./identity_schemas";

export type ValidationRequest = {
  processor_id: "industry_classification" | "identity_core" | "market_geography";
  processor_scope?: "gatekeeper" | "industry_niche";
  active_outputs: string[];
  raw_output: unknown;
  taxonomy?: CanonicalIndustryTaxonomy;
  legacy_industry_values?: string[];
};

export type ValidationIssue = {
  path: Array<string | number>;
  code: string;
  message: string;
};

export type ValidationResult =
  | { ok: true; data: unknown; issues: [] }
  | {
      ok: false;
      code: "OUTPUT_VALIDATION_FAILED";
      status: "FAILED_VALIDATION";
      validation_stage: "STRUCTURAL" | "SEMANTIC" | "CONFIGURATION";
      issues: ValidationIssue[];
    };

function issuesFromZod(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path,
    code: issue.code,
    message: issue.message,
  }));
}

function fail(
  stage: "STRUCTURAL" | "SEMANTIC" | "CONFIGURATION",
  issues: ValidationIssue[]
): ValidationResult {
  return {
    ok: false,
    code: "OUTPUT_VALIDATION_FAILED",
    status: "FAILED_VALIDATION",
    validation_stage: stage,
    issues,
  };
}

function parse(schema: z.ZodTypeAny, raw: unknown): ValidationResult {
  const result = schema.safeParse(raw);
  if (!result.success) return fail("STRUCTURAL", issuesFromZod(result.error));
  return { ok: true, data: result.data, issues: [] };
}

export function validateProcessorOutput(request: ValidationRequest): ValidationResult {
  if (request.processor_id === "identity_core") {
    try {
      const schema = buildIdentityCoreSchema(request.active_outputs as IdentityCoreOutputId[]);
      return parse(schema, request.raw_output);
    } catch (error) {
      return fail("CONFIGURATION", [
        { path: [], code: "INVALID_ACTIVE_OUTPUT_CONFIGURATION", message: error instanceof Error ? error.message : "Invalid identity_core active output configuration" },
      ]);
    }
  }

  if (request.processor_id === "industry_classification" && request.processor_scope === "gatekeeper") {
    const structural = GatekeeperSchema.safeParse(request.raw_output);
    if (!structural.success) return fail("STRUCTURAL", issuesFromZod(structural.error));
    if (!request.taxonomy) {
      return fail("CONFIGURATION", [
        { path: [], code: "CANONICAL_TAXONOMY_REQUIRED", message: "Gatekeeper semantic validation requires canonical Industry/Sub-industry taxonomy" },
      ]);
    }
    const taxonomyIssues = validateGatekeeperTaxonomy(
      structural.data,
      request.taxonomy,
      request.legacy_industry_values ?? []
    );
    if (taxonomyIssues.length) {
      return fail(
        "SEMANTIC",
        taxonomyIssues.map((message) => ({ path: ["industry", "sub_industry"], code: "TAXONOMY_MISMATCH", message }))
      );
    }
    return { ok: true, data: structural.data, issues: [] };
  }

  if (request.processor_id === "industry_classification" && request.processor_scope === "industry_niche") {
    return parse(IndustryNicheSchema, request.raw_output);
  }

  if (request.processor_id === "market_geography") {
    return parse(MarketGeographySchema, request.raw_output);
  }

  return fail("CONFIGURATION", [
    { path: [], code: "VALIDATOR_NOT_CONFIGURED", message: `No validator configured for ${request.processor_id}${request.processor_scope ? `.${request.processor_scope}` : ""}` },
  ]);
}
