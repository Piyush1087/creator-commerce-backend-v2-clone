import type { BrandId } from "./evidence-identities";

export class DataExtractionTenancyError extends Error {
  constructor() {
    super("DATA_EXTRACTION_TENANCY_VIOLATION");
    this.name = "DataExtractionTenancyError";
  }
}

export function assertSameBrand(expected: BrandId, actual: BrandId): void {
  if (expected !== actual) throw new DataExtractionTenancyError();
}
