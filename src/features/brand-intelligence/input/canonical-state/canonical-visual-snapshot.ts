import type { BrandVisualStateService } from "../../../brand-canonical-state/brand-visual-state.service";
import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import { InputDependencyError } from "../domain/input-dependency.error";
import type {
  BusinessStateReference,
  CanonicalBrandStateSnapshot,
  CanonicalVisualFact,
} from "./canonical-brand-state.port";

type VisualState = Awaited<ReturnType<BrandVisualStateService["read"]>>;

/** Deterministic normalization of application-owned IDs, within the reader's snapshot transaction. */
export function assembleCanonicalVisualSnapshot(
  base: CanonicalBrandStateSnapshot,
  state: VisualState,
): CanonicalBrandStateSnapshot {
  const rows = state
    ? [...state.assets, ...state.colors, ...state.typography]
    : [];
  if (
    state &&
    (state.brandProfileId !== base.brandId ||
      rows.some((r) => r.brandProfileId !== base.brandId) ||
      (state.primaryLogo &&
        (state.primaryLogo.brandProfileId !== base.brandId ||
          state.primaryLogo.id !== state.primaryLogoAssetId ||
          state.primaryLogo.lifecycle !== "ACTIVE" ||
          state.primaryLogo.role !== "LOGO")) ||
      (state.primaryLogoAssetId && !state.primaryLogo))
  ) {
    throw new InputDependencyError(
      "DEPENDENCY_SNAPSHOT_INCOHERENT",
      "Invalid canonical visual reference",
    );
  }
  const canonicalSnapshotRef = `canonical-snapshot:sha256:${sha256CanonicalExecution(
    {
      brandSnapshot: base.canonicalSnapshotRef,
      visual: state
        ? {
            revision: state.revision,
            primaryLogoAssetId: state.primaryLogoAssetId,
            items: rows.map((r) => ({
              id: r.id,
              revision: r.revision,
              authority: r.authority,
              lifecycle: r.lifecycle,
            })),
          }
        : null,
    },
  )}`;
  const reference = (
    entityType: BusinessStateReference["entityType"],
    entityId: string,
    revision: number,
  ): BusinessStateReference => ({
    entityType,
    entityId,
    semanticFieldPath: "$",
    revisionKind: "SNAPSHOT_FINGERPRINT",
    revisionToken: sha256CanonicalExecution({ entityType, entityId, revision }),
    observedAt: base.observedAt,
    canonicalSnapshotRef,
  });
  const items: CanonicalVisualFact[] = [];
  if (state) {
    for (const row of state.assets) {
      const role =
        row.id === state.primaryLogoAssetId
          ? "PRIMARY_LOGO"
          : row.role === "LOGO"
            ? null
            : row.role;
      if (!role) continue;
      items.push({
        brandId: row.brandProfileId,
        itemId: row.id,
        role,
        authority: row.authority,
        origin: row.origin,
        value: row.url,
        usage: row.label,
        businessStateReference: reference(
          "BrandVisualAsset",
          row.id,
          row.revision,
        ),
      });
    }
    for (const row of state.colors)
      items.push({
        brandId: row.brandProfileId,
        itemId: row.id,
        role: "PALETTE",
        authority: row.authority,
        origin: row.origin,
        value: row.value,
        usage: row.usage,
        businessStateReference: reference(
          "BrandVisualColor",
          row.id,
          row.revision,
        ),
      });
    for (const row of state.typography)
      items.push({
        brandId: row.brandProfileId,
        itemId: row.id,
        role: "TYPOGRAPHY",
        authority: row.authority,
        origin: row.origin,
        value: row.family,
        usage: row.usage,
        businessStateReference: reference(
          "BrandVisualTypography",
          row.id,
          row.revision,
        ),
      });
  }
  return {
    ...base,
    canonicalSnapshotRef,
    visualState: {
      brandId: base.brandId,
      stateReference: state
        ? reference("BrandVisualState", base.brandId, state.revision)
        : null,
      items: items.sort((a, b) => a.itemId.localeCompare(b.itemId)),
    },
  };
}
