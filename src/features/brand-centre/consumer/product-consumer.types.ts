export const PRODUCT_PROCESSOR_OBJECT_OWNERSHIP = {
  offering_factual_synthesis: "offering_factual_profile",
  offering_creator_communication: "offering_creator_communication_profile",
  offering_actionability_synthesis: "offering_actionability_profile",
} as const;

export type ProductProcessorId =
  keyof typeof PRODUCT_PROCESSOR_OBJECT_OWNERSHIP;
export type ProductObjectSemanticId =
  (typeof PRODUCT_PROCESSOR_OBJECT_OWNERSHIP)[ProductProcessorId];

export const PRODUCT_PROCESSOR_IDS = Object.freeze(
  Object.keys(PRODUCT_PROCESSOR_OBJECT_OWNERSHIP) as ProductProcessorId[],
);

export const PRODUCT_CONSUMER_OBJECTS = Object.freeze(
  Object.values(
    PRODUCT_PROCESSOR_OBJECT_OWNERSHIP,
  ) as ProductObjectSemanticId[],
);
