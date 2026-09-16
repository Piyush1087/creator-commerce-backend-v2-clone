import { describe, expect, it } from "vitest";

import {
  campaignDefinitionSnapshotRef,
  hashCanonicalCampaignDefinition,
  projectCampaignObjectiveHandoffV1,
  projectCanonicalCampaignObjective,
  serializeCanonicalCampaignDefinition,
} from "./canonical-campaign-definition";

const definition = {
  version: "2.0",
  creationSource: "MANUAL",
  strategy: { objective: "TRUST", campaign_name: "Proof without aliases" },
};

describe("canonical Campaign definition fence", () => {
  it("is deterministic under object key-order variation", () => {
    const reordered = {
      strategy: { campaign_name: "Proof without aliases", objective: "TRUST" },
      creationSource: "MANUAL",
      version: "2.0",
    };
    expect(serializeCanonicalCampaignDefinition(reordered)).toBe(
      serializeCanonicalCampaignDefinition(definition),
    );
    expect(hashCanonicalCampaignDefinition(reordered)).toBe(
      hashCanonicalCampaignDefinition(definition),
    );
  });

  it("projects an exact canonical objective and deterministic definition reference", () => {
    const hash = hashCanonicalCampaignDefinition(definition);
    const projected = projectCanonicalCampaignObjective({
      campaignId: "campaign-1",
      coreObjective: "TRUST",
      canonicalDefinition: definition,
      canonicalDefinitionHash: hash,
    });
    expect(projected).toEqual({
      state: "AVAILABLE",
      value: {
        objective: "TRUST",
        objectiveContract: "CAMPAIGN_OBJECTIVE_V1",
        campaignDefinition: {
          version: "2.0",
          snapshotRef: campaignDefinitionSnapshotRef("campaign-1", "2.0", hash),
          hash,
        },
      },
    });
  });

  it.each([
    "PULSE",
    "PROOF",
    "PRODUCTION",
    "PUSH",
    "BRAND_AWARENESS",
    "TRAFFIC_CLICKS",
    "SALES_CONVERSIONS",
    "UNKNOWN",
  ])(
    "fails closed for compatibility or unknown objective %s",
    (coreObjective) => {
      expect(
        projectCanonicalCampaignObjective({
          campaignId: "campaign-1",
          coreObjective,
          canonicalDefinition: definition,
          canonicalDefinitionHash: hashCanonicalCampaignDefinition(definition),
        }),
      ).toEqual({
        state: "UNAVAILABLE",
        reason: "CAMPAIGN_OBJECTIVE_REAUTHOR_REQUIRED",
      });
    },
  );

  it("fails closed for definition/objective disagreement and hash tampering", () => {
    const hash = hashCanonicalCampaignDefinition(definition);
    expect(
      projectCanonicalCampaignObjective({
        campaignId: "campaign-1",
        coreObjective: "ACTION",
        canonicalDefinition: definition,
        canonicalDefinitionHash: hash,
      }),
    ).toEqual({
      state: "UNAVAILABLE",
      reason: "CAMPAIGN_DEFINITION_INTEGRITY_INVALID",
    });
    expect(
      projectCanonicalCampaignObjective({
        campaignId: "campaign-1",
        coreObjective: "TRUST",
        canonicalDefinition: definition,
        canonicalDefinitionHash: `sha256:${"0".repeat(64)}`,
      }),
    ).toEqual({
      state: "UNAVAILABLE",
      reason: "CAMPAIGN_DEFINITION_INTEGRITY_INVALID",
    });
  });

  it.each(["AWARENESS", "TRUST", "ASSETS", "ACTION"] as const)(
    "emits a complete handoff for canonical objective %s",
    (objective) => {
      const canonicalDefinition = {
        ...definition,
        strategy: { ...definition.strategy, objective },
      };
      const hash = hashCanonicalCampaignDefinition(canonicalDefinition);

      const handoff = projectCampaignObjectiveHandoffV1({
        campaignId: "campaign-1",
        coreObjective: objective,
        canonicalDefinition,
        canonicalDefinitionHash: hash,
      });

      expect(handoff).toEqual({
        status: "AVAILABLE",
        objective,
        objectiveContract: "CAMPAIGN_OBJECTIVE_V1",
        campaignDefinition: {
          version: "2.0",
          snapshotRef: campaignDefinitionSnapshotRef("campaign-1", "2.0", hash),
          hash,
        },
      });
      expect(Object.keys(handoff).sort()).toEqual([
        "campaignDefinition",
        "objective",
        "objectiveContract",
        "status",
      ]);
    },
  );

  it.each([
    "PULSE",
    "PROOF",
    "PRODUCTION",
    "PUSH",
    "BRAND_AWARENESS",
    "TRAFFIC_CLICKS",
    "SALES_CONVERSIONS",
  ])(
    "classifies recognized legacy objective %s without mapping",
    (objective) => {
      expect(
        projectCampaignObjectiveHandoffV1({
          campaignId: "campaign-1",
          coreObjective: objective,
          canonicalDefinition: definition,
          canonicalDefinitionHash: hashCanonicalCampaignDefinition(definition),
        }),
      ).toEqual({
        status: "UNAVAILABLE",
        reason: "LEGACY_OBJECTIVE_UNRESOLVED",
      });
    },
  );

  it.each([null, undefined, "", "UNKNOWN"])(
    "classifies missing or noncanonical objective %s as required",
    (coreObjective) => {
      expect(
        projectCampaignObjectiveHandoffV1({
          campaignId: "campaign-1",
          coreObjective,
          canonicalDefinition: definition,
          canonicalDefinitionHash: hashCanonicalCampaignDefinition(definition),
        }),
      ).toEqual({
        status: "UNAVAILABLE",
        reason: "CANONICAL_OBJECTIVE_REQUIRED",
      });
    },
  );

  it.each([
    [
      "objective disagreement",
      { ...definition, strategy: { objective: "ACTION" } },
      hashCanonicalCampaignDefinition({
        ...definition,
        strategy: { objective: "ACTION" },
      }),
      "campaign-1",
    ],
    [
      "missing version",
      { strategy: definition.strategy },
      hashCanonicalCampaignDefinition({ strategy: definition.strategy }),
      "campaign-1",
    ],
    [
      "unaccepted version",
      { ...definition, version: "1.2" },
      hashCanonicalCampaignDefinition({ ...definition, version: "1.2" }),
      "campaign-1",
    ],
    [
      "missing snapshot-reference input",
      definition,
      hashCanonicalCampaignDefinition(definition),
      "",
    ],
    ["missing hash", definition, null, "campaign-1"],
    ["malformed hash", definition, "sha256:not-a-hash", "campaign-1"],
    ["hash mismatch", definition, `sha256:${"0".repeat(64)}`, "campaign-1"],
    [
      "tampered definition",
      { ...definition, creationSource: "TAMPERED" },
      hashCanonicalCampaignDefinition(definition),
      "campaign-1",
    ],
  ] as const)(
    "classifies %s as definition integrity invalid",
    (_caseName, canonicalDefinition, canonicalDefinitionHash, campaignId) => {
      const handoff = projectCampaignObjectiveHandoffV1({
        campaignId,
        coreObjective: "TRUST",
        canonicalDefinition,
        canonicalDefinitionHash,
      });
      expect(handoff).toEqual({
        status: "UNAVAILABLE",
        reason: "CAMPAIGN_DEFINITION_INTEGRITY_INVALID",
      });
      expect(handoff).not.toHaveProperty("objective");
      expect(handoff).not.toHaveProperty("campaignDefinition");
    },
  );
});
