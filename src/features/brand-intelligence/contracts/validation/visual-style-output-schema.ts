import type { VerifiedContractBundle } from "../bundle/contract-bundle.types";
type Node = Readonly<Record<string, unknown>>;
const record = (v: unknown): Node => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("VISUAL_FROZEN_SCHEMA_INVALID");
  return v as Node;
};

/** Compile frozen item-level metadata granularity. Does not edit bundle bytes or extend Object fields. */
export function visualStyleOutputContract(
  bundle: VerifiedContractBundle,
): Node {
  const contract = bundle.artifacts.outputContract;
  if (bundle.manifest.processorId !== "visual_style_synthesis") return contract;
  const generated = record(contract.generated_metadata);
  const fields = record(generated.fields);
  const itemMetadata = {
    type: "object",
    additional_properties: false,
    required: ["semantic_id", ...(generated.required as string[])],
    fields: { semantic_id: { type: "string", min_length: 1 }, ...fields },
  };
  const list = { type: ["array", "null"], nullable: true, item: itemMetadata };
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
            summary: {
              ...generated,
              type: ["object", "null"],
              nullable: true,
              additional_properties: false,
            },
            style_traits: list,
            imagery_style: {
              type: ["object", "null"],
              nullable: true,
              additional_properties: false,
              fields: {
                photographic_tendencies: list,
                subject_tendencies: list,
                mood_or_treatment: list,
              },
            },
            graphic_treatment: {
              type: ["object", "null"],
              nullable: true,
              additional_properties: false,
              fields: { traits: list },
            },
            visual_constraints: list,
          },
        },
      },
    },
  };
}
