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

export type CampaignObjectiveHandoffV1 =
  | Readonly<{
      status: "AVAILABLE";
      objective: CanonicalCampaignObjective;
      objectiveContract: typeof CAMPAIGN_OBJECTIVE_CONTRACT;
      campaignDefinition: Readonly<{
        version: typeof CANONICAL_CAMPAIGN_DEFINITION_VERSION;
        snapshotRef: string;
        hash: `sha256:${string}`;
      }>;
    }>
  | Readonly<{
      status: "UNAVAILABLE";
      reason:
        | "CANONICAL_OBJECTIVE_REQUIRED"
        | "LEGACY_OBJECTIVE_UNRESOLVED"
        | "CAMPAIGN_DEFINITION_INTEGRITY_INVALID";
    }>;

const LEGACY_CAMPAIGN_OBJECTIVES = new Set([
  "PULSE",
  "PROOF",
  "PRODUCTION",
  "PUSH",
  "BRAND_AWARENESS",
  "TRAFFIC_CLICKS",
  "SALES_CONVERSIONS",
]);

const DEFINITION_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export function projectCampaignObjectiveHandoffV1(input: {
  campaignId: string;
  coreObjective: unknown;
  canonicalDefinition: unknown;
  canonicalDefinitionHash: string | null;
}): CampaignObjectiveHandoffV1 {
  if (
    typeof input.coreObjective === "string" &&
    LEGACY_CAMPAIGN_OBJECTIVES.has(input.coreObjective)
  ) {
    return { status: "UNAVAILABLE", reason: "LEGACY_OBJECTIVE_UNRESOLVED" };
  }

  const objective = canonicalCampaignObjectiveSchema.safeParse(
    input.coreObjective,
  );
  if (!objective.success) {
    return { status: "UNAVAILABLE", reason: "CANONICAL_OBJECTIVE_REQUIRED" };
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
    definition.data.strategy.objective !== objective.data ||
    !input.campaignId.trim() ||
    !input.canonicalDefinitionHash ||
    !DEFINITION_HASH_PATTERN.test(input.canonicalDefinitionHash)
  ) {
    return {
      status: "UNAVAILABLE",
      reason: "CAMPAIGN_DEFINITION_INTEGRITY_INVALID",
    };
  }

  let recomputed: `sha256:${string}`;
  try {
    recomputed = hashCanonicalCampaignDefinition(input.canonicalDefinition);
  } catch {
    return {
      status: "UNAVAILABLE",
      reason: "CAMPAIGN_DEFINITION_INTEGRITY_INVALID",
    };
  }
  if (input.canonicalDefinitionHash !== recomputed) {
    return {
      status: "UNAVAILABLE",
      reason: "CAMPAIGN_DEFINITION_INTEGRITY_INVALID",
    };
  }

  const snapshotRef = campaignDefinitionSnapshotRef(
    input.campaignId,
    definition.data.version,
    recomputed,
  );
  if (!snapshotRef) {
    return {
      status: "UNAVAILABLE",
      reason: "CAMPAIGN_DEFINITION_INTEGRITY_INVALID",
    };
  }

  return {
    status: "AVAILABLE",
    objective: objective.data,
    objectiveContract: CAMPAIGN_OBJECTIVE_CONTRACT,
    campaignDefinition: {
      version: definition.data.version,
      snapshotRef,
      hash: recomputed,
    },
  };
}

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
  const handoff = projectCampaignObjectiveHandoffV1(input);
  if (handoff.status === "UNAVAILABLE") {
    return {
      state: "UNAVAILABLE",
      reason:
        handoff.reason === "CAMPAIGN_DEFINITION_INTEGRITY_INVALID"
          ? handoff.reason
          : "CAMPAIGN_OBJECTIVE_REAUTHOR_REQUIRED",
    };
  }
  return {
    state: "AVAILABLE",
    value: {
      objective: handoff.objective,
      objectiveContract: handoff.objectiveContract,
      campaignDefinition: handoff.campaignDefinition,
    },
  };
}
