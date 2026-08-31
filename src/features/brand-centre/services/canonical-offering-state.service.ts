import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CanonicalOfferingAuthority,
  CanonicalOfferingItemLifecycle,
  CanonicalOfferingOrigin,
  CanonicalOfferingProtectionState,
  OfferingGuidanceKind,
  OfferingKind,
  OfferingLifecycle,
  OfferingPriceFreshness,
  OfferingPriceMode,
  OfferingType,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

export const OFFERING_MEDIA_ACTIVE_CAP = 7;

export function canonicalOfferingType(
  type: OfferingType,
): Readonly<{ kind: OfferingKind | null; subtype: string | null }> {
  switch (type) {
    case OfferingType.PRODUCT:
      return { kind: OfferingKind.PRODUCT, subtype: null };
    case OfferingType.SERVICE:
      return { kind: OfferingKind.SERVICE, subtype: null };
    case OfferingType.EXPERIENCE:
      return { kind: OfferingKind.EXPERIENCE, subtype: null };
    case OfferingType.COLLECTION:
      return { kind: OfferingKind.BUNDLE, subtype: null };
    case OfferingType.TREATMENT:
      return { kind: OfferingKind.SERVICE, subtype: "TREATMENT" };
    case OfferingType.MODULE:
      return { kind: null, subtype: null };
  }
}

export interface CanonicalPriceInput {
  readonly mode: OfferingPriceMode;
  readonly currentMinAmount?: Prisma.Decimal.Value | null;
  readonly currentMaxAmount?: Prisma.Decimal.Value | null;
  readonly regularMinAmount?: Prisma.Decimal.Value | null;
  readonly regularMaxAmount?: Prisma.Decimal.Value | null;
  readonly currency: string;
  readonly freshness: OfferingPriceFreshness;
  readonly authority: CanonicalOfferingAuthority;
  readonly origin: CanonicalOfferingOrigin;
  readonly sourceClass: string;
  readonly sourceRef?: string | null;
  readonly observedAt?: Date | null;
  readonly freshnessEvaluatedAt: Date;
  readonly provenance?: Prisma.InputJsonValue;
  readonly conflicting?: boolean;
}

export type ControlledPriceRefreshGuardCode =
  | "INACTIVE_OFFERING"
  | "MANUAL_PRICE_PROTECTED";

export class ControlledPriceRefreshGuardError extends ConflictException {
  constructor(readonly guardCode: ControlledPriceRefreshGuardCode) {
    super(`Controlled price refresh rejected: ${guardCode}`);
  }
}

export interface CanonicalPriceWriteOptions {
  readonly controlledRefresh?: boolean;
}

@Injectable()
export class CanonicalOfferingStateService {
  constructor(private readonly prisma: PrismaService) {}

  async createCanonical(
    input: Readonly<{
      brandProfileId: string;
      legacyType: OfferingType;
      name: string;
      url: string;
      lifecycle: OfferingLifecycle;
      description?: string;
    }>,
  ) {
    const canonical = canonicalOfferingType(input.legacyType);
    if (!input.lifecycle || !canonical.kind) {
      throw new BadRequestException(
        "Canonical Offering writes require resolved kind and lifecycle",
      );
    }
    const created = await this.prisma.offering.create({
      data: {
        brandProfileId: input.brandProfileId,
        type: input.legacyType,
        canonicalKind: canonical.kind,
        canonicalSubtype: canonical.subtype,
        canonicalLifecycle: input.lifecycle,
        isActive: input.lifecycle === OfferingLifecycle.ACTIVE,
        name: input.name,
        url: input.url,
        description: input.description,
      },
    });
    await this.confirmFields(input.brandProfileId, created.id, {
      name: input.name,
      url: input.url,
      ...(input.description ? { description: input.description } : {}),
      canonicalKind: canonical.kind,
      ...(canonical.subtype ? { canonicalSubtype: canonical.subtype } : {}),
    });
    return created;
  }

  async setLifecycle(
    brandProfileId: string,
    offeringId: string,
    lifecycle: OfferingLifecycle,
  ) {
    const updated = await this.prisma.offering.updateMany({
      where: { id: offeringId, brandProfileId },
      data: {
        canonicalLifecycle: lifecycle,
        isActive: lifecycle === OfferingLifecycle.ACTIVE,
      },
    });
    if (updated.count !== 1) throw new NotFoundException("Offering not found");
    return this.read(brandProfileId, offeringId);
  }

  async confirmFields(
    brandProfileId: string,
    offeringId: string,
    fields: Readonly<Record<string, unknown>>,
    origin = CanonicalOfferingOrigin.BRAND_EDIT,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.requireOffering(tx, brandProfileId, offeringId);
      for (const semanticFieldPath of Object.keys(fields)) {
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
            authority: CanonicalOfferingAuthority.BRAND_CONFIRMED,
            origin,
            protectionState: CanonicalOfferingProtectionState.BRAND_CONFIRMED,
            provenance: { actor: "BRAND", operation: "FIELD_EDIT" },
          },
          update: {
            authority: CanonicalOfferingAuthority.BRAND_CONFIRMED,
            origin,
            protectionState: CanonicalOfferingProtectionState.BRAND_CONFIRMED,
            provenance: { actor: "BRAND", operation: "FIELD_EDIT" },
            revision: { increment: 1 },
          },
        });
      }
    });
  }

  async replaceBrandGuidance(
    brandProfileId: string,
    offeringId: string,
    kind: OfferingGuidanceKind,
    values: readonly string[],
  ): Promise<void> {
    const normalized = values.map((value) => value.trim()).filter(Boolean);
    await this.prisma.$transaction(async (tx) => {
      await this.requireOffering(tx, brandProfileId, offeringId);
      await tx.offeringGuidanceItem.updateMany({
        where: { brandProfileId, offeringId, kind, lifecycle: "ACTIVE" },
        data: {
          lifecycle: CanonicalOfferingItemLifecycle.INACTIVE,
          origin: CanonicalOfferingOrigin.BRAND_EDIT,
          revision: { increment: 1 },
        },
      });
      if (normalized.length) {
        await tx.offeringGuidanceItem.createMany({
          data: normalized.map((text, presentationOrder) => ({
            brandProfileId,
            offeringId,
            kind,
            text,
            presentationOrder,
            authority: CanonicalOfferingAuthority.BRAND_CONFIRMED,
            origin: CanonicalOfferingOrigin.BRAND_EDIT,
            protectionState: CanonicalOfferingProtectionState.BRAND_CONFIRMED,
            provenance: { actor: "BRAND", operation: "GUIDANCE_REPLACE" },
          })),
        });
      }
      await tx.offering.update({
        where: { id: offeringId },
        data:
          kind === OfferingGuidanceKind.SELLING_POINT
            ? { sellingPoints: normalized, isUserEdited: true }
            : { doNotSay: normalized, isUserEdited: true },
      });
    });
  }

  async advancePrice(
    brandProfileId: string,
    offeringId: string,
    expectedStateRevision: number | null,
    input: CanonicalPriceInput,
    options: CanonicalPriceWriteOptions = {},
  ) {
    if (input.conflicting) {
      throw new ConflictException(
        "Conflicting price input cannot advance current state",
      );
    }
    this.assertPrice(input);
    return this.prisma.$transaction(
      async (tx) => {
        const offering = await this.requireOffering(
          tx,
          brandProfileId,
          offeringId,
        );
        let state = await tx.offeringPriceState.findUnique({
          where: { offeringId },
          include: { currentRevision: true },
        });
        if (options.controlledRefresh) {
          if (offering.canonicalLifecycle !== OfferingLifecycle.ACTIVE) {
            throw new ControlledPriceRefreshGuardError("INACTIVE_OFFERING");
          }
          if (
            state?.currentRevision?.authority ===
              CanonicalOfferingAuthority.BRAND_CONFIRMED ||
            state?.currentRevision?.origin ===
              CanonicalOfferingOrigin.BRAND_EDIT ||
            state?.currentRevision?.origin ===
              CanonicalOfferingOrigin.BRAND_UPLOAD
          ) {
            throw new ControlledPriceRefreshGuardError(
              "MANUAL_PRICE_PROTECTED",
            );
          }
        }
        if (!state) {
          if (expectedStateRevision !== null) this.casConflict();
          state = await tx.offeringPriceState.create({
            data: { brandProfileId, offeringId },
            include: { currentRevision: true },
          });
        } else if (
          expectedStateRevision === null ||
          state.revision !== expectedStateRevision
        ) {
          this.casConflict();
        }
        const revision = await tx.offeringPriceRevision.create({
          data: {
            brandProfileId,
            offeringId,
            mode: input.mode,
            currentMinAmount: input.currentMinAmount,
            currentMaxAmount: input.currentMaxAmount,
            regularMinAmount: input.regularMinAmount,
            regularMaxAmount: input.regularMaxAmount,
            currency: input.currency.toUpperCase(),
            freshness: input.freshness,
            authority: input.authority,
            origin: input.origin,
            sourceClass: input.sourceClass,
            sourceRef: input.sourceRef,
            observedAt: input.observedAt,
            freshnessEvaluatedAt: input.freshnessEvaluatedAt,
            provenance: input.provenance,
            predecessorRevisionId: state.currentRevisionId,
          },
        });
        const advanced = await tx.offeringPriceState.updateMany({
          where: {
            offeringId,
            brandProfileId,
            revision: state.revision,
            currentRevisionId: state.currentRevisionId,
          },
          data: {
            currentRevisionId: revision.id,
            revision: { increment: state.currentRevisionId ? 1 : 0 },
          },
        });
        if (advanced.count !== 1) this.casConflict();
        await this.mirrorLegacyPrice(tx, offeringId, input);
        return revision;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async markPriceStale(
    brandProfileId: string,
    offeringId: string,
    expectedStateRevision: number,
    freshness: Extract<OfferingPriceFreshness, "STALE" | "UNKNOWN">,
    evaluatedAt: Date,
    options: Readonly<{
      controlledRefresh?: boolean;
      sourceRef?: string;
      observedAt?: Date;
      provenance?: Prisma.InputJsonValue;
    }> = {},
  ) {
    const current = await this.prisma.offeringPriceState.findFirst({
      where: { offeringId, brandProfileId },
      include: { currentRevision: true },
    });
    if (
      !current?.currentRevision ||
      current.revision !== expectedStateRevision
    ) {
      this.casConflict();
    }
    const value = current.currentRevision;
    return this.advancePrice(
      brandProfileId,
      offeringId,
      expectedStateRevision,
      {
        mode: value.mode,
        currentMinAmount: value.currentMinAmount,
        currentMaxAmount: value.currentMaxAmount,
        regularMinAmount: value.regularMinAmount,
        regularMaxAmount: value.regularMaxAmount,
        currency: value.currency,
        freshness,
        authority: options.controlledRefresh
          ? CanonicalOfferingAuthority.APPLICATION_CANONICAL
          : value.authority,
        origin: options.controlledRefresh
          ? CanonicalOfferingOrigin.CONTROLLED_PRICE_REFRESH
          : value.origin,
        sourceClass: options.controlledRefresh
          ? "OWNED_WEBSITE_COMMERCIAL_EVIDENCE"
          : value.sourceClass,
        sourceRef: options.sourceRef ?? value.sourceRef,
        observedAt: options.observedAt ?? value.observedAt,
        freshnessEvaluatedAt: evaluatedAt,
        provenance:
          options.provenance ??
          ({
            transition: "PUBLIC_PRICE_DISAPPEARED_VALUE_RETAINED",
          } as Prisma.InputJsonValue),
      },
      { controlledRefresh: options.controlledRefresh },
    );
  }

  async addMedia(
    brandProfileId: string,
    offeringId: string,
    input: Readonly<{
      url: string;
      label?: string;
      altText?: string;
      makePrimary?: boolean;
      authority: CanonicalOfferingAuthority;
      origin: CanonicalOfferingOrigin;
      provenance?: Prisma.InputJsonValue;
    }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.requireOffering(tx, brandProfileId, offeringId);
      const state = await tx.offeringMediaState.upsert({
        where: { offeringId },
        create: { brandProfileId, offeringId },
        update: {},
      });
      const activeCount = await tx.offeringMediaAsset.count({
        where: { brandProfileId, offeringId, lifecycle: "ACTIVE" },
      });
      if (activeCount >= OFFERING_MEDIA_ACTIVE_CAP) {
        throw new ConflictException("Offering media active cap exceeded");
      }
      const asset = await tx.offeringMediaAsset.create({
        data: {
          brandProfileId,
          offeringId,
          url: input.url,
          label: input.label,
          altText: input.altText,
          presentationOrder: activeCount,
          authority: input.authority,
          origin: input.origin,
          provenance: input.provenance,
        },
      });
      if (input.makePrimary || !state.primaryMediaAssetId) {
        await tx.offeringMediaState.update({
          where: { offeringId },
          data: { primaryMediaAssetId: asset.id, revision: { increment: 1 } },
        });
      }
      return asset;
    });
  }

  async addBundleMember(
    brandProfileId: string,
    bundleOfferingId: string,
    productOfferingId: string,
  ) {
    return this.prisma.offeringBundleMember.create({
      data: {
        brandProfileId,
        bundleOfferingId,
        productOfferingId,
        authority: CanonicalOfferingAuthority.APPLICATION_CANONICAL,
        origin: CanonicalOfferingOrigin.APPLICATION_WORKFLOW,
      },
    });
  }

  async addLocationAvailability(
    brandProfileId: string,
    offeringId: string,
    locationId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const edge = await tx.offeringLocationAvailability.create({
        data: {
          brandProfileId,
          offeringId,
          locationId,
          authority: CanonicalOfferingAuthority.APPLICATION_CANONICAL,
          origin: CanonicalOfferingOrigin.APPLICATION_WORKFLOW,
        },
      });
      const active = await tx.offeringLocationAvailability.findMany({
        where: { brandProfileId, offeringId, lifecycle: "ACTIVE" },
        select: { locationId: true },
        orderBy: { locationId: "asc" },
      });
      await tx.offering.update({
        where: { id: offeringId },
        data: { locationIds: active.map((item) => item.locationId) },
      });
      return edge;
    });
  }

  async addOfferApplicability(
    brandProfileId: string,
    brandOfferId: string,
    offeringId: string,
  ) {
    return this.prisma.brandOfferOffering.create({
      data: {
        brandProfileId,
        brandOfferId,
        offeringId,
        authority: CanonicalOfferingAuthority.APPLICATION_CANONICAL,
        origin: CanonicalOfferingOrigin.APPLICATION_WORKFLOW,
      },
    });
  }

  read(brandProfileId: string, offeringId: string) {
    return this.prisma.offering.findFirst({
      where: { id: offeringId, brandProfileId },
      include: {
        fieldStates: true,
        guidanceItems: {
          where: { lifecycle: "ACTIVE" },
          orderBy: { presentationOrder: "asc" },
        },
        priceState: { include: { currentRevision: true } },
        mediaState: {
          include: {
            primaryMediaAsset: true,
            assets: {
              where: { lifecycle: "ACTIVE" },
              orderBy: { presentationOrder: "asc" },
            },
          },
        },
        bundleMemberships: { where: { lifecycle: "ACTIVE" } },
        productBundleMemberships: { where: { lifecycle: "ACTIVE" } },
        locationAvailability: { where: { lifecycle: "ACTIVE" } },
        offerApplicability: { where: { lifecycle: "ACTIVE" } },
      },
    });
  }

  private async requireOffering(
    tx: Prisma.TransactionClient,
    brandProfileId: string,
    offeringId: string,
  ) {
    const offering = await tx.offering.findUnique({
      where: { brandProfileId_id: { brandProfileId, id: offeringId } },
    });
    if (!offering) throw new NotFoundException("Offering not found");
    return offering;
  }

  private assertPrice(input: CanonicalPriceInput): void {
    if (!/^[A-Z]{3}$/u.test(input.currency.toUpperCase())) {
      throw new ConflictException(
        "Price currency must be an ISO-style three-letter code",
      );
    }
    const min =
      input.currentMinAmount == null
        ? null
        : new Prisma.Decimal(input.currentMinAmount);
    const max =
      input.currentMaxAmount == null
        ? null
        : new Prisma.Decimal(input.currentMaxAmount);
    if (input.mode === OfferingPriceMode.NOT_PUBLICLY_LISTED) {
      if (
        min !== null ||
        max !== null ||
        input.regularMinAmount != null ||
        input.regularMaxAmount != null
      )
        throw new ConflictException(
          "Non-public price cannot carry amount fields",
        );
      return;
    }
    if (min === null)
      throw new ConflictException("Price mode requires a current amount");
    if (
      input.mode === OfferingPriceMode.RANGE &&
      (max === null || min.gt(max))
    ) {
      throw new ConflictException("Price range is invalid");
    }
    if (
      input.mode !== OfferingPriceMode.RANGE &&
      max !== null &&
      !min.equals(max)
    ) {
      throw new ConflictException("Only RANGE may carry a distinct maximum");
    }
  }

  private async mirrorLegacyPrice(
    tx: Prisma.TransactionClient,
    offeringId: string,
    input: CanonicalPriceInput,
  ): Promise<void> {
    const min =
      input.currentMinAmount == null
        ? null
        : new Prisma.Decimal(input.currentMinAmount);
    const max =
      input.currentMaxAmount == null
        ? null
        : new Prisma.Decimal(input.currentMaxAmount);
    const label =
      input.mode === OfferingPriceMode.NOT_PUBLICLY_LISTED
        ? "Not publicly listed"
        : input.mode === OfferingPriceMode.STARTING_AT
          ? `From ${input.currency.toUpperCase()} ${min!.toFixed(2)}`
          : input.mode === OfferingPriceMode.RANGE
            ? `${input.currency.toUpperCase()} ${min!.toFixed(2)}–${max!.toFixed(2)}`
            : `${input.currency.toUpperCase()} ${min!.toFixed(2)}`;
    await tx.offering.update({
      where: { id: offeringId },
      data: {
        priceAmount: input.mode === OfferingPriceMode.EXACT ? min : null,
        startingPriceLabel: label,
        currency: input.currency.toUpperCase(),
      },
    });
  }

  private casConflict(): never {
    throw new ConflictException("Canonical Offering state revision conflict");
  }
}
