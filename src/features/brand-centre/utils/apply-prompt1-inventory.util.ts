import {
  CanonicalOfferingAuthority,
  CanonicalOfferingOrigin,
  CanonicalOfferingProtectionState,
  OfferingGuidanceKind,
  OfferingKind,
  OfferingLifecycle,
  OfferingType,
  Prisma,
} from "@prisma/client";

import type {
  DeepScanInventoryEntity,
  DeepScanOfferLedgerRow,
} from "../schemas/deep-scan-prompt1.schema";
import { canonicalOfferingType } from "../services/canonical-offering-state.service";

type Tx = Prisma.TransactionClient;

function normalizeUrlForMatch(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/$/, "");
  }
}

function mapEntityTypeToOfferingType(
  entityType: DeepScanInventoryEntity["entityType"],
): OfferingType {
  switch (entityType) {
    case "MODULE":
      return OfferingType.MODULE;
    case "TREATMENT":
      return OfferingType.TREATMENT;
    case "EXPERIENCE":
      return OfferingType.EXPERIENCE;
    case "COLLECTION":
      return OfferingType.COLLECTION;
    default:
      return OfferingType.PRODUCT;
  }
}

export async function applyPrompt1InventoryEntities(
  tx: Tx,
  brandProfileId: string,
  currencyCode: string,
  entities: DeepScanInventoryEntity[],
  existingOfferings: Array<{ id: string; url: string }>,
): Promise<void> {
  const urlIndex = new Map(
    existingOfferings.map((o) => [normalizeUrlForMatch(o.url), o.id]),
  );

  for (const entity of entities) {
    const key = normalizeUrlForMatch(entity.entityUrl);
    const existingId = urlIndex.get(key);
    const legacyType = mapEntityTypeToOfferingType(entity.entityType);
    const canonical = canonicalOfferingType(legacyType);
    const data = {
      name: entity.entityName,
      description: entity.briefDescription ?? null,
      imageUrl: entity.imageUrl ?? null,
      sellingPoints: entity.sellingPoints,
      doNotSay: entity.productDoNotSay ?? [],
      isDeepScanned: true,
    };

    if (existingId) {
      const [fieldStates, protectedGuidance] = await Promise.all([
        tx.offeringFieldState.findMany({
          where: {
            brandProfileId,
            offeringId: existingId,
            protectionState: CanonicalOfferingProtectionState.BRAND_CONFIRMED,
          },
          select: { semanticFieldPath: true },
        }),
        tx.offeringGuidanceItem.findMany({
          where: {
            brandProfileId,
            offeringId: existingId,
            lifecycle: "ACTIVE",
            protectionState: CanonicalOfferingProtectionState.BRAND_CONFIRMED,
          },
          select: { kind: true },
        }),
      ]);
      const protectedPaths = new Set(
        fieldStates.map((state) => state.semanticFieldPath),
      );
      const protectedKinds = new Set(
        protectedGuidance.map((item) => item.kind),
      );
      await tx.offering.update({
        where: { id: existingId },
        data: {
          ...data,
          name: protectedPaths.has("name") ? undefined : data.name,
          description: protectedPaths.has("description")
            ? undefined
            : data.description,
          imageUrl: protectedPaths.has("imageUrl") ? undefined : data.imageUrl,
          sellingPoints: protectedKinds.has(OfferingGuidanceKind.SELLING_POINT)
            ? undefined
            : data.sellingPoints,
          doNotSay: protectedKinds.has(OfferingGuidanceKind.DO_NOT_SAY)
            ? undefined
            : data.doNotSay,
        },
      });
      await syncObservedGuidance(
        tx,
        brandProfileId,
        existingId,
        entity,
        protectedKinds,
      );
      await syncObservedFieldStates(
        tx,
        brandProfileId,
        existingId,
        protectedPaths,
        canonical,
      );
    } else {
      const created = await tx.offering.create({
        data: {
          brandProfileId,
          type: legacyType,
          canonicalKind: canonical.kind,
          canonicalSubtype: canonical.subtype,
          canonicalLifecycle: OfferingLifecycle.ACTIVE,
          name: entity.entityName,
          url: entity.entityUrl,
          description: entity.briefDescription,
          imageUrl: entity.imageUrl,
          sellingPoints: entity.sellingPoints,
          doNotSay: entity.productDoNotSay ?? [],
          currency: currencyCode,
          isDeepScanned: true,
        },
      });
      await syncObservedGuidance(
        tx,
        brandProfileId,
        created.id,
        entity,
        new Set(),
      );
      await syncObservedFieldStates(
        tx,
        brandProfileId,
        created.id,
        new Set(),
        canonical,
      );
      urlIndex.set(key, created.id);
    }
  }
}

async function syncObservedFieldStates(
  tx: Tx,
  brandProfileId: string,
  offeringId: string,
  protectedPaths: ReadonlySet<string>,
  canonical: Readonly<{ kind: OfferingKind | null; subtype: string | null }>,
): Promise<void> {
  const paths = [
    "name",
    "description",
    ...(canonical.kind ? ["canonicalKind"] : []),
    ...(canonical.subtype ? ["canonicalSubtype"] : []),
  ];
  for (const semanticFieldPath of paths) {
    if (protectedPaths.has(semanticFieldPath)) continue;
    await tx.offeringFieldState.upsert({
      where: {
        brandProfileId_offeringId_semanticFieldPath: {
          brandProfileId,
          offeringId,
          semanticFieldPath,
        },
      },
      create: {
        brandProfileId,
        offeringId,
        semanticFieldPath,
        authority: CanonicalOfferingAuthority.OBSERVED,
        origin: CanonicalOfferingOrigin.DEEP_SCAN,
        provenance: { source: "DEEP_SCAN_PROMPT_1" },
      },
      update: {
        authority: CanonicalOfferingAuthority.OBSERVED,
        origin: CanonicalOfferingOrigin.DEEP_SCAN,
        provenance: { source: "DEEP_SCAN_PROMPT_1" },
        revision: { increment: 1 },
      },
    });
  }
}

async function syncObservedGuidance(
  tx: Tx,
  brandProfileId: string,
  offeringId: string,
  entity: DeepScanInventoryEntity,
  protectedKinds: ReadonlySet<OfferingGuidanceKind>,
): Promise<void> {
  const rows: Array<{
    kind: OfferingGuidanceKind;
    values: readonly string[];
  }> = [
    { kind: OfferingGuidanceKind.SELLING_POINT, values: entity.sellingPoints },
    {
      kind: OfferingGuidanceKind.DO_NOT_SAY,
      values: entity.productDoNotSay ?? [],
    },
  ];
  for (const row of rows) {
    if (protectedKinds.has(row.kind)) continue;
    await tx.offeringGuidanceItem.updateMany({
      where: {
        brandProfileId,
        offeringId,
        kind: row.kind,
        lifecycle: "ACTIVE",
        protectionState: CanonicalOfferingProtectionState.UNPROTECTED,
      },
      data: { lifecycle: "INACTIVE", revision: { increment: 1 } },
    });
    const values = row.values.map((value) => value.trim()).filter(Boolean);
    if (values.length) {
      await tx.offeringGuidanceItem.createMany({
        data: values.map((text, presentationOrder) => ({
          brandProfileId,
          offeringId,
          kind: row.kind,
          text,
          presentationOrder,
          authority: CanonicalOfferingAuthority.OBSERVED,
          origin: CanonicalOfferingOrigin.DEEP_SCAN,
          protectionState: CanonicalOfferingProtectionState.UNPROTECTED,
          provenance: { source: "DEEP_SCAN_PROMPT_1" },
        })),
      });
    }
  }
}

export async function applyPrompt1OffersLedger(
  tx: Tx,
  brandProfileId: string,
  offers: DeepScanOfferLedgerRow[],
): Promise<void> {
  for (const offer of offers) {
    const promoCode = offer.promoCode.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (promoCode.length < 2) {
      continue;
    }
    await tx.brandOffer.upsert({
      where: {
        brandProfileId_promoCode: { brandProfileId, promoCode },
      },
      create: {
        brandProfileId,
        offerName: offer.offerName,
        promoCode,
        applicabilityScope: offer.applicabilityScope,
        validityStart: new Date(offer.validityStart),
        validityEnd: new Date(offer.validityEnd),
        description: offer.description,
      },
      update: {
        offerName: offer.offerName,
        applicabilityScope: offer.applicabilityScope,
        validityStart: new Date(offer.validityStart),
        validityEnd: new Date(offer.validityEnd),
        description: offer.description,
        isActive: true,
      },
    });
  }
}

export function normalizeSocialHandle(
  handle: string | null | undefined,
): string | null {
  if (!handle?.trim()) {
    return null;
  }
  const trimmed = handle.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}
