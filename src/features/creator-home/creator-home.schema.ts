import { z } from "zod";

import {
  HOME_FRESHNESS_STATES,
  HOME_RESPONSE_STATES,
  HOME_SECTION_STATES,
  HOME_SOURCE_STATES,
} from "../../shared/home/home.types";
import {
  CREATOR_HOME_DESTINATIONS,
  CREATOR_HOME_KPI_IDS,
  CREATOR_HOME_QUICK_ACTION_IDS,
  CREATOR_HOME_SECTION_IDS,
  CREATOR_HOME_SOURCE_DOMAINS,
} from "./creator-home.contract";

const DestinationSchema = z
  .object({
    destinationId: z.enum(CREATOR_HOME_DESTINATIONS),
    entityId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

const ActionSchema = z
  .object({
    state: z.enum(["AVAILABLE", "READ_ONLY", "HIDDEN"]),
    destination: DestinationSchema.nullable(),
    reasonCode: z.string().trim().min(1).max(128).nullable(),
  })
  .strict();

export const CreatorHomeItemSchema = z
  .object({
    id: z.string().trim().min(1).max(300),
    kind: z.enum([
      "ATTENTION",
      "APPLICATION",
      "COLLABORATION",
      "CAMPAIGN",
      "ACTIVITY",
    ]),
    title: z.string().trim().min(1).max(500),
    subtitle: z.string().trim().min(1).max(1_000),
    status: z.string().trim().min(1).max(128).nullable(),
    occurredAt: z.string().datetime().nullable(),
    unreadCount: z.number().int().nonnegative().nullable(),
    availableActions: z.array(z.string().trim().min(1).max(128)).max(30),
    action: ActionSchema.nullable(),
    source: z.enum(CREATOR_HOME_SOURCE_DOMAINS),
  })
  .strict();

export const CreatorHomeResponseSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    generatedAt: z.string().datetime(),
    status: z.enum(HOME_RESPONSE_STATES),
    creator: z
      .object({
        id: z.string().trim().min(1).max(128),
        workspaceId: z.string().trim().min(1).max(128),
        displayName: z.string().trim().min(1).max(500),
        workspaceDisplayName: z.string().trim().min(1).max(500),
        role: z.enum(["OWNER", "MANAGER", "ASSISTANT"]),
      })
      .strict(),
    kpis: z
      .array(
        z
          .object({
            id: z.enum(CREATOR_HOME_KPI_IDS),
            state: z.enum(HOME_SOURCE_STATES),
            value: z.number().int().nonnegative().nullable(),
            freshness: z.enum(HOME_FRESHNESS_STATES),
            observedAt: z.string().datetime(),
          })
          .strict(),
      )
      .length(4),
    quickActions: z
      .array(
        z
          .object({
            id: z.enum(CREATOR_HOME_QUICK_ACTION_IDS),
            label: z.string().trim().min(1).max(100),
            action: ActionSchema,
          })
          .strict(),
      )
      .length(4),
    sections: z
      .array(
        z
          .object({
            id: z.enum(CREATOR_HOME_SECTION_IDS),
            state: z.enum(HOME_SECTION_STATES),
            items: z.array(CreatorHomeItemSchema),
          })
          .strict(),
      )
      .length(4),
    sourceStates: z
      .array(
        z
          .object({
            sourceDomain: z.enum(CREATOR_HOME_SOURCE_DOMAINS),
            state: z.enum(HOME_SOURCE_STATES),
            freshness: z.enum(HOME_FRESHNESS_STATES),
            observedAt: z.string().datetime(),
            truncated: z.boolean(),
            limitations: z.array(z.string().trim().min(1).max(500)),
          })
          .strict(),
      )
      .length(5),
    truncated: z.boolean(),
    limitations: z.array(z.string().trim().min(1).max(500)),
  })
  .strict()
  .superRefine((response, context) => {
    for (const [field, expected] of [
      ["kpis", CREATOR_HOME_KPI_IDS],
      ["quickActions", CREATOR_HOME_QUICK_ACTION_IDS],
      ["sections", CREATOR_HOME_SECTION_IDS],
      ["sourceStates", CREATOR_HOME_SOURCE_DOMAINS],
    ] as const) {
      const actual = response[field].map((entry) =>
        "sourceDomain" in entry ? entry.sourceDomain : entry.id,
      );
      if (actual.some((value, index) => value !== expected[index])) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} must use the frozen canonical order`,
        });
      }
    }
    response.kpis.forEach((kpi, index) => {
      if ((kpi.state === "UNAVAILABLE") !== (kpi.value === null)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["kpis", index, "value"],
          message:
            "Unavailable KPI values must be null and available KPI values must be numeric",
        });
      }
    });
  });

export type CreatorHomeResponse = z.infer<typeof CreatorHomeResponseSchema>;
export type CreatorHomeItem = z.infer<typeof CreatorHomeItemSchema>;
