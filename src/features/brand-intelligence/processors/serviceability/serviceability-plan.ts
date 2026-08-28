import type {
  IntelligenceNodeKind,
  IntelligenceReadiness,
} from "@prisma/client";
import { canonicalJson } from "../../contracts/bundle/canonical-json";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import {
  serviceabilityInvalid,
  serviceabilityItemPath,
  serviceabilityScopeAllows,
  validateServiceabilityIdentity,
} from "./serviceability-identity";
import type { ServiceabilityCurrentState } from "./serviceability-state.repository";
import type {
  ServiceabilityItemMetadata,
  ServiceabilityMetadata,
  ServiceabilityOutput,
} from "./serviceability.types";

export interface ServiceabilityComponentPlan {
  readonly path: string;
  readonly value: unknown;
  readonly metadata: ServiceabilityMetadata | null;
  readonly nodeKind: IntelligenceNodeKind;
  readonly readiness: IntelligenceReadiness;
  readonly apply: boolean;
}
export function serviceabilityOutputReadiness(
  output: ServiceabilityOutput,
): IntelligenceReadiness {
  const profile = output.serviceability_profile;
  if (!profile) return "NOT_READY";
  return profile.overall_scope &&
    profile.serviceable_markets?.length &&
    profile.serviceability_basis?.length
    ? "READY"
    : "PARTIAL";
}
export function serviceabilityComponentPlan(
  output: ServiceabilityOutput,
  current: readonly ServiceabilityCurrentState[],
  scope: readonly ComponentSemanticAddress[],
): readonly ServiceabilityComponentPlan[] {
  validateServiceabilityIdentity(output, current);
  const existing = new Map(
    current.map((row) => [row.componentSemanticPath, row]),
  );
  const protectedAt = (path: string) => {
    const row = existing.get(path);
    return !!row && row.protectionState !== "UNPROTECTED";
  };
  if (protectedAt("$"))
    serviceabilityInvalid("SERVICEABILITY_PROTECTED_ROOT_REQUIRES_RESOLUTION");
  const plans: ServiceabilityComponentPlan[] = [];
  const add = (
    path: string,
    value: unknown,
    metadata: ServiceabilityMetadata | null,
    nodeKind: IntelligenceNodeKind,
    readiness: IntelligenceReadiness = "READY",
  ) => {
    if (serviceabilityScopeAllows(scope, path))
      plans.push({ path, value, metadata, nodeKind, readiness, apply: true });
  };
  const admission = (path: string) => {
    if (!existing.has(path) && !serviceabilityScopeAllows(scope, path))
      serviceabilityInvalid("SERVICEABILITY_PARENT_REQUIRED_FOR_ADMISSION");
  };
  admission("$");
  const readiness = serviceabilityOutputReadiness(output);
  if (!existing.has("$") || readiness !== "NOT_READY")
    add(
      "$",
      readiness === "NOT_READY" ? null : {},
      null,
      "OBJECT_FIELD",
      readiness,
    );
  const profile = output.serviceability_profile;
  if (!profile) return plans;
  const metadata = output.output_metadata;
  if (profile.overall_scope !== null)
    add(
      "$/f/overall_scope",
      profile.overall_scope,
      metadata.overall_scope,
      "SCALAR",
    );
  add(
    "$/f/coverage_is_heterogeneous",
    profile.coverage_is_heterogeneous,
    metadata.coverage_is_heterogeneous,
    "SCALAR",
  );
  if (profile.mixed_coverage_note !== null)
    add(
      "$/f/mixed_coverage_note",
      profile.mixed_coverage_note,
      metadata.mixed_coverage_note,
      "SCALAR",
    );
  const valueAt = (path: string) =>
    existing.get(path)?.currentComponentGeneration.valuePayload;
  const list = <T extends { readonly semantic_id: string }>(
    name: "serviceable_markets" | "serviceability_basis",
    items: readonly T[] | null,
    metas: readonly ServiceabilityItemMetadata[] | null,
    fields: readonly string[],
  ) => {
    if (!items?.length) return; // Null/empty/omission never removes prior items.
    const collection = `$/f/${name}`;
    admission(collection);
    const itemEquivalent = (item: T) => {
      const path = serviceabilityItemPath(name, item.semantic_id);
      return fields.every(
        (field) =>
          canonicalJson((item as Readonly<Record<string, unknown>>)[field]) ===
          canonicalJson(valueAt(`${path}/f/${field}`)),
      );
    };
    if (protectedAt(collection)) {
      if (!items.every(itemEquivalent)) {
        if (!serviceabilityScopeAllows(scope, collection))
          serviceabilityInvalid(
            "SERVICEABILITY_PROTECTED_PARENT_OUTSIDE_SCOPE",
          );
        add(collection, items, metas?.[0] ?? null, "COLLECTION");
      }
      return;
    }
    add(collection, [], null, "COLLECTION");
    for (const item of items) {
      const path = serviceabilityItemPath(name, item.semantic_id);
      const meta = metas?.find(
        (candidate) => candidate.semantic_id === item.semantic_id,
      );
      if (!meta) serviceabilityInvalid("SERVICEABILITY_ITEM_METADATA_MISMATCH");
      admission(path);
      if (protectedAt(path)) {
        if (!itemEquivalent(item)) {
          if (!serviceabilityScopeAllows(scope, path))
            serviceabilityInvalid(
              "SERVICEABILITY_PROTECTED_PARENT_OUTSIDE_SCOPE",
            );
          add(path, item, meta, "SEMANTIC_ITEM");
        }
        continue;
      }
      add(path, { semantic_id: item.semantic_id }, null, "SEMANTIC_ITEM");
      for (const field of fields)
        add(
          `${path}/f/${field}`,
          (item as Readonly<Record<string, unknown>>)[field],
          meta,
          "SCALAR",
        );
    }
  };
  list(
    "serviceable_markets",
    profile.serviceable_markets,
    metadata.serviceable_markets,
    ["scope", "label", "country_code", "locality", "region", "radius_km"],
  );
  list(
    "serviceability_basis",
    profile.serviceability_basis,
    metadata.serviceability_basis,
    [
      "basis_type",
      "business_state_refs",
      "evidence_refs",
      "applies_to_market_refs",
      "offering_refs",
    ],
  );
  return plans;
}
