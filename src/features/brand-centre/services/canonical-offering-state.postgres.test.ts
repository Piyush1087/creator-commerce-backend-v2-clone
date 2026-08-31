import { randomUUID } from "node:crypto";
import {
  CanonicalOfferingAuthority,
  CanonicalOfferingOrigin,
  OfferingGuidanceKind,
  OfferingKind,
  OfferingLifecycle,
  OfferingPriceFreshness,
  OfferingPriceMode,
  OfferingType,
  PrismaClient,
} from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import {
  canonicalOfferingType,
  CanonicalOfferingStateService,
  OFFERING_MEDIA_ACTIVE_CAP,
} from "./canonical-offering-state.service";

describe("canonical Offering deterministic type mapping", () => {
  it.each([
    [OfferingType.PRODUCT, OfferingKind.PRODUCT, null],
    [OfferingType.SERVICE, OfferingKind.SERVICE, null],
    [OfferingType.EXPERIENCE, OfferingKind.EXPERIENCE, null],
    [OfferingType.COLLECTION, OfferingKind.BUNDLE, null],
    [OfferingType.TREATMENT, OfferingKind.SERVICE, "TREATMENT"],
    [OfferingType.MODULE, null, null],
  ] as const)("maps %s without guessing", (legacy, kind, subtype) => {
    expect(canonicalOfferingType(legacy)).toEqual({ kind, subtype });
  });
});

describe.skipIf(process.env.BRAND_CENTRE_DATABASE_TEST !== "true")(
  "canonical Offering PostgreSQL foundation",
  () => {
    const prisma = new PrismaClient();
    const service = new CanonicalOfferingStateService(
      prisma as unknown as PrismaService,
    );
    const now = () => new Date();
    const brand = () =>
      prisma.brandProfile.create({
        data: {
          domain: `${randomUUID()}.offering.test`,
          name: "Offering test",
          industry: "D2C",
        },
      });
    const offering = (
      brandProfileId: string,
      kind: OfferingKind = OfferingKind.PRODUCT,
      lifecycle: OfferingLifecycle = OfferingLifecycle.ACTIVE,
    ) =>
      prisma.offering.create({
        data: {
          brandProfileId,
          type:
            kind === OfferingKind.BUNDLE
              ? OfferingType.COLLECTION
              : OfferingType.PRODUCT,
          canonicalKind: kind,
          canonicalLifecycle: lifecycle,
          name: `${kind} ${randomUUID()}`,
          url: `https://offering.test/${randomUUID()}`,
        },
      });
    const confirmed = {
      authority: CanonicalOfferingAuthority.BRAND_CONFIRMED,
      origin: CanonicalOfferingOrigin.BRAND_EDIT,
    } as const;
    const observed = {
      authority: CanonicalOfferingAuthority.OBSERVED,
      origin: CanonicalOfferingOrigin.SURFACE_SCAN,
    } as const;
    const price = (
      mode: OfferingPriceMode,
      amounts: {
        currentMinAmount?: number;
        currentMaxAmount?: number;
        regularMinAmount?: number;
        regularMaxAmount?: number;
      } = {},
    ) => ({
      mode,
      ...amounts,
      currency: "USD",
      freshness: OfferingPriceFreshness.CURRENT,
      authority: CanonicalOfferingAuthority.APPLICATION_CANONICAL,
      origin: CanonicalOfferingOrigin.CONTROLLED_PRICE_REFRESH,
      sourceClass: "EXPLICIT_TEST_INPUT",
      freshnessEvaluatedAt: now(),
    });

    afterAll(() => prisma.$disconnect());

    it.skipIf(process.env.P1B1_HISTORICAL_UPGRADE_TEST !== "true")(
      "proves the conservative 49-to-50 historical backfill",
      async () => {
        const rows = await prisma.offering.findMany({
          where: { id: { startsWith: "a-" } },
          orderBy: { id: "asc" },
          include: {
            fieldStates: true,
            guidanceItems: true,
            priceState: true,
            mediaState: { include: { primaryMediaAsset: true } },
            locationAvailability: true,
          },
        });
        expect(rows).toHaveLength(7);
        expect(
          Object.fromEntries(
            rows.map((row) => [
              row.type,
              [row.canonicalKind, row.canonicalSubtype],
            ]),
          ),
        ).toMatchObject({
          PRODUCT: ["PRODUCT", null],
          SERVICE: ["SERVICE", null],
          EXPERIENCE: ["EXPERIENCE", null],
          COLLECTION: ["BUNDLE", null],
          TREATMENT: ["SERVICE", "TREATMENT"],
          MODULE: [null, null],
        });
        expect(
          rows.find((row) => row.id === "a-inactive")!.canonicalLifecycle,
        ).toBeNull();
        expect(
          rows.filter(
            (row) => row.isActive && row.canonicalLifecycle === "ACTIVE",
          ),
        ).toHaveLength(6);
        expect(
          rows.every((row) =>
            row.fieldStates.every(
              (state) => state.authority === "LEGACY_UNVERIFIED",
            ),
          ),
        ).toBe(true);
        expect(
          rows
            .flatMap((row) => row.guidanceItems)
            .every((item) => item.authority === "LEGACY_UNVERIFIED"),
        ).toBe(true);
        expect(rows.every((row) => row.priceState === null)).toBe(true);
        expect(rows.every((row) => row.locationAvailability.length === 0)).toBe(
          true,
        );
        const legacyProduct = rows.find((row) => row.id === "a-product")!;
        expect(legacyProduct.locationIds).toEqual(["loc-a"]);
        expect(legacyProduct.mediaState!.primaryMediaAsset!.authority).toBe(
          "LEGACY_UNVERIFIED",
        );
      },
    );

    it("requires resolved kind and lifecycle for the canonical creation path and mirrors lifecycle", async () => {
      const b = await brand();
      await expect(
        service.createCanonical({
          brandProfileId: b.id,
          legacyType: OfferingType.MODULE,
          lifecycle: OfferingLifecycle.ACTIVE,
          name: "Ambiguous module",
          url: "https://offering.test/module",
        }),
      ).rejects.toThrow("require resolved kind and lifecycle");
      const created = await service.createCanonical({
        brandProfileId: b.id,
        legacyType: OfferingType.TREATMENT,
        lifecycle: OfferingLifecycle.DRAFT_INCOMPLETE,
        name: "Treatment",
        url: "https://offering.test/treatment",
      });
      expect(created).toMatchObject({
        canonicalKind: "SERVICE",
        canonicalSubtype: "TREATMENT",
        canonicalLifecycle: "DRAFT_INCOMPLETE",
        isActive: false,
      });
      expect(
        (await service.setLifecycle(
          b.id,
          created.id,
          OfferingLifecycle.ACTIVE,
        ))!.isActive,
      ).toBe(true);
      expect(
        (await service.setLifecycle(
          b.id,
          created.id,
          OfferingLifecycle.PAUSED_INACTIVE,
        ))!.isActive,
      ).toBe(false);
    });

    it("protects Brand-confirmed scalar fields and guidance while retaining durable items", async () => {
      const b = await brand();
      const item = await offering(b.id);
      await service.confirmFields(b.id, item.id, { name: item.name });
      const state = await prisma.offeringFieldState.findFirstOrThrow({
        where: { offeringId: item.id },
      });
      await expect(
        prisma.offeringFieldState.update({
          where: { id: state.id },
          data: { authority: CanonicalOfferingAuthority.OBSERVED },
        }),
      ).rejects.toThrow();
      await service.replaceBrandGuidance(
        b.id,
        item.id,
        OfferingGuidanceKind.DO_NOT_SAY,
        ["Never claim cures"],
      );
      const guidance = await prisma.offeringGuidanceItem.findFirstOrThrow({
        where: { offeringId: item.id },
      });
      await expect(
        prisma.offeringGuidanceItem.update({
          where: { id: guidance.id },
          data: {
            text: "Automated overwrite",
            origin: CanonicalOfferingOrigin.DEEP_SCAN,
          },
        }),
      ).rejects.toThrow();
      await service.replaceBrandGuidance(
        b.id,
        item.id,
        OfferingGuidanceKind.DO_NOT_SAY,
        ["Approved replacement"],
      );
      expect(
        await prisma.offeringGuidanceItem.count({
          where: { offeringId: item.id },
        }),
      ).toBe(2);
      expect(
        (await prisma.offering.findUniqueOrThrow({ where: { id: item.id } }))
          .doNotSay,
      ).toEqual(["Approved replacement"]);
    });

    it("validates every price mode, retains stale values, and enforces CAS plus immutable history", async () => {
      const b = await brand();
      const exact = await offering(b.id);
      const starting = await offering(b.id);
      const range = await offering(b.id);
      const hidden = await offering(b.id);
      await service.advancePrice(
        b.id,
        exact.id,
        null,
        price(OfferingPriceMode.EXACT, {
          currentMinAmount: 25,
          regularMinAmount: 30,
        }),
      );
      await service.advancePrice(
        b.id,
        starting.id,
        null,
        price(OfferingPriceMode.STARTING_AT, { currentMinAmount: 10 }),
      );
      await service.advancePrice(
        b.id,
        range.id,
        null,
        price(OfferingPriceMode.RANGE, {
          currentMinAmount: 10,
          currentMaxAmount: 20,
          regularMinAmount: 15,
          regularMaxAmount: 25,
        }),
      );
      await service.advancePrice(
        b.id,
        hidden.id,
        null,
        price(OfferingPriceMode.NOT_PUBLICLY_LISTED),
      );
      await expect(
        service.advancePrice(
          b.id,
          range.id,
          1,
          price(OfferingPriceMode.RANGE, {
            currentMinAmount: 20,
            currentMaxAmount: 10,
          }),
        ),
      ).rejects.toThrow("range is invalid");
      const beforeConflict = await prisma.offeringPriceRevision.count({
        where: { offeringId: exact.id },
      });
      await expect(
        service.advancePrice(b.id, exact.id, 1, {
          ...price(OfferingPriceMode.EXACT, { currentMinAmount: 26 }),
          conflicting: true,
        }),
      ).rejects.toThrow("cannot advance");
      expect(
        await prisma.offeringPriceRevision.count({
          where: { offeringId: exact.id },
        }),
      ).toBe(beforeConflict);
      const stale = await service.markPriceStale(
        b.id,
        exact.id,
        1,
        OfferingPriceFreshness.STALE,
        now(),
      );
      expect(stale).toMatchObject({
        mode: "EXACT",
        freshness: "STALE",
        currency: "USD",
      });
      expect(stale.currentMinAmount.toString()).toBe("25");
      const attempts = await Promise.allSettled([
        service.advancePrice(
          b.id,
          exact.id,
          2,
          price(OfferingPriceMode.EXACT, { currentMinAmount: 27 }),
        ),
        service.advancePrice(
          b.id,
          exact.id,
          2,
          price(OfferingPriceMode.EXACT, { currentMinAmount: 28 }),
        ),
      ]);
      expect(
        attempts.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        attempts.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      const revision = await prisma.offeringPriceRevision.findFirstOrThrow({
        where: { offeringId: exact.id },
      });
      await expect(
        prisma.offeringPriceRevision.update({
          where: { id: revision.id },
          data: { currency: "EUR" },
        }),
      ).rejects.toThrow();
      expect(
        (await prisma.offering.findUniqueOrThrow({ where: { id: range.id } }))
          .startingPriceLabel,
      ).toContain("USD 10.00");
    });

    it("enforces media ownership, one primary, active cap, deactivation guard, and legacy projection", async () => {
      const b = await brand();
      const foreign = await brand();
      const item = await offering(b.id);
      const other = await offering(b.id);
      const primary = await service.addMedia(b.id, item.id, {
        url: "https://media.test/primary.jpg",
        makePrimary: true,
        ...confirmed,
      });
      for (let index = 1; index < OFFERING_MEDIA_ACTIVE_CAP; index += 1) {
        await service.addMedia(b.id, item.id, {
          url: `https://media.test/${index}.jpg`,
          ...observed,
        });
      }
      await expect(
        service.addMedia(b.id, item.id, {
          url: "https://media.test/eighth.jpg",
          ...observed,
        }),
      ).rejects.toThrow("cap exceeded");
      expect(
        (await prisma.offering.findUniqueOrThrow({ where: { id: item.id } }))
          .imageUrl,
      ).toBe(primary.url);
      await expect(
        prisma.offeringMediaAsset.update({
          where: { id: primary.id },
          data: { lifecycle: "INACTIVE" },
        }),
      ).rejects.toThrow();
      const otherAsset = await service.addMedia(b.id, other.id, {
        url: "https://media.test/other.jpg",
        ...observed,
      });
      await expect(
        prisma.offeringMediaState.update({
          where: { offeringId: item.id },
          data: { primaryMediaAssetId: otherAsset.id },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.offeringMediaAsset.create({
          data: {
            brandProfileId: foreign.id,
            offeringId: item.id,
            url: "https://media.test/foreign.jpg",
            ...observed,
          },
        }),
      ).rejects.toThrow();
      expect(
        await prisma.offeringMediaAsset.count({
          where: { offeringId: item.id, lifecycle: "ACTIVE" },
        }),
      ).toBe(7);
    });

    it("supports exact same-Brand M:N Product membership while rejecting self, nested, kind, and cross-Brand edges", async () => {
      const b = await brand();
      const foreign = await brand();
      const bundle1 = await offering(b.id, OfferingKind.BUNDLE);
      const bundle2 = await offering(b.id, OfferingKind.BUNDLE);
      const product = await offering(b.id);
      const serviceItem = await offering(b.id, OfferingKind.SERVICE);
      await service.addBundleMember(b.id, bundle1.id, product.id);
      await service.addBundleMember(b.id, bundle2.id, product.id);
      expect(
        await prisma.offeringBundleMember.count({
          where: { productOfferingId: product.id },
        }),
      ).toBe(2);
      await expect(
        service.addBundleMember(b.id, bundle1.id, bundle1.id),
      ).rejects.toThrow();
      await expect(
        service.addBundleMember(b.id, bundle1.id, bundle2.id),
      ).rejects.toThrow();
      await expect(
        service.addBundleMember(b.id, bundle1.id, serviceItem.id),
      ).rejects.toThrow();
      await expect(
        service.addBundleMember(foreign.id, bundle1.id, product.id),
      ).rejects.toThrow();
    });

    it("creates exact Location and Offer edges only, mirrors exact location IDs, and rejects cross-Brand relations", async () => {
      const b = await brand();
      const foreign = await brand();
      const item = await offering(b.id);
      const secondItem = await offering(b.id);
      const location = await prisma.location.create({
        data: { brandProfileId: b.id, address: "1 Exact Street" },
      });
      const foreignLocation = await prisma.location.create({
        data: { brandProfileId: foreign.id, address: "2 Foreign Street" },
      });
      const offer = await prisma.brandOffer.create({
        data: {
          brandProfileId: b.id,
          offerName: "Exact offer",
          promoCode: randomUUID(),
          applicabilityScope: "free text remains free text",
          validityStart: now(),
          validityEnd: new Date(Date.now() + 86_400_000),
        },
      });
      const secondOffer = await prisma.brandOffer.create({
        data: {
          brandProfileId: b.id,
          offerName: "Second exact offer",
          promoCode: randomUUID(),
          applicabilityScope: "another free-text scope",
          validityStart: now(),
          validityEnd: new Date(Date.now() + 86_400_000),
        },
      });
      const foreignOffer = await prisma.brandOffer.create({
        data: {
          brandProfileId: foreign.id,
          offerName: "Foreign",
          promoCode: randomUUID(),
          applicabilityScope: "all",
          validityStart: now(),
          validityEnd: new Date(Date.now() + 86_400_000),
        },
      });
      await service.addLocationAvailability(b.id, item.id, location.id);
      await service.addOfferApplicability(b.id, offer.id, item.id);
      await service.addOfferApplicability(b.id, offer.id, secondItem.id);
      await service.addOfferApplicability(b.id, secondOffer.id, item.id);
      const saved = await prisma.offering.findUniqueOrThrow({
        where: { id: item.id },
      });
      expect(saved.locationIds).toEqual([location.id]);
      expect(
        (await prisma.brandOffer.findUniqueOrThrow({ where: { id: offer.id } }))
          .applicabilityScope,
      ).toBe("free text remains free text");
      expect(
        await prisma.brandOfferOffering.count({
          where: {
            brandProfileId: b.id,
            OR: [{ brandOfferId: offer.id }, { offeringId: item.id }],
          },
        }),
      ).toBe(3);
      await expect(
        service.addLocationAvailability(b.id, item.id, foreignLocation.id),
      ).rejects.toThrow();
      await expect(
        service.addOfferApplicability(b.id, foreignOffer.id, item.id),
      ).rejects.toThrow();
      await expect(
        service.addLocationAvailability(
          foreign.id,
          item.id,
          foreignLocation.id,
        ),
      ).rejects.toThrow();
    });

    it("rejects every canonical child row that claims a foreign Brand", async () => {
      const b = await brand();
      const foreign = await brand();
      const item = await offering(b.id);
      await expect(
        prisma.offeringFieldState.create({
          data: {
            brandProfileId: foreign.id,
            offeringId: item.id,
            semanticFieldPath: "name",
            ...observed,
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.offeringGuidanceItem.create({
          data: {
            brandProfileId: foreign.id,
            offeringId: item.id,
            kind: OfferingGuidanceKind.SELLING_POINT,
            text: "foreign",
            ...observed,
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.offeringPriceState.create({
          data: { brandProfileId: foreign.id, offeringId: item.id },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.offeringMediaState.create({
          data: { brandProfileId: foreign.id, offeringId: item.id },
        }),
      ).rejects.toThrow();
    });

    it("keeps a Brand manual revision current when automatic refresh commits later", async () => {
      const b = await brand();
      const item = await offering(b.id);
      await service.advancePrice(
        b.id,
        item.id,
        null,
        price(OfferingPriceMode.EXACT, {
          currentMinAmount: 100,
          currentMaxAmount: 100,
        }),
      );
      const automaticExpectedRevision = 1;
      await service.advancePrice(b.id, item.id, 1, {
        ...price(OfferingPriceMode.EXACT, {
          currentMinAmount: 110,
          currentMaxAmount: 110,
        }),
        authority: CanonicalOfferingAuthority.BRAND_CONFIRMED,
        origin: CanonicalOfferingOrigin.BRAND_EDIT,
        sourceClass: "APPLICATION",
      });
      await expect(
        service.advancePrice(
          b.id,
          item.id,
          automaticExpectedRevision,
          price(OfferingPriceMode.EXACT, {
            currentMinAmount: 120,
            currentMaxAmount: 120,
          }),
          { controlledRefresh: true },
        ),
      ).rejects.toThrow("MANUAL_PRICE_PROTECTED");
      const winning = await prisma.offeringPriceState.findUniqueOrThrow({
        where: { offeringId: item.id },
        include: { currentRevision: true },
      });
      expect(winning.currentRevision).toMatchObject({
        authority: CanonicalOfferingAuthority.BRAND_CONFIRMED,
        origin: CanonicalOfferingOrigin.BRAND_EDIT,
      });
      expect(winning.currentRevision?.currentMinAmount?.toString()).toBe("110");
    });

    it("fails controlled refresh closed for inconsistent manual origin", async () => {
      const b = await brand();
      const item = await offering(b.id);
      await service.advancePrice(b.id, item.id, null, {
        ...price(OfferingPriceMode.EXACT, {
          currentMinAmount: 100,
          currentMaxAmount: 100,
        }),
        authority: CanonicalOfferingAuthority.APPLICATION_CANONICAL,
        origin: CanonicalOfferingOrigin.BRAND_UPLOAD,
      });
      await expect(
        service.advancePrice(
          b.id,
          item.id,
          1,
          price(OfferingPriceMode.EXACT, {
            currentMinAmount: 120,
            currentMaxAmount: 120,
          }),
          { controlledRefresh: true },
        ),
      ).rejects.toThrow("MANUAL_PRICE_PROTECTED");
    });

    it("re-checks ACTIVE lifecycle in the final controlled transaction", async () => {
      const b = await brand();
      const item = await offering(b.id);
      await service.advancePrice(
        b.id,
        item.id,
        null,
        price(OfferingPriceMode.EXACT, {
          currentMinAmount: 100,
          currentMaxAmount: 100,
        }),
      );
      await service.setLifecycle(
        b.id,
        item.id,
        OfferingLifecycle.PAUSED_INACTIVE,
      );
      await expect(
        service.advancePrice(
          b.id,
          item.id,
          1,
          price(OfferingPriceMode.EXACT, {
            currentMinAmount: 120,
            currentMaxAmount: 120,
          }),
          { controlledRefresh: true },
        ),
      ).rejects.toThrow("INACTIVE_OFFERING");
    });
  },
);
