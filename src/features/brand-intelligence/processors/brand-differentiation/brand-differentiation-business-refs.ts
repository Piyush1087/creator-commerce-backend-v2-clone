import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import type { BusinessStateReference } from "../../input/canonical-state/canonical-brand-state.port";

/** Observation time is telemetry, not canonical revision identity. */
export function differentiationBusinessRef(
  semantic: string,
  reference: BusinessStateReference,
): string {
  const { observedAt: _observedAt, ...stableReference } = reference;
  return sha256CanonicalExecution({ semantic, reference: stableReference });
}
