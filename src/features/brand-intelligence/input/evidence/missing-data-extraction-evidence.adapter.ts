import { Injectable } from "@nestjs/common";

import { InputDependencyError } from "../domain/input-dependency.error";
import type {
  IntelligenceEvidenceReadRequest,
  IntelligenceEvidenceReader,
  NormalizedEvidenceSet,
} from "./intelligence-evidence.port";

/**
 * Gate B owns durable normalized Evidence. Until that store and its reader are
 * present, Intelligence must fail explicitly instead of treating its own
 * lineage references, Preview output, or provider payloads as Evidence.
 */
@Injectable()
export class MissingDataExtractionEvidenceAdapter implements IntelligenceEvidenceReader {
  read(
    request: IntelligenceEvidenceReadRequest,
  ): Promise<NormalizedEvidenceSet> {
    return Promise.reject(
      new InputDependencyError(
        "DE_EVIDENCE_STORE_PREREQUISITE_MISSING",
        "The durable normalized Data Extraction Evidence reader is not installed",
        {
          brandId: request.brandId,
          processorId: request.processorId,
          processorVersion: request.processorVersion,
          capabilityIds: [...request.capabilityIds],
        },
      ),
    );
  }
}
