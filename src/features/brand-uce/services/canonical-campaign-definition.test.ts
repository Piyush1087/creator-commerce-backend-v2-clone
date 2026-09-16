import { describe, expect, it } from "vitest";

import {
  campaignDefinitionSnapshotRef,
  hashCanonicalCampaignDefinition,
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
});
