import type { ValidationIssue, ValidationResult } from "./validation.types";

export function accepted<T>(value: T): ValidationResult<T> {
  return { valid: true, value, issues: [] };
}

export function rejected<T>(
  issues: readonly ValidationIssue[],
): ValidationResult<T> {
  return { valid: false, issues };
}
