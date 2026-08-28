import { OfferingKind, OfferingLifecycle } from "@prisma/client";
import { z } from "zod";

export const CanonicalOfferingDiscoveryItemSchema = z
  .object({
    offeringId: z.string().uuid(),
    name: z.string(),
    kind: z.nativeEnum(OfferingKind),
    subtype: z.string().nullable(),
    lifecycle: z.nativeEnum(OfferingLifecycle),
  })
  .strict();

export const CanonicalOfferingIndexResponseSchema = z
  .object({
    offerings: z.array(CanonicalOfferingDiscoveryItemSchema),
  })
  .strict();

export type CanonicalOfferingIndexResponse = z.infer<
  typeof CanonicalOfferingIndexResponseSchema
>;
