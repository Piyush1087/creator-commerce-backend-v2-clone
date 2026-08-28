import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma, type Location } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

const text = z
  .string()
  .trim()
  .max(1000)
  .regex(/^[^\u0000-\u001f]*$/u);
export const locationObservationSchema = z
  .object({
    locationId: z.string().uuid().optional(),
    sourceId: text.min(1).optional(),
    name: text.nullish(),
    address: text.min(1),
    city: text.nullish(),
    zip: text.nullish(),
    lat: z.number().min(-90).max(90).nullish(),
    lng: z.number().min(-180).max(180).nullish(),
    contactDetails: z.record(z.string().max(1000)).nullish(),
  })
  .strict();
export type LocationObservation = z.infer<typeof locationObservationSchema>;
export type LocationResolution = {
  outcome:
    | "MATCHED_EXISTING"
    | "NEW_PROVISIONAL_LOCATION"
    | "UNRESOLVED_OR_AMBIGUOUS";
  locationId: string | null;
};
export const normalizeLocationAliasPart = (value?: string | null) =>
  (value ?? "").trim().toLowerCase().replace(/\s+/gu, " ");
export function postalLocationAlias(
  value: Pick<LocationObservation, "address" | "city" | "zip">,
): string | null {
  const parts = [value.address, value.city, value.zip].map(
    normalizeLocationAliasPart,
  );
  // Fixed-width exact fingerprint avoids PostgreSQL B-tree key limits for long legacy addresses.
  return parts.every(Boolean)
    ? `postal-v1:${createHash("sha256").update(parts.join("\u001f")).digest("hex")}`
    : null;
}

/** Exact reconciliation only. A row's UUID, never an alias, is its durable identity. */
@Injectable()
export class BrandLocationService {
  constructor(private readonly prisma: PrismaService) {}

  read(brandId: string) {
    return this.prisma.location.findMany({
      where: { brandProfileId: brandId },
      orderBy: { id: "asc" },
    });
  }

  async reconcile(
    brandId: string,
    candidates: readonly LocationObservation[],
    source: string,
    tx?: Prisma.TransactionClient,
  ): Promise<LocationResolution[]> {
    const parsed = z
      .array(locationObservationSchema)
      .max(1000)
      .parse(candidates);
    const sourceNamespace = text.min(1).parse(source);
    const run = async (db: Prisma.TransactionClient) => {
      // Serialize candidate admission and canonical actions for this Brand, not across Brands.
      const brand = await db.$queryRaw<
        { id: string }[]
      >`SELECT id FROM brand_profiles WHERE id = ${brandId} FOR UPDATE`;
      if (!brand.length) throw new NotFoundException("BRAND_NOT_FOUND");
      const results: LocationResolution[] = [];
      const seen = new Set<string>();
      const observedAt = new Date();
      for (const candidate of parsed) {
        const postal = postalLocationAlias(candidate);
        const aliases: { kind: "EXTERNAL" | "POSTAL"; key: string }[] = [
          ...(candidate.sourceId
            ? [
                {
                  kind: "EXTERNAL" as const,
                  key: JSON.stringify([sourceNamespace, candidate.sourceId]),
                },
              ]
            : []),
          ...(postal ? [{ kind: "POSTAL" as const, key: postal }] : []),
        ];
        let matched: Location | null = null;
        let unresolved: string | null = null;
        if (candidate.locationId) {
          matched = await db.location.findFirst({
            where: { id: candidate.locationId, brandProfileId: brandId },
          });
          if (!matched) unresolved = "CANONICAL_REFERENCE_UNRESOLVED";
        } else {
          for (const alias of aliases) {
            const matches = await db.brandLocationAlias.findMany({
              where: { brandProfileId: brandId, ...alias },
              include: { location: true },
            });
            if (matches.length > 1) {
              unresolved = "AMBIGUOUS_IDENTITY_ALIAS";
              break;
            }
            if (matches.length === 1) {
              matched = matches[0].location;
              break;
            }
          }
        }
        if (!matched && !aliases.length)
          unresolved = "INSUFFICIENT_LOCATION_IDENTITY";
        if (unresolved) {
          const observed = { source: sourceNamespace, ...candidate };
          const fingerprint = createHash("sha256")
            .update(JSON.stringify(observed))
            .digest("hex");
          await db.brandLocationObservation.upsert({
            where: {
              brandProfileId_fingerprint: {
                brandProfileId: brandId,
                fingerprint,
              },
            },
            create: {
              brandProfileId: brandId,
              fingerprint,
              reason: unresolved,
              observed,
              observedAt,
            },
            update: { observedAt, reason: unresolved },
          });
          results.push({
            outcome: "UNRESOLVED_OR_AMBIGUOUS",
            locationId: null,
          });
          continue;
        }
        const {
          locationId: _locationId,
          sourceId: _sourceId,
          contactDetails,
          ...fields
        } = candidate;
        const observed = { source: sourceNamespace, ...candidate };
        const metadata = {
          lastObservedAt: observedAt,
          observationFreshness: "CURRENT" as const,
          reconciliationState: "MATCHED" as const,
          lastObservation: observed,
        };
        let current: Location;
        if (matched) {
          const protectedRow =
            matched.authority === "BRAND_CONFIRMED" ||
            matched.authority === "APPLICATION_CANONICAL";
          current = await db.location.update({
            where: { id: matched.id },
            data: {
              ...(!protectedRow
                ? {
                    ...fields,
                    contactDetails:
                      contactDetails === null
                        ? Prisma.JsonNull
                        : contactDetails,
                    authority: "OBSERVED" as const,
                  }
                : {}),
              ...metadata,
              revision: { increment: 1 },
            },
          });
        } else {
          current = await db.location.create({
            data: {
              brandProfileId: brandId,
              ...fields,
              contactDetails:
                contactDetails === null ? Prisma.JsonNull : contactDetails,
              authority: "OBSERVED",
              provenance: {
                origin: "SCAN_OBSERVATION",
                source: sourceNamespace,
              },
              ...metadata,
            },
          });
        }
        // Do not attach a conflicting observed address as an alias to protected current truth.
        const protectedRow =
          current.authority === "BRAND_CONFIRMED" ||
          current.authority === "APPLICATION_CANONICAL";
        const eligibleAliases = aliases.filter(
          (a) =>
            !protectedRow ||
            a.kind === "EXTERNAL" ||
            a.key === postalLocationAlias(current),
        );
        const safeAliases: typeof aliases = [];
        for (const alias of eligibleAliases) {
          // Higher-precedence identity remains authoritative, but cannot claim another row's alias.
          const conflict = await db.brandLocationAlias.findFirst({
            where: {
              brandProfileId: brandId,
              ...alias,
              locationId: { not: current.id },
            },
          });
          if (!conflict) safeAliases.push(alias);
        }
        await db.brandLocationAlias.createMany({
          data: safeAliases.map((alias) => ({
            brandProfileId: brandId,
            locationId: current.id,
            ...alias,
          })),
          skipDuplicates: true,
        });
        seen.add(current.id);
        results.push({
          outcome: matched ? "MATCHED_EXISTING" : "NEW_PROVISIONAL_LOCATION",
          locationId: current.id,
        });
      }
      // Omission changes observation freshness only, never lifecycle or relationships.
      await db.location.updateMany({
        where: {
          brandProfileId: brandId,
          id: { notIn: [...seen] },
          observationFreshness: "CURRENT",
        },
        data: {
          observationFreshness: "POSSIBLY_STALE",
          revision: { increment: 1 },
        },
      });
      return results;
    };
    return tx ? run(tx) : this.prisma.$transaction(run, { timeout: 30000 });
  }
}
