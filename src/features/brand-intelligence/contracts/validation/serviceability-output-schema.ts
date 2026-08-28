import type { VerifiedContractBundle } from "../bundle/contract-bundle.types";
type Node = Readonly<Record<string, unknown>>;
const record = (value: unknown): Node => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("SERVICEABILITY_FROZEN_SCHEMA_INVALID");
  return value as Node;
};

/** Resolves the frozen metadata schema reference without changing bundled bytes. */
export function serviceabilityOutputContract(
  bundle: VerifiedContractBundle,
  contract: Node,
): Node {
  if (bundle.manifest.processorId !== "serviceability_synthesis")
    return contract;
  const shared = record(contract.shared_generated_metadata);
  const fields = record(shared.fields);
  const scalar = {
    ...shared,
    type: ["object", "null"],
    nullable: true,
    additional_properties: false,
  };
  const item = {
    type: "object",
    additional_properties: false,
    required: ["semantic_id", ...(shared.required as string[])],
    fields: { ...fields, semantic_id: { type: "string", min_length: 1 } },
  };
  const list = { type: ["array", "null"], nullable: true, item };
  const response = record(contract.response);
  const properties = record(response.properties);
  const metadata = record(properties.output_metadata);
  return {
    ...contract,
    response: {
      ...response,
      properties: {
        ...properties,
        output_metadata: {
          ...metadata,
          fields: {
            overall_scope: scalar,
            coverage_is_heterogeneous: scalar,
            serviceable_markets: list,
            serviceability_basis: list,
            mixed_coverage_note: scalar,
          },
        },
      },
    },
  };
}
