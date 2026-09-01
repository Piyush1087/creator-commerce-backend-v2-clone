import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import type { BusinessStateReference } from "../../input/canonical-state/canonical-brand-state.port";
import type { CanonicalBrandStateSnapshot } from "../../input/canonical-state/canonical-brand-state.port";
import type { Prisma } from "@prisma/client";
import type { BrandVisualStateService } from "../../../brand-canonical-state/brand-visual-state.service";
import { ProcessorExecutorFailure } from "../../execution/executor/processor-executor";
import { visualStyleInvalid } from "./visual-style-identity";
import type { VisualStyleOutput } from "./visual-style.types";

/** Observation time is telemetry, not canonical revision identity. */
export function visualStyleBusinessRef(
  semantic: string,
  reference: BusinessStateReference,
): string {
  const { observedAt: _observedAt, ...stableReference } = reference;
  return sha256CanonicalExecution({ semantic, reference: stableReference });
}

export function visualStyleBusinessEntries(
  snapshot: CanonicalBrandStateSnapshot,
) {
  return [
    ...snapshot.entries,
    ...(snapshot.visualState?.stateReference
      ? [
          {
            semantic: "visual_state",
            businessStateReference: snapshot.visualState.stateReference,
          },
        ]
      : []),
    ...(snapshot.visualState?.items ?? []).map((item) => ({
      semantic: "visual:" + item.itemId,
      businessStateReference: item.businessStateReference,
    })),
  ];
}
export function validateVisualCanonicalBoundary(
  snapshot: CanonicalBrandStateSnapshot,
  brandId: string,
  output?: VisualStyleOutput,
): void {
  const visual = snapshot.visualState;
  if (
    !visual ||
    snapshot.brandId !== brandId ||
    visual.brandId !== brandId ||
    (visual.stateReference &&
      (visual.stateReference.entityType !== "BrandVisualState" ||
        visual.stateReference.entityId !== brandId)) ||
    new Set(visual.items.map((i) => i.itemId)).size !== visual.items.length ||
    visual.items.some(
      (i) =>
        i.brandId !== brandId ||
        i.itemId !== i.businessStateReference.entityId ||
        i.businessStateReference.entityType !==
          (i.role === "PALETTE"
            ? "BrandVisualColor"
            : i.role === "TYPOGRAPHY"
              ? "BrandVisualTypography"
              : "BrandVisualAsset"),
    )
  )
    visualStyleInvalid("VISUAL_CANONICAL_REFERENCE_INTEGRITY");
  if (!output?.visual_style_profile) return;
  const strings: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object")
      Object.values(value).forEach(walk);
  };
  walk(output.visual_style_profile);
  for (const item of visual.items) {
    if (
      strings.some(
        (s) =>
          s === item.itemId ||
          s.toLowerCase() === item.value.toLowerCase() ||
          (item.role !== "TYPOGRAPHY" && s.includes(item.value)),
      )
    )
      visualStyleInvalid("VISUAL_CANONICAL_PAYLOAD_DUPLICATION");
  }
}

/** Shares the W1 transaction; an application edit cannot race old canonical refs into new current. */
export async function lockVisualCanonicalBasis(
  tx: Prisma.TransactionClient,
  snapshot: CanonicalBrandStateSnapshot,
  reader: BrandVisualStateService,
) {
  validateVisualCanonicalBoundary(snapshot, snapshot.brandId);
  await tx.$queryRaw`SELECT id FROM brand_profiles WHERE id = ${snapshot.brandId} FOR SHARE`;
  const live = await reader.read(snapshot.brandId, tx),
    before = snapshot.visualState!;
  const changed = () => {
    throw new ProcessorExecutorFailure({
      category: "RETRYABLE_TECHNICAL",
      code: "VISUAL_CANONICAL_BASIS_CHANGED",
    });
  };
  if ((live === null) !== (before.stateReference === null)) changed();
  if (!live) return;
  const revision = (entityType: string, entityId: string, value: number) =>
    sha256CanonicalExecution({ entityType, entityId, revision: value });
  if (
    revision("BrandVisualState", snapshot.brandId, live.revision) !==
    before.stateReference?.revisionToken
  )
    changed();
  const refs = new Map([
    ...live.assets.map(
      (i) => [i.id, revision("BrandVisualAsset", i.id, i.revision)] as const,
    ),
    ...live.colors.map(
      (i) => [i.id, revision("BrandVisualColor", i.id, i.revision)] as const,
    ),
    ...live.typography.map(
      (i) =>
        [i.id, revision("BrandVisualTypography", i.id, i.revision)] as const,
    ),
  ]);
  if (
    before.items.some(
      (i) => refs.get(i.itemId) !== i.businessStateReference.revisionToken,
    )
  )
    changed();
}
