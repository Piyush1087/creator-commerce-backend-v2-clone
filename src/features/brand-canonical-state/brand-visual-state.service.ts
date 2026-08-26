import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  CanonicalVisualAuthority,
  CanonicalVisualOrigin,
} from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

const metadata = z.object({
  authority: z.nativeEnum(CanonicalVisualAuthority),
  origin: z.nativeEnum(CanonicalVisualOrigin),
  provenance: z.record(z.string()).optional(),
});
export type VisualWriteAuthority = z.infer<typeof metadata>;
const edit = z.object({
  id: z.string().uuid().optional(),
  expectedRevision: z.number().int().positive().optional(),
  label: z.string().trim().min(1).max(200).nullable().optional(),
  lifecycle: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
const asset = edit
  .extend({
    role: z.enum(["LOGO", "ALTERNATE_MARK", "REFERENCE_IMAGE"]),
    url: z
      .string()
      .url()
      .refine((v) => /^https?:\/\//u.test(v)),
  })
  .strict();
const color = edit
  .extend({
    value: z
      .string()
      .regex(/^#[0-9a-f]{6}$/iu)
      .transform((v) => v.toUpperCase()),
    usage: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .strict();
const font = edit
  .extend({
    family: z.string().trim().min(1).max(200),
    usage: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .strict();

function validated<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown,
): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException("INVALID_CANONICAL_VISUAL_INPUT");
  return result.data;
}

/** Application-owned canonical state. No scan/provider dependency or public approval endpoint. */
@Injectable()
export class BrandVisualStateService {
  constructor(private readonly prisma: PrismaService) {}

  read(brandProfileId: string) {
    return this.prisma.brandVisualState.findUnique({
      where: { brandProfileId },
      include: {
        primaryLogo: true,
        assets: { where: { lifecycle: "ACTIVE" }, orderBy: { id: "asc" } },
        colors: { where: { lifecycle: "ACTIVE" }, orderBy: { id: "asc" } },
        typography: { where: { lifecycle: "ACTIVE" }, orderBy: { id: "asc" } },
      },
    });
  }

  /** The calling application must have authenticated/authorized its existing action. */
  async saveAsset(
    brandId: string,
    input: z.input<typeof asset>,
    authority: VisualWriteAuthority,
    tx?: Prisma.TransactionClient,
  ) {
    const data = validated(asset, input);
    const source = validated(metadata, authority);
    return this.inTransaction(tx, async (db) => {
      await this.lock(db, brandId);
      const { id, expectedRevision, ...values } = data;
      if (!id)
        return db.brandVisualAsset.create({
          data: { ...values, ...source, brandProfileId: brandId },
        });
      const changed = await db.brandVisualAsset.updateMany({
        where: {
          id,
          brandProfileId: brandId,
          revision: this.expected(expectedRevision),
        },
        data: { ...values, ...source, revision: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException("VISUAL_ITEM_REVISION_CONFLICT");
      return db.brandVisualAsset.findUniqueOrThrow({
        where: { brandProfileId_id: { brandProfileId: brandId, id } },
      });
    });
  }

  async saveColor(
    brandId: string,
    input: z.input<typeof color>,
    authority: VisualWriteAuthority,
    tx?: Prisma.TransactionClient,
  ) {
    const { id, expectedRevision, ...data } = validated(color, input);
    const source = validated(metadata, authority);
    return this.inTransaction(tx, async (db) => {
      await this.lock(db, brandId);
      if (!id)
        return db.brandVisualColor.create({
          data: { ...data, ...source, brandProfileId: brandId },
        });
      const changed = await db.brandVisualColor.updateMany({
        where: {
          id,
          brandProfileId: brandId,
          revision: this.expected(expectedRevision),
        },
        data: { ...data, ...source, revision: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException("VISUAL_ITEM_REVISION_CONFLICT");
      return db.brandVisualColor.findUniqueOrThrow({
        where: { brandProfileId_id: { brandProfileId: brandId, id } },
      });
    });
  }

  async saveTypography(
    brandId: string,
    input: z.input<typeof font>,
    authority: VisualWriteAuthority,
    tx?: Prisma.TransactionClient,
  ) {
    const { id, expectedRevision, ...data } = validated(font, input);
    const source = validated(metadata, authority);
    return this.inTransaction(tx, async (db) => {
      await this.lock(db, brandId);
      if (!id)
        return db.brandVisualTypography.create({
          data: { ...data, ...source, brandProfileId: brandId },
        });
      const changed = await db.brandVisualTypography.updateMany({
        where: {
          id,
          brandProfileId: brandId,
          revision: this.expected(expectedRevision),
        },
        data: { ...data, ...source, revision: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException("VISUAL_ITEM_REVISION_CONFLICT");
      return db.brandVisualTypography.findUniqueOrThrow({
        where: { brandProfileId_id: { brandProfileId: brandId, id } },
      });
    });
  }

  async selectPrimaryLogo(
    brandId: string,
    assetId: string | null,
    expectedRevision: number,
    tx?: Prisma.TransactionClient,
  ) {
    return this.inTransaction(tx, async (db) => {
      await this.lock(db, brandId, false);
      if (assetId) {
        const selected = await db.brandVisualAsset.findFirst({
          where: {
            id: assetId,
            brandProfileId: brandId,
            lifecycle: "ACTIVE",
            role: "LOGO",
          },
        });
        if (!selected) throw new NotFoundException("CANONICAL_LOGO_NOT_FOUND");
      }
      const changed = await db.brandVisualState.updateMany({
        where: {
          brandProfileId: brandId,
          revision: this.expected(expectedRevision),
        },
        data: { primaryLogoAssetId: assetId, revision: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException("VISUAL_STATE_REVISION_CONFLICT");
      // The DB guard enforces this one-way mirror for every legacy writer as well.
      const selected = assetId
        ? await db.brandVisualAsset.findUniqueOrThrow({
            where: { id: assetId },
          })
        : null;
      await db.brandProfile.update({
        where: { id: brandId },
        data: { logoUrl: selected?.url ?? null },
      });
    });
  }

  /** Existing explicit logo selection/upload; each new selection creates a durable asset. */
  async confirmLogo(
    brandId: string,
    url: string,
    origin: CanonicalVisualOrigin,
    tx?: Prisma.TransactionClient,
  ) {
    return this.inTransaction(tx, async (db) => {
      const saved = await this.saveAsset(
        brandId,
        { role: "LOGO", url },
        { authority: "BRAND_CONFIRMED", origin },
        db,
      );
      const state = await db.brandVisualState.findUniqueOrThrow({
        where: { brandProfileId: brandId },
      });
      await this.selectPrimaryLogo(brandId, saved.id, state.revision, db);
      return saved;
    });
  }

  /** Existing legacy explicit palette/font action lacks IDs: only exact unchanged values are reused.
   * Changed values are new items, never guessed continuous from order/wording. */
  async confirmLegacyIdentity(
    brandId: string,
    input: { palette?: string[]; fonts?: string[] },
    tx: Prisma.TransactionClient,
  ) {
    await this.lock(tx, brandId);
    const source: VisualWriteAuthority = {
      authority: "BRAND_CONFIRMED",
      origin: "BRAND_EDIT",
    };
    if (input.palette !== undefined) {
      const values = [
        ...new Set(
          input.palette.map((value) => validated(color, { value }).value),
        ),
      ];
      const prior = await tx.brandVisualColor.findMany({
        where: { brandProfileId: brandId, lifecycle: "ACTIVE" },
      });
      for (const value of values)
        if (!prior.some((p) => p.value === value))
          await this.saveColor(brandId, { value }, source, tx);
      await tx.brandVisualColor.updateMany({
        where: {
          brandProfileId: brandId,
          lifecycle: "ACTIVE",
          value: { notIn: values },
        },
        data: { lifecycle: "INACTIVE", revision: { increment: 1 } },
      });
    }
    if (input.fonts !== undefined) {
      const values = input.fonts.map((family, index) =>
        validated(font, {
          family,
          usage: index === 0 ? "HEADING" : index === 1 ? "BODY" : null,
        }),
      );
      const prior = await tx.brandVisualTypography.findMany({
        where: { brandProfileId: brandId, lifecycle: "ACTIVE" },
      });
      const retained: string[] = [];
      for (const value of values) {
        const existing = prior.find(
          (p) => p.family === value.family && !retained.includes(p.id),
        );
        if (existing && existing.usage !== value.usage)
          await this.saveTypography(
            brandId,
            { id: existing.id, expectedRevision: existing.revision, ...value },
            source,
            tx,
          );
        retained.push(
          existing?.id ??
            (await this.saveTypography(brandId, value, source, tx)).id,
        );
      }
      await tx.brandVisualTypography.updateMany({
        where: {
          brandProfileId: brandId,
          lifecycle: "ACTIVE",
          id: { notIn: retained },
        },
        data: { lifecycle: "INACTIVE", revision: { increment: 1 } },
      });
    }
  }

  private expected(revision?: number) {
    if (!Number.isInteger(revision) || !revision || revision < 1)
      throw new ConflictException("EXPECTED_VISUAL_REVISION_REQUIRED");
    return revision;
  }

  private async lock(
    tx: Prisma.TransactionClient,
    brandId: string,
    advance = true,
  ) {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM brand_profiles WHERE id = ${brandId} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException("BRAND_NOT_FOUND");
    await tx.brandVisualState.upsert({
      where: { brandProfileId: brandId },
      create: { brandProfileId: brandId },
      update: advance ? { revision: { increment: 1 } } : {},
    });
  }

  private inTransaction<T>(
    tx: Prisma.TransactionClient | undefined,
    work: (db: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return tx ? work(tx) : this.prisma.$transaction(work);
  }
}
