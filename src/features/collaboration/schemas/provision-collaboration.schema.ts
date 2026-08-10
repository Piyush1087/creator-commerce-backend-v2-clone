import { z } from "zod";

const publishingApplicabilitySchema = z
  .object({
    sourceBriefDeliverableId: z.string().uuid(),
    publishingRequired: z.boolean(),
  })
  .strict();

export const provisionCollaborationSchema = z
  .object({
    sourceApplicationId: z.string().uuid(),
    commandId: z.string().trim().min(1).max(200).optional(),
    deliverablePublishingApplicability: z
      .array(publishingApplicabilitySchema)
      .min(1)
      .superRefine((items, context) => {
        const seen = new Set<string>();
        items.forEach((item, index) => {
          if (seen.has(item.sourceBriefDeliverableId)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, "sourceBriefDeliverableId"],
              message:
                "Each source Brief Deliverable may be resolved only once",
            });
          }
          seen.add(item.sourceBriefDeliverableId);
        });
      }),
  })
  .strict();

export type ProvisionCollaborationInput = z.infer<
  typeof provisionCollaborationSchema
>;
