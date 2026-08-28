import { Injectable } from "@nestjs/common";

import type {
  ComponentPathOwnershipRegistry,
  ComponentSemanticAddress,
} from "../../semantic-path/component-path.types";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import type { ContractRegistryKey } from "../bundle/contract-bundle.types";
import { accepted, rejected } from "../validation/validation-result";
import type {
  ValidationIssue,
  ValidationResult,
} from "../validation/validation.types";
import { ContractRuntimeRegistry } from "./contract-runtime.registry";

@Injectable()
export class BundlePathOwnershipRegistry implements ComponentPathOwnershipRegistry {
  constructor(
    private readonly registry: ContractRuntimeRegistry,
    private readonly codec: ComponentPathCodec,
  ) {}

  owns(address: ComponentSemanticAddress): boolean {
    return this.registry
      .registrations()
      .some((registration) => this.registrationOwns(registration, address));
  }

  ownsForBundle(
    key: ContractRegistryKey,
    address: ComponentSemanticAddress,
  ): boolean {
    const bundle = this.registry.getVerifiedBundle(key);
    return bundle.manifest.ownedPathPatterns.some((pattern) => {
      if (pattern.objectSemanticId !== address.objectSemanticId) return false;
      return this.pathMatches(pattern.componentPathPattern, address);
    });
  }

  validateActiveScope(
    key: ContractRegistryKey,
    addresses: readonly ComponentSemanticAddress[],
  ): ValidationResult<readonly ComponentSemanticAddress[]> {
    const issues: ValidationIssue[] = [];
    const seen = new Set<string>();
    for (const address of addresses) {
      try {
        this.codec.assertCanonical(
          address.componentSemanticPath,
          address.pathSchemeVersion,
        );
      } catch {
        issues.push({
          category: "CONFIGURATION",
          code: "NON_CANONICAL_ACTIVE_SCOPE_PATH",
          componentPath: address.componentSemanticPath,
          message:
            "Active scope contains a syntactically invalid or non-canonical path",
        });
        continue;
      }
      const identity = [
        address.brandId,
        address.objectSemanticId,
        address.pathSchemeVersion,
        address.componentSemanticPath,
      ].join("\u0000");
      if (seen.has(identity)) {
        issues.push({
          category: "CONFIGURATION",
          code: "DUPLICATE_ACTIVE_SCOPE_PATH",
          componentPath: address.componentSemanticPath,
          message: "Active scope contains a duplicate semantic component",
        });
      }
      seen.add(identity);
      if (!this.ownsForBundle(key, address)) {
        issues.push({
          category: "CONFIGURATION",
          code: "UNOWNED_ACTIVE_SCOPE_PATH",
          componentPath: address.componentSemanticPath,
          message:
            "Active scope contains an Object/path not owned by the registered contract",
        });
      }
    }
    return issues.length === 0 ? accepted(addresses) : rejected(issues);
  }

  private registrationOwns(
    registration: ReturnType<ContractRuntimeRegistry["registrations"]>[number],
    address: ComponentSemanticAddress,
  ): boolean {
    return registration.ownedPathPatterns.some(
      (pattern) =>
        pattern.objectSemanticId === address.objectSemanticId &&
        this.pathMatches(pattern.componentPathPattern, address),
    );
  }

  private pathMatches(
    patternPath: string,
    address: ComponentSemanticAddress,
  ): boolean {
    try {
      const pattern = this.codec.decode(patternPath, address.pathSchemeVersion);
      const actual = this.codec.decode(
        address.componentSemanticPath,
        address.pathSchemeVersion,
      );
      if (pattern.segments.length !== actual.segments.length) return false;
      return pattern.segments.every((expected, index) => {
        const found = actual.segments[index];
        if (expected.kind !== found.kind) return false;
        if (expected.kind === "field" && found.kind === "field") {
          return expected.value === found.value;
        }
        return (
          expected.kind === "item" &&
          found.kind === "item" &&
          (expected.semanticId === "{semantic_id}" ||
            expected.semanticId === found.semanticId)
        );
      });
    } catch {
      return false;
    }
  }
}
