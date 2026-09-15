import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

export const PORTFOLIO_VERSION = "creator-portfolio-v3.1" as const;
const normalizedText = (max: number) =>
  z
    .string()
    .transform((s) => s.normalize("NFKC").trim().replace(/\s+/gu, " "))
    .pipe(z.string().min(1).max(max));
export function normalizePortfolioDestination(input: string): string {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hostname.endsWith(".") ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname) ||
    !url.hostname.includes(".") ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid)$/iu.test(url.hostname) ||
    /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/iu.test(url.hostname)
  )
    throw new Error("PORTFOLIO_UNSAFE_DESTINATION");
  for (const key of url.searchParams.keys())
    if (
      /token|signature|credential|secret|password|x-amz|x-goog|expires|expiry|oauth|authkey|^(?:sig|policy|key-pair-id|hmac|sas)$/iu.test(
        key,
      )
    )
      throw new Error("PORTFOLIO_EPHEMERAL_DESTINATION");
  url.hash = "";
  if (
    url.hostname === "instagram.com" ||
    url.hostname === "www.instagram.com"
  ) {
    const match = /^\/(p|reel)\/([A-Za-z0-9_-]+)\/?$/u.exec(url.pathname);
    if (!match) throw new Error("PORTFOLIO_UNSUPPORTED_INSTAGRAM_DESTINATION");
    return `https://www.instagram.com/${match[1]}/${match[2]}/`;
  }
  return url.toString();
}
export const DestinationSchema = z
  .string()
  .max(4096)
  .transform((value, ctx) => {
    try {
      return normalizePortfolioDestination(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A stable HTTPS source destination is required",
      });
      return z.NEVER;
    }
  });
export const PortfolioKindSchema = z.enum([
  "INSTAGRAM_IMAGE",
  "INSTAGRAM_REEL",
  "INSTAGRAM_CAROUSEL",
  "INSTAGRAM_STORY",
  "EXTERNAL",
  "UGC",
]);
export const PortfolioRoleSchema = z.enum(["OWNER", "MANAGER", "ASSISTANT"]);
export const PortfolioProvenanceSchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("INSTAGRAM"),
      accountId: normalizedText(200),
      authorizationGeneration: z.number().int().positive(),
      providerMediaId: normalizedText(200),
      sourceCaptureRef: normalizedText(500),
      evidenceRefs: z.array(normalizedText(500)).min(1).max(240),
      sourceHash: z.string().regex(/^[a-f0-9]{64}$/u),
      observedAt: z.string().datetime(),
      classification: z.literal("POSSIBLE_COLLABORATION"),
      confidence: z.enum(["LOW", "MEDIUM"]),
      cueClasses: z.array(normalizedText(120)).min(1).max(12),
    })
    .strict(),
  z
    .object({
      source: z.literal("CREATOR_SHOP"),
      collaborationId: z.string().uuid(),
      deliverableExecutionId: z.string().uuid(),
      evidenceId: z.string().uuid(),
      verification: z.enum(["PUBLISHING_VERIFIED", "UGC_APPROVED_COMPLETED"]),
      verifiedAt: z.string().datetime(),
      sourceHash: z.string().regex(/^[a-f0-9]{64}$/u),
    })
    .strict(),
  z
    .object({
      source: z.literal("CREATOR_PROVIDED"),
      createdAt: z.string().datetime(),
    })
    .strict(),
]);
export const PortfolioItemSchema = z
  .object({
    id: z.string().regex(/^portfolio-item:[a-f0-9]{64}$/u),
    kind: PortfolioKindSchema,
    destination: DestinationSchema,
    title: normalizedText(160),
    creatorContext: z.string().max(300).nullable(),
    brandLabel: normalizedText(160).nullable(),
    workDate: z.string().datetime().nullable(),
    state: z.enum(["INCLUDED", "REMOVED"]),
    provenance: z.array(PortfolioProvenanceSchema).min(1).max(32),
    presentation: z.literal("SOURCE_LINK_ONLY"),
    access: z.enum(["PUBLIC_DESTINATION", "ACCESS_REQUIREMENTS_UNKNOWN"]),
  })
  .strict()
  .superRefine((item, ctx) => {
    const sources = item.provenance.map((p) => p.source);
    if (
      sources.includes("INSTAGRAM") &&
      !item.destination.startsWith("https://www.instagram.com/")
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Instagram provenance requires an exact Instagram source destination",
      });
    if (item.kind === "INSTAGRAM_STORY")
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Story capability is not admitted by the accepted provider inventory",
      });
  });
export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;
/** Consumer labels/basis only; persisted source identities and authorization
 * generations are deliberately not transport fields. */
export const PortfolioPublicProvenanceSchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("INSTAGRAM"),
      classification: z.literal("POSSIBLE_COLLABORATION"),
      confidence: z.enum(["LOW", "MEDIUM"]),
      observedAt: z.string().datetime(),
      basis: z.literal("SPONSORSHIP_DISCLOSURE"),
    })
    .strict(),
  z
    .object({
      source: z.literal("CREATOR_SHOP"),
      verification: z.literal("COMPLETED_WORK"),
      verifiedAt: z.string().datetime(),
    })
    .strict(),
  z
    .object({
      source: z.literal("CREATOR_PROVIDED"),
      createdAt: z.string().datetime(),
    })
    .strict(),
]);
export const PortfolioPublicItemSchema = PortfolioItemSchema.innerType()
  .omit({ provenance: true })
  .extend({
    provenance: z.array(PortfolioPublicProvenanceSchema).min(1).max(32),
  })
  .superRefine((item, ctx) => {
    if (
      item.kind === "INSTAGRAM_STORY" ||
      (item.provenance.some((p) => p.source === "INSTAGRAM") &&
        !item.destination.startsWith("https://www.instagram.com/"))
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exact supported source destination required",
      });
  });
export const PortfolioMutationSchema = z.discriminatedUnion("intent", [
  z
    .object({
      intent: z.literal("ADD_REFERENCE"),
      expectedRevision: z.number().int().nonnegative(),
      idempotencyKey: z.string().uuid(),
      kind: z.enum(["EXTERNAL", "UGC"]),
      destination: DestinationSchema,
      title: normalizedText(160),
      creatorContext: z.string().max(300).nullable(),
      workDate: z.string().datetime().nullable(),
    })
    .strict(),
  z
    .object({
      intent: z.literal("EDIT_REFERENCE"),
      expectedRevision: z.number().int().nonnegative(),
      idempotencyKey: z.string().uuid(),
      itemId: z.string().regex(/^portfolio-item:[a-f0-9]{64}$/u),
      destination: DestinationSchema,
      title: normalizedText(160),
      creatorContext: z.string().max(300).nullable(),
      workDate: z.string().datetime().nullable(),
    })
    .strict(),
  z
    .object({
      intent: z.enum(["REMOVE", "RESTORE"]),
      expectedRevision: z.number().int().nonnegative(),
      idempotencyKey: z.string().uuid(),
      itemId: z.string().regex(/^portfolio-item:[a-f0-9]{64}$/u),
    })
    .strict(),
]);
export const PortfolioConsumerSchema = z
  .object({
    contractVersion: z.literal(PORTFOLIO_VERSION),
    currentRevision: z.number().int().nonnegative(),
    context: z
      .object({ role: PortfolioRoleSchema, canCurate: z.boolean() })
      .strict(),
    items: z.array(PortfolioPublicItemSchema).max(100),
    nextCursor: z
      .string()
      .regex(/^portfolio-item:[a-f0-9]{64}$/u)
      .nullable(),
    discovery: z.enum(["AVAILABLE", "PARTIAL", "UNAVAILABLE", "NOT_PROCESSED"]),
    limitations: z.array(normalizedText(200)).max(32),
  })
  .strict()
  .superRefine((consumer, ctx) => {
    if (consumer.context.canCurate !== (consumer.context.role !== "ASSISTANT"))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Role and curation authority must agree",
      });
    if (
      new Set(consumer.items.map((item) => item.id)).size !==
      consumer.items.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate item identity is invalid",
      });
  });
export const PortfolioQuerySchema = z
  .object({
    filter: z
      .enum(["ALL", "INSTAGRAM", "CREATOR_SHOP", "CREATOR_PROVIDED", "REMOVED"])
      .default("ALL"),
    cursor: z
      .string()
      .regex(/^portfolio-item:[a-f0-9]{64}$/u)
      .optional(),
  })
  .strict();
export function portfolioDestinationAlias(destination: string) {
  return `destination:${createHash("sha256").update(normalizePortfolioDestination(destination)).digest("hex")}`;
}
export function portfolioIdentity(
  owner: string,
  sourceIdentity: string,
): string {
  return `portfolio-item:${createHash("sha256")
    .update(JSON.stringify([PORTFOLIO_VERSION, owner, sourceIdentity]))
    .digest("hex")}`;
}
