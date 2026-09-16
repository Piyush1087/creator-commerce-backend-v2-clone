import { createHash } from "node:crypto";

import { z } from "zod";

import {
  canonicalCampaignObjectiveSchema,
  type CanonicalCampaignObjective,
} from "../schemas/canonical-campaign-objective.schema";

export const CAMPAIGN_OBJECTIVE_CONTRACT = "CAMPAIGN_OBJECTIVE_V1" as const;
export const CANONICAL_CAMPAIGN_DEFINITION_VERSION = "2.0" as const;

type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

function normalizeCanonicalJson(value: unknown): CanonicalJson {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("Campaign definition contains a non-finite number.");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeCanonicalJson);
  if (typeof value === "object") {
    const result: { [key: string]: CanonicalJson } = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) {
        throw new TypeError("Campaign definition contains undefined.");
      }
      result[key] = normalizeCanonicalJson(entry);
    }
    return result;
  }
  throw new TypeError("Campaign definition contains a non-JSON value.");
}

export function serializeCanonicalCampaignDefinition(value: unknown): string {
  return JSON.stringify(normalizeCanonicalJson(value));
}

export function hashCanonicalCampaignDefinition(
  value: unknown,
): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(serializeCanonicalCampaignDefinition(value), "utf8")
    .digest("hex")}`;
}

export function campaignDefinitionSnapshotRef(
  campaignId: string,
  definitionVersion: string,
  definitionHash: string,
): string {
  return `uce-campaign-definition:${campaignId}:${definitionVersion}:${definitionHash}`;
}

export type CanonicalCampaignObjectiveHandoff = Readonly<{
  objective: CanonicalCampaignObjective;
  objectiveContract: typeof CAMPAIGN_OBJECTIVE_CONTRACT;
  campaignDefinition: Readonly<{
    version: typeof CANONICAL_CAMPAIGN_DEFINITION_VERSION;
    snapshotRef: string;
    hash: `sha256:${string}`;
  }>;
}>;

export function projectCanonicalCampaignObjective(input: {
  campaignId: string;
  coreObjective: unknown;
  canonicalDefinition: unknown;
  canonicalDefinitionHash: string | null;
}):
  | { state: "AVAILABLE"; value: CanonicalCampaignObjectiveHandoff }
  | {
      state: "UNAVAILABLE";
      reason:
        | "CAMPAIGN_OBJECTIVE_REAUTHOR_REQUIRED"
        | "CAMPAIGN_DEFINITION_INTEGRITY_INVALID";
    } {
  const objective = canonicalCampaignObjectiveSchema.safeParse(
    input.coreObjective,
  );
  if (!objective.success) {
    return {
      state: "UNAVAILABLE",
      reason: "CAMPAIGN_OBJECTIVE_REAUTHOR_REQUIRED",
    };
  }
  const definition = z
    .object({
      version: z.literal(CANONICAL_CAMPAIGN_DEFINITION_VERSION),
      strategy: z
        .object({ objective: canonicalCampaignObjectiveSchema })
        .passthrough(),
    })
    .passthrough()
    .safeParse(input.canonicalDefinition);
  if (
    !definition.success ||
    definition.data.strategy.objective !== objective.data
  ) {
    return {
      state: "UNAVAILABLE",
      reason: "CAMPAIGN_DEFINITION_INTEGRITY_INVALID",
    };
  }
  const recomputed = hashCanonicalCampaignDefinition(input.canonicalDefinition);
  if (
    !input.canonicalDefinitionHash ||
    input.canonicalDefinitionHash !== recomputed
  ) {
    return {
      state: "UNAVAILABLE",
      reason: "CAMPAIGN_DEFINITION_INTEGRITY_INVALID",
    };
  }
  return {
    state: "AVAILABLE",
    value: {
      objective: objective.data,
      objectiveContract: CAMPAIGN_OBJECTIVE_CONTRACT,
      campaignDefinition: {
        version: CANONICAL_CAMPAIGN_DEFINITION_VERSION,
        snapshotRef: campaignDefinitionSnapshotRef(
          input.campaignId,
          CANONICAL_CAMPAIGN_DEFINITION_VERSION,
          recomputed,
        ),
        hash: recomputed,
      },
    },
  };
}
