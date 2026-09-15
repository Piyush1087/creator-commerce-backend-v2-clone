import { createHash } from "node:crypto";
import { z } from "zod";
import { DestinationSchema } from "./contracts/portfolio.contract";

/** Read projection input only. These identities/state/timestamps must be loaded
 * from C04 by the server, never accepted from a Portfolio mutation DTO. */
export const PortfolioC04ReadSchema = z
  .object({
    creatorProfileId: z.string(),
    creatorWorkspaceId: z.string(),
    collaborationId: z.string().uuid(),
    deliverableExecutionId: z.string().uuid(),
    evidenceId: z.string().uuid(),
    authority: z.literal("CANONICAL_V1"),
    lifecycle: z.literal("COMPLETED"),
    publishingRequired: z.boolean(),
    state: z.enum(["PUBLISHING_VERIFIED", "UGC_APPROVED_COMPLETED"]),
    verifiedAt: z.string().datetime(),
    destination: DestinationSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.publishingRequired !== (value.state === "PUBLISHING_VERIFIED"))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Publishing verification and approved non-publishing work are distinct C04 states",
      });
  });
export function adaptPortfolioC04(
  input: unknown,
  owner: { creatorProfileId: string; workspaceId: string },
) {
  const source = PortfolioC04ReadSchema.parse(input);
  if (
    source.creatorProfileId !== owner.creatorProfileId ||
    source.creatorWorkspaceId !== owner.workspaceId
  )
    throw new Error("PORTFOLIO_C04_OWNER_MISMATCH");
  return {
    destination: source.destination,
    provenance: {
      source: "CREATOR_SHOP" as const,
      collaborationId: source.collaborationId,
      deliverableExecutionId: source.deliverableExecutionId,
      evidenceId: source.evidenceId,
      verification: source.state,
      verifiedAt: source.verifiedAt,
      sourceHash: createHash("sha256")
        .update(JSON.stringify(source))
        .digest("hex"),
    },
  };
}
