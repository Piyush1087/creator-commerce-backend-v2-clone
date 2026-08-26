import { Injectable } from "@nestjs/common";

import { canonicalJson } from "../bundle/canonical-json";
import type { VerifiedContractBundle } from "../bundle/contract-bundle.types";
import { accepted, rejected } from "./validation-result";
import type { ValidationIssue, ValidationResult } from "./validation.types";

type ContractNode = Readonly<Record<string, unknown>>;

function record(value: unknown): ContractNode | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ContractNode)
    : undefined;
}

function allowedTypes(node: ContractNode): readonly string[] {
  if (node.type === "enum") return ["string"];
  if (Array.isArray(node.type)) {
    return node.type.filter((item): item is string => typeof item === "string");
  }
  return typeof node.type === "string"
    ? [node.type]
    : record(node.fields) || record(node.properties)
      ? ["object"]
      : [];
}

function actualType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value === "object" ? "object" : typeof value;
}

function issue(
  code: string,
  componentPath: string,
  message: string,
): ValidationIssue {
  return { category: "STRUCTURAL", code, componentPath, message };
}

@Injectable()
export class StructuralValidator {
  readonly validatorId = "contract_output_schema_v1";

  validate(
    bundle: VerifiedContractBundle,
    untrustedOutput: unknown,
  ): ValidationResult<unknown> {
    const response = record(bundle.artifacts.outputContract.response);
    if (!response) {
      return rejected([
        {
          category: "CONFIGURATION",
          code: "MISSING_OUTPUT_SCHEMA",
          message: "Pinned output contract has no response schema",
        },
      ]);
    }
    const issues: ValidationIssue[] = [];
    this.validateNode(
      response,
      untrustedOutput,
      "$",
      bundle.artifacts.outputContract,
      issues,
    );
    return issues.length === 0 ? accepted(untrustedOutput) : rejected(issues);
  }

  private validateNode(
    node: ContractNode,
    value: unknown,
    path: string,
    outputContract: ContractNode,
    issues: ValidationIssue[],
  ): void {
    // Nullability belongs to the reference site, not just the shared schema.
    if (
      value === null &&
      (node.nullable === true ||
        (Array.isArray(node.type) && node.type.includes("null")))
    )
      return;
    if (typeof node.schema === "string") {
      const shared = record(outputContract[node.schema]);
      if (!shared) {
        issues.push(
          issue(
            "UNKNOWN_SCHEMA_REFERENCE",
            path,
            "Schema reference is not defined",
          ),
        );
        return;
      }
      this.validateNode(shared, value, path, outputContract, issues);
      return;
    }

    const types = allowedTypes(node);
    const foundType = actualType(value);
    if (types.length > 0 && !types.includes(foundType)) {
      issues.push(
        issue(
          "TYPE_MISMATCH",
          path,
          `Expected ${types.join("|")}; received ${foundType}`,
        ),
      );
      return;
    }
    if (value === null) return;

    if (node.type === "enum") {
      const values = Array.isArray(node.values) ? node.values : [];
      if (!values.includes(value)) {
        issues.push(
          issue(
            "INVALID_ENUM",
            path,
            "Value is outside the frozen enum vocabulary",
          ),
        );
      }
      return;
    }
    if (typeof value === "string") {
      const minimum =
        typeof node.min_length === "number"
          ? node.min_length
          : typeof node.min_length_when_non_null === "number"
            ? node.min_length_when_non_null
            : undefined;
      if (minimum !== undefined && value.trim().length < minimum) {
        issues.push(
          issue(
            "STRING_TOO_SHORT",
            path,
            "String is blank or shorter than the contract minimum",
          ),
        );
      }
      if (
        node.normalization_when_non_null === "ISO_639_1_lowercase" &&
        !/^[a-z]{2}$/u.test(value)
      ) {
        issues.push(
          issue(
            "INVALID_LANGUAGE_NORMALIZATION",
            path,
            "Language must be lowercase ISO 639-1",
          ),
        );
      }
      return;
    }
    if (Array.isArray(value)) {
      if (typeof node.min_items === "number" && value.length < node.min_items) {
        issues.push(
          issue("ARRAY_TOO_SHORT", path, "Array has fewer items than required"),
        );
      }
      if (node.unique_items === true) {
        const canonical = value.map(canonicalJson);
        if (new Set(canonical).size !== canonical.length) {
          issues.push(
            issue("DUPLICATE_ARRAY_ITEM", path, "Array items must be unique"),
          );
        }
      }
      const itemNode =
        typeof node.item === "string"
          ? record(outputContract[node.item])
          : (record(node.item) ??
            (typeof node.item_type === "string"
              ? ({ type: node.item_type } as ContractNode)
              : undefined));
      if (!itemNode && value.length > 0) {
        issues.push(
          issue(
            "MISSING_ITEM_SCHEMA",
            path,
            "Array item schema is not defined",
          ),
        );
        return;
      }
      value.forEach((item, index) => {
        if (itemNode) {
          this.validateNode(
            itemNode,
            item,
            `${path}/${index}`,
            outputContract,
            issues,
          );
        }
      });
      return;
    }

    const objectValue = record(value);
    if (!objectValue) return;
    const fields = record(node.fields) ?? record(node.properties) ?? {};
    const required = Array.isArray(node.required)
      ? node.required.filter((item): item is string => typeof item === "string")
      : [];
    for (const field of required) {
      if (!Object.prototype.hasOwnProperty.call(objectValue, field)) {
        issues.push(
          issue(
            "MISSING_REQUIRED_FIELD",
            `${path}/${field}`,
            `Required field '${field}' is missing`,
          ),
        );
      }
    }
    if (node.additional_properties === false) {
      for (const field of Object.keys(objectValue)) {
        if (!Object.prototype.hasOwnProperty.call(fields, field)) {
          issues.push(
            issue(
              "UNKNOWN_FIELD",
              `${path}/${field}`,
              `Field '${field}' is not allowed`,
            ),
          );
        }
      }
    }
    for (const [field, fieldNode] of Object.entries(fields)) {
      if (Object.prototype.hasOwnProperty.call(objectValue, field)) {
        const nested = record(fieldNode);
        if (!nested) {
          issues.push(
            issue(
              "INVALID_FIELD_SCHEMA",
              `${path}/${field}`,
              "Field schema is invalid",
            ),
          );
        } else {
          this.validateNode(
            nested,
            objectValue[field],
            `${path}/${field}`,
            outputContract,
            issues,
          );
        }
      }
    }
  }
}
