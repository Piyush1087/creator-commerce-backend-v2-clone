import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  CampaignOpportunityPolicyService,
  type CampaignRead,
  type InvitationResult,
  type OpportunityPolicyInput,
} from "./campaign-opportunity-policy.service";
import { creatorWorkspaceActionsForRole } from "../creator-settings/team/creator-team.policy";
import { evaluateInstagramOpportunity } from "../../shared/creator/instagram-opportunity-capability";

const now = new Date("2030-01-01T00:00:00Z");
const healthy = {
  nativePlatformUserId: "native-test-identity",
  tokenStateCondition: "ACTIVE" as const,
  tokenExpiresAt: new Date("2031-01-01"),
  disconnectedAt: null,
  authorizationHealth: "USABLE" as const,
  basicAuthorizationCapability: "AVAILABLE" as const,
};
const instagramStates = [
  null,
  healthy,
  { ...healthy, authorizationHealth: "UNKNOWN" as const },
  { ...healthy, tokenStateCondition: "EXPIRED" as const },
  { ...healthy, authorizationHealth: "PROVIDER_ACCESS_BLOCKED" as const },
  { ...healthy, disconnectedAt: now },
];
const expectedStates = [
  "NOT_CONNECTED",
  "CONNECTED_HEALTHY",
  "REVALIDATION_REQUIRED",
  "RECONNECT_REQUIRED",
  "PROVIDER_BLOCKED_RECOVERABLE",
  "DISCONNECTED_IDENTITY_RETAINED",
];
export function opportunityFixture(): CampaignRead {
  return {
    adapterVersion: "C03_CAMPAIGN_APPLICATION_READ_V1",
    campaign: {
      id: "campaign",
      brandProfileId: "brand",
      name: "Safe title",
      brand: null,
      objective: null,
      publishingStart: null,
      publishingEnd: null,
      status: "LIVE",
      creationSource: "MANUAL",
      liveAt: now,
      applicationDeadline: null,
      platforms: ["INSTAGRAM"],
      visibility: { state: "AVAILABLE", value: "EVERYONE" },
      commercial: {
        state: "AVAILABLE",
        canonicalVersion: 1,
        compensationType: "FIXED_FEE",
        commercialOffer: new Prisma.Decimal(120),
        currency: "INR",
        receivesBrandSupport: false,
        brandSupportType: null,
        brandSupportEstimatedValue: null,
        totalCampaignBudget: new Prisma.Decimal(1000),
      },
    },
    assets: [
      {
        id: "asset",
        campaignId: "campaign",
        kind: "BRAND",
        status: "ACTIVE",
        offering: null,
        offer: null,
        briefs: [
          {
            id: "brief",
            campaignAssetId: "asset",
            status: "PUBLISHED",
            creationSource: "MANUAL",
            applicationSelection: { state: "AVAILABLE" },
            definition: {
              briefName: "Private name",
              creativeIntent: "private intent",
              creatorBrief: "sensitive detail",
              briefType: "CREATOR_LED",
              platform: "INSTAGRAM",
              briefLevelGuidance: null,
              referenceContent: null,
              usageRights: null,
              creatorRequirements: null,
              deliverables: [],
            },
          },
        ],
      },
    ],
  };
}

describe("C03 finite Opportunity matrix", () => {
  const cases: Array<{
    requestClass: OpportunityPolicyInput["requestClass"];
    visibility: "EVERYONE" | "ELIGIBLE_ONLY" | "INVITED_ONLY";
    ig: number;
    eligibility: "ELIGIBLE" | "INELIGIBLE" | "UNAVAILABLE";
    invitation: InvitationResult;
    role: "OWNER" | "MANAGER" | "ASSISTANT";
    open: boolean;
  }> = [];
  for (const requestClass of [
    "ANONYMOUS",
    "OTHER_ACCOUNT",
    "AUTHENTICATED_CREATOR",
  ] as const)
    for (const visibility of [
      "EVERYONE",
      "ELIGIBLE_ONLY",
      "INVITED_ONLY",
    ] as const)
      for (let ig = 0; ig < 6; ig++)
        for (const eligibility of [
          "ELIGIBLE",
          "INELIGIBLE",
          "UNAVAILABLE",
        ] as const)
          for (const invitation of [
            "ABSENT",
            "VALID",
            "EXPIRED",
            "REVOKED",
            "SUBJECT_MISMATCH",
          ] as const)
            for (const role of ["OWNER", "MANAGER", "ASSISTANT"] as const)
              for (const open of [true, false])
                cases.push({
                  requestClass,
                  visibility,
                  ig,
                  eligibility,
                  invitation,
                  role,
                  open,
                });
  it.each(cases)("cell %#", (cell) => {
    const campaign = opportunityFixture();
    campaign.campaign.visibility = {
      state: "AVAILABLE",
      value: cell.visibility,
    };
    campaign.campaign.status = cell.open ? "LIVE" : "PAUSED";
    const instagram = evaluateInstagramOpportunity(
      instagramStates[cell.ig],
      now,
    );
    expect(instagram.lifecycleState).toBe(expectedStates[cell.ig]);
    expect(instagram.usableForOpportunity).toBe(cell.ig === 1);
    const result = new CampaignOpportunityPolicyService().evaluate({
      campaign,
      now,
      requestClass: cell.requestClass,
      actor: {
        actorUserId: "actor",
        actorMembershipId: "member",
        actorRole: cell.role,
        workspaceId: "workspace",
        organizationId: "org",
        subjectCreatorProfileId: "subject",
        subjectOwnerUserId: "owner",
        allowedActions: creatorWorkspaceActionsForRole(cell.role),
      },
      instagram,
      invitation: cell.invitation,
      eligibility: {
        result: cell.eligibility,
        targetingVersion: 1,
        creatorFactsVersion: "1",
      },
      applicationBlockedReason: null,
    });
    const creator = cell.requestClass === "AUTHENTICATED_CREATOR";
    const entitled =
      cell.visibility === "EVERYONE" ||
      (cell.visibility === "ELIGIBLE_ONLY" &&
        cell.eligibility === "ELIGIBLE") ||
      cell.invitation === "VALID";
    const authorized = creator && cell.ig === 1 && entitled;
    const expected = authorized
      ? "AUTHORIZED"
      : !creator && cell.visibility === "EVERYONE"
        ? "TEASER"
        : "LOCKED";
    expect(result.state).toBe(expected);
    const raw = JSON.parse(JSON.stringify(result));
    if (authorized) {
      expect(raw.campaign.commercial.offer).toBe("120");
      expect(raw.assets[0].briefs[0].definition.creatorBrief).toBe(
        "sensitive detail",
      );
      expect(raw.canApply).toBe(cell.open);
      expect(raw.applyBlockedReason).toBe(
        cell.open ? null : "CAMPAIGN_APPLICATIONS_CLOSED",
      );
    } else {
      expect(JSON.stringify(raw)).not.toMatch(
        /commercial|sensitive detail|brief|native-test-identity/,
      );
      expect(raw).not.toHaveProperty("canApply");
      expect(raw).toHaveProperty("reason");
      expect(raw).toHaveProperty("recoveryAction");
      const generic = !entitled && cell.invitation === "ABSENT";
      if (generic || (!creator && cell.visibility !== "EVERYONE")) {
        expect(raw.reason).toBe("OPPORTUNITY_NOT_AVAILABLE");
        expect(raw.recoveryAction).toBeNull();
      } else if (creator && cell.ig !== 1) {
        expect(raw.reason).toBe(expectedStates[cell.ig]);
        expect(raw.recoveryAction).toBe(
          [
            "CONNECT_INSTAGRAM",
            null,
            "REVALIDATE_INSTAGRAM",
            "RECONNECT_INSTAGRAM",
            "REVALIDATE_INSTAGRAM",
            "RECONNECT_INSTAGRAM",
          ][cell.ig],
        );
      }
      if (expected === "LOCKED") expect(raw).not.toHaveProperty("campaign");
    }
  });
  it.each(["OWNER", "MANAGER", "ASSISTANT"] as const)(
    "projects separate actions for %s",
    (role) => {
      const actions = creatorWorkspaceActionsForRole(role);
      expect(actions).toContain("CAMPAIGN_OPPORTUNITY_VIEW");
      expect(actions).toContain("CAMPAIGN_APPLICATION_APPLY");
      expect(actions.includes("CAMPAIGN_APPLICATION_WITHDRAW_PENDING")).toBe(
        role !== "ASSISTANT",
      );
      expect(actions.includes("TEAM_MANAGE")).toBe(role !== "ASSISTANT");
    },
  );
  it("fails expired known timestamps despite ACTIVE state", () => {
    expect(
      evaluateInstagramOpportunity({ ...healthy, tokenExpiresAt: now }, now),
    ).toMatchObject({
      usableForOpportunity: false,
      recoveryAction: "RECONNECT_INSTAGRAM",
    });
  });
});
