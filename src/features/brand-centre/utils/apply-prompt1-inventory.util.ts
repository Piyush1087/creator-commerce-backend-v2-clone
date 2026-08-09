import { OfferingType, Prisma } from "@prisma/client";

import type {
  DeepScanInventoryEntity,
  DeepScanOfferLedgerRow,
} from "../schemas/deep-scan-prompt1.schema";

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
    const data = {
      name: entity.entityName,
      description: entity.briefDescription ?? null,
      imageUrl: entity.imageUrl ?? null,
      sellingPoints: entity.sellingPoints,
      doNotSay: entity.productDoNotSay ?? [],
      isDeepScanned: true,
    };

    if (existingId) {
      await tx.offering.update({
        where: { id: existingId },
        data,
      });
    } else {
      const created = await tx.offering.create({
        data: {
          brandProfileId,
          type: mapEntityTypeToOfferingType(entity.entityType),
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
      urlIndex.set(key, created.id);
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
