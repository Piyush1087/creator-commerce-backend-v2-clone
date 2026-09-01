import { z, type ZodType } from "zod";
import { visualStyleOutputContract } from "./visual-style-output-schema";
import { serviceabilityOutputContract } from "./serviceability-output-schema";

import type { VerifiedContractBundle } from "../bundle/contract-bundle.types";

type ContractNode = Readonly<Record<string, unknown>>;

function record(value: unknown): ContractNode | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ContractNode)
    : undefined;
}

function nodeSchema(
  node: ContractNode,
  contract: ContractNode,
): ZodType<unknown> {
  if (typeof node.schema === "string") {
    const referenced = record(contract[node.schema]);
    if (!referenced) throw new Error("UNKNOWN_FROZEN_OUTPUT_SCHEMA_REFERENCE");
    const schema = nodeSchema(referenced, contract);
    return node.nullable === true ||
      (Array.isArray(node.type) && node.type.includes("null"))
      ? schema.nullable()
      : schema;
  }

  const declared = Array.isArray(node.type)
    ? node.type.filter((item): item is string => typeof item === "string")
    : typeof node.type === "string"
      ? [node.type]
      : [];
  const nonNull = declared.filter((type) => type !== "null");
  let schema: ZodType<unknown>;
  if (node.type === "enum" || nonNull.includes("enum")) {
    const values = Array.isArray(node.values)
      ? node.values.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    if (values.length === 0) throw new Error("EMPTY_FROZEN_OUTPUT_ENUM");
    schema = z.enum(values as [string, ...string[]]);
  } else if (
    nonNull.includes("object") ||
    record(node.fields) ||
    record(node.properties)
  ) {
    const fields = record(node.fields) ?? record(node.properties) ?? {};
    const required = new Set(
      Array.isArray(node.required)
        ? node.required.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    );
    const shape: Record<string, ZodType<unknown>> = {};
    for (const [field, value] of Object.entries(fields)) {
      const fieldNode = record(value);
      if (!fieldNode) throw new Error("INVALID_FROZEN_OUTPUT_FIELD_SCHEMA");
      const fieldSchema = nodeSchema(fieldNode, contract);
      shape[field] = required.has(field) ? fieldSchema : fieldSchema.optional();
    }
    schema =
      node.additional_properties === false
        ? z.object(shape).strict()
        : z.object(shape).passthrough();
  } else if (nonNull.includes("array")) {
    const itemNode =
      typeof node.item === "string"
        ? record(contract[node.item])
        : (record(node.item) ??
          (typeof node.item_type === "string"
            ? { type: node.item_type }
            : undefined));
    if (!itemNode) throw new Error("MISSING_FROZEN_OUTPUT_ITEM_SCHEMA");
    let arraySchema = z.array(nodeSchema(itemNode, contract));
    if (typeof node.min_items === "number")
      arraySchema = arraySchema.min(node.min_items);
    schema = arraySchema;
  } else if (nonNull.includes("string")) {
    let stringSchema = z.string();
    const minimum =
      typeof node.min_length === "number"
        ? node.min_length
        : typeof node.min_length_when_non_null === "number"
          ? node.min_length_when_non_null
          : undefined;
    if (minimum !== undefined) stringSchema = stringSchema.min(minimum);
    if (node.normalization_when_non_null === "ISO_639_1_lowercase") {
      stringSchema = stringSchema.regex(/^[a-z]{2}$/u);
    }
    schema = stringSchema;
  } else if (nonNull.includes("boolean")) {
    schema = z.boolean();
  } else if (nonNull.includes("number")) {
    let numberSchema = z.number();
    const minimum =
      typeof node.minimum === "number"
        ? node.minimum
        : typeof node.minimum_when_non_null === "number"
          ? node.minimum_when_non_null
          : undefined;
    if (minimum !== undefined) numberSchema = numberSchema.min(minimum);
    schema = numberSchema;
  } else {
    throw new Error("UNSUPPORTED_FROZEN_OUTPUT_SCHEMA_NODE");
  }
  return declared.includes("null") || node.nullable === true
    ? schema.nullable()
    : schema;
}

/** Builds the provider constraint from the already verified frozen artifact. */
export function verifiedOutputZodSchema(
  bundle: VerifiedContractBundle,
): ZodType<unknown> {
  const contract = serviceabilityOutputContract(
    bundle,
    visualStyleOutputContract(bundle),
  );
  const response = record(contract.response);
  if (!response) throw new Error("MISSING_FROZEN_OUTPUT_RESPONSE_SCHEMA");
  return nodeSchema(response, contract);
}
