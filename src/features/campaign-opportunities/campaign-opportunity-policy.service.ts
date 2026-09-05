import { Injectable } from "@nestjs/common";

import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import type { evaluateInstagramOpportunity } from "../../shared/creator/instagram-opportunity-capability";
import type { projectCanonicalCampaignForApplication } from "../brand-uce/services/canonical-campaign-application-read.service";
import type { OpportunityEligibility } from "./campaign-opportunity-eligibility";

export type CampaignRead = ReturnType<
  typeof projectCanonicalCampaignForApplication
>;
export type InvitationResult =
  | "ABSENT"
  | "VALID"
  | "EXPIRED"
  | "REVOKED"
  | "SUBJECT_MISMATCH";
export type OpportunityPolicyInput = {
  campaign: CampaignRead | null;
  requestClass: "ANONYMOUS" | "AUTHENTICATED_CREATOR" | "OTHER_ACCOUNT";
  actor: CreatorWorkspaceActorContext | null;
  instagram: ReturnType<typeof evaluateInstagramOpportunity>;
  eligibility: OpportunityEligibility;
  invitation: InvitationResult;
  applicationBlockedReason: string | null;
  qualifiedContext?: boolean;
  now: Date;
};
export type OpportunityAccess =
  | {
      schemaVersion: 1;
      state: "TEASER";
      reason: string;
      recoveryAction: "SIGN_IN_OR_CREATE_CREATOR";
      campaign: { id: string; name: string; platforms: string[] };
    }
  | {
      schemaVersion: 1;
      state: "LOCKED";
      reason: string;
      recoveryAction: string | null;
    }
  | {
      schemaVersion: 1;
      state: "AUTHORIZED";
      applicationsOpen: boolean;
      canApply: boolean;
      applyBlockedReason: string | null;
      applicationDeadline: string | null;
      campaign: {
        id: string;
        name: string;
        platforms: string[];
        brand: CampaignRead["campaign"]["brand"];
        objective: string | null;
        publishingStart: string | null;
        publishingEnd: string | null;
        commercial:
          | {
              compensationModel: "FIXED" | "NEGOTIABLE";
              offer: string;
              currency: string;
              receivesBrandSupport: boolean;
              brandSupportType: string | null;
              brandSupportEstimatedValue: string | null;
            }
          | { state: "UNAVAILABLE" };
      };
      assets: CampaignRead["assets"];
    };

@Injectable()
export class CampaignOpportunityPolicyService {
  canStartContinuation(
    campaign: CampaignRead | null,
    access: OpportunityAccess,
    provenInvitation: boolean,
  ): boolean {
    if (
      !campaign ||
      ["DRAFT", "ARCHIVED"].includes(campaign.campaign.status) ||
      campaign.campaign.visibility.state !== "AVAILABLE"
    )
      return false;
    return (
      provenInvitation ||
      campaign.campaign.visibility.value === "EVERYONE" ||
      access.state === "AUTHORIZED"
    );
  }

  evaluate(input: OpportunityPolicyInput): OpportunityAccess {
    const lock = (
      reason: string,
      recoveryAction: string | null = null,
    ): OpportunityAccess => ({
      schemaVersion: 1,
      state: "LOCKED",
      reason,
      recoveryAction,
    });
    const read = input.campaign;
    if (!read || ["DRAFT", "ARCHIVED"].includes(read.campaign.status))
      return lock("OPPORTUNITY_NOT_AVAILABLE");
    const campaign = read.campaign;
    if (campaign.visibility.state !== "AVAILABLE")
      return lock("CAMPAIGN_VISIBILITY_CONFIGURATION_INVALID");
    const visibility = campaign.visibility.value;
    const visibilityEntitled =
      visibility === "EVERYONE" ||
      input.invitation === "VALID" ||
      (visibility === "ELIGIBLE_ONLY" &&
        input.eligibility.result === "ELIGIBLE");
    if (
      !visibilityEntitled &&
      !input.qualifiedContext &&
      input.invitation === "ABSENT"
    ) {
      return lock("OPPORTUNITY_NOT_AVAILABLE");
    }
    if (input.requestClass !== "AUTHENTICATED_CREATOR") {
      if (visibility !== "EVERYONE") return lock("OPPORTUNITY_NOT_AVAILABLE");
      return {
        schemaVersion: 1,
        state: "TEASER",
        reason:
          input.requestClass === "ANONYMOUS"
            ? "AUTHENTICATION_REQUIRED"
            : "CREATOR_ACCOUNT_REQUIRED",
        recoveryAction: "SIGN_IN_OR_CREATE_CREATOR",
        campaign: {
          id: campaign.id,
          name: campaign.name,
          platforms: campaign.platforms,
        },
      };
    }
    if (!input.actor?.allowedActions.includes("CAMPAIGN_OPPORTUNITY_VIEW"))
      return lock("CREATOR_CONTEXT_REQUIRED", "RESOLVE_CREATOR_CONTEXT");
    if (!input.instagram.usableForOpportunity)
      return lock(
        input.instagram.lifecycleState,
        input.instagram.recoveryAction,
      );
    if (visibility === "INVITED_ONLY" && input.invitation !== "VALID") {
      return lock(
        `INVITATION_${input.invitation === "ABSENT" ? "REQUIRED" : input.invitation}`,
        input.invitation === "SUBJECT_MISMATCH" ? "USE_INVITED_ACCOUNT" : null,
      );
    }
    if (
      visibility === "ELIGIBLE_ONLY" &&
      input.invitation !== "VALID" &&
      input.eligibility.result !== "ELIGIBLE"
    ) {
      return lock(
        `ELIGIBILITY_${input.eligibility.result}`,
        input.eligibility.result === "UNAVAILABLE" ? "RETRY_LATER" : null,
      );
    }
    const applicationsOpen =
      ["PUBLISHED", "LIVE"].includes(campaign.status) &&
      (!campaign.applicationDeadline ||
        campaign.applicationDeadline > input.now);
    const selectable = read.assets.some((asset) =>
      asset.briefs.some(
        (brief) => brief.applicationSelection.state === "AVAILABLE",
      ),
    );
    const applyBlockedReason = !applicationsOpen
      ? "CAMPAIGN_APPLICATIONS_CLOSED"
      : !input.actor.allowedActions.includes("CAMPAIGN_APPLICATION_APPLY")
        ? "APPLICATION_ROLE_DENIED"
        : !selectable
          ? "CAMPAIGN_BRIEF_UNAVAILABLE"
          : campaign.commercial.state !== "AVAILABLE"
            ? "CAMPAIGN_COMMERCIAL_CONFIGURATION_INVALID"
            : input.applicationBlockedReason;
    const commercial = campaign.commercial;
    return {
      schemaVersion: 1,
      state: "AUTHORIZED",
      applicationsOpen,
      canApply: applyBlockedReason === null,
      applyBlockedReason,
      applicationDeadline: campaign.applicationDeadline?.toISOString() ?? null,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        platforms: campaign.platforms,
        brand: campaign.brand,
        objective: campaign.objective,
        publishingStart: campaign.publishingStart?.toISOString() ?? null,
        publishingEnd: campaign.publishingEnd?.toISOString() ?? null,
        commercial:
          commercial.state === "AVAILABLE"
            ? {
                compensationModel:
                  commercial.compensationType === "FIXED_FEE"
                    ? "FIXED"
                    : "NEGOTIABLE",
                offer: commercial.commercialOffer.toString(),
                currency: commercial.currency,
                receivesBrandSupport: commercial.receivesBrandSupport,
                brandSupportType: commercial.brandSupportType,
                brandSupportEstimatedValue:
                  commercial.brandSupportEstimatedValue?.toString() ?? null,
              }
            : { state: "UNAVAILABLE" },
      },
      assets: read.assets.map((asset) => ({
        ...asset,
        briefs: asset.briefs.filter((brief) => brief.status !== "DRAFT"),
      })),
    };
  }
}
