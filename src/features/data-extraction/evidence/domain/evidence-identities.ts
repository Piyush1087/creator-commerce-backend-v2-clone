export type BrandId = string & { readonly __brand: "BrandId" };

export type ResourceRef = string & { readonly __brand: "ResourceRef" };
export type CaptureRef = string & { readonly __brand: "CaptureRef" };
export type EvidenceRef = string & { readonly __brand: "EvidenceRef" };
export type CapabilityExecutionRef = string & {
  readonly __brand: "CapabilityExecutionRef";
};
export type SemanticObservationKey = string & {
  readonly __brand: "SemanticObservationKey";
};
export type NormalizedContentRef = string & {
  readonly __brand: "NormalizedContentRef";
};
export type ProviderExecutionRef = string & {
  readonly __brand: "ProviderExecutionRef";
};

export const asBrandId = (value: string): BrandId => value as BrandId;
export const asResourceRef = (value: string): ResourceRef =>
  value as ResourceRef;
export const asCaptureRef = (value: string): CaptureRef => value as CaptureRef;
export const asEvidenceRef = (value: string): EvidenceRef =>
  value as EvidenceRef;
export const asCapabilityExecutionRef = (
  value: string,
): CapabilityExecutionRef => value as CapabilityExecutionRef;
export const asSemanticObservationKey = (
  value: string,
): SemanticObservationKey => value as SemanticObservationKey;
export const asNormalizedContentRef = (value: string): NormalizedContentRef =>
  value as NormalizedContentRef;
export const asProviderExecutionRef = (value: string): ProviderExecutionRef =>
  value as ProviderExecutionRef;
