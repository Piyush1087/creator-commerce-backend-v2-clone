import { Injectable } from "@nestjs/common";
import { CoPilotScopeContext } from "@prisma/client";

import { isDnaIdentityReadQuery } from "../utils/co-pilot-dna-identity.util";
import {
  isPlannerLaunchGuidanceQuery,
  isPlannerPipelineReadQuery,
  mentionsPlanner,
} from "../utils/co-pilot-planner.util";

export type ReadQueryKind =
  | "NONE"
  | "ESCROW_AUDIT"
  | "ESCROW_TDS"
  | "ESCROW_SETUP"
  | "COLLAB_PIPELINE"
  | "COLLAB_ISSUES"
  | "DNA_COMPLIANCE"
  | "BRAND_CENTRE_GREETING"
  | "BRAND_CENTRE_OVERVIEW"
  | "BRAND_CENTRE_COMPLETENESS"
  | "BRAND_CENTRE_READINESS"
  | "BRAND_CENTRE_DNA_BLOCKS"
  | "BRAND_CENTRE_LEAKS"
  | "BRAND_CENTRE_PERSONAS"
  | "BRAND_CENTRE_COMPETITOR_INSIGHTS"
  | "BRAND_CENTRE_VISUAL_IDENTITY"
  | "PLANNER_PIPELINE"
  | "CAMPAIGN_DRAFT_LIST"
  | "BRAND_CENTRE_DEFAULT";

@Injectable()
export class CoPilotScopeRouterService {
  resolveReadQuery(userText: string, scopeContext: CoPilotScopeContext): ReadQueryKind {
    const n = userText.toLowerCase();

    if (this.isEscrowSetupQuery(n, scopeContext)) {
      return "ESCROW_SETUP";
    }

    if (
      scopeContext === CoPilotScopeContext.ESCROW ||
      n.includes("escrow") ||
      n.includes("ledger") ||
      n.includes("financial audit")
    ) {
      if (n.includes("tds") || n.includes("tax buffer")) {
        return "ESCROW_TDS";
      }
      return "ESCROW_AUDIT";
    }

    if (
      n.includes("collaboration") ||
      n.includes("collab") ||
      n.includes("logistics") ||
      n.includes("production stage") ||
      n.includes("fulfillment issue")
    ) {
      if (
        n.includes("issue") ||
        n.includes("rejection") ||
        n.includes("fulfillment")
      ) {
        return "COLLAB_ISSUES";
      }
      return "COLLAB_PIPELINE";
    }

    if (
      n.includes("do-not-say") ||
      n.includes("do not say") ||
      n.includes("compliance") ||
      n.includes("restricted words")
    ) {
      return "DNA_COMPLIANCE";
    }

    if (this.isVisualIdentityReadQuery(n)) {
      return "BRAND_CENTRE_VISUAL_IDENTITY";
    }

    if (this.isPersonasReadQuery(n)) {
      return "BRAND_CENTRE_PERSONAS";
    }

    if (this.isCompetitorInsightsReadQuery(n)) {
      return "BRAND_CENTRE_COMPETITOR_INSIGHTS";
    }

    if (isPlannerLaunchGuidanceQuery(userText) || isPlannerPipelineReadQuery(userText)) {
      return "PLANNER_PIPELINE";
    }

    if (this.isCampaignDraftListReadQuery(n)) {
      return "CAMPAIGN_DRAFT_LIST";
    }

    if (this.isDnaBlocksReadQuery(n)) {
      return "BRAND_CENTRE_DNA_BLOCKS";
    }

    if (this.isLeaksReadQuery(n)) {
      return "BRAND_CENTRE_LEAKS";
    }

    if (
      n.includes("incomplete") ||
      n.includes("completeness") ||
      n.includes("flagged")
    ) {
      return "BRAND_CENTRE_COMPLETENESS";
    }

    if (
      n.includes("launch readiness") ||
      (n.includes("readiness") && !n.includes("campaign")) ||
      n.includes("before uce launch") ||
      (n.includes("what should we fix") && n.includes("uce"))
    ) {
      return "BRAND_CENTRE_READINESS";
    }

    if (
      n.includes("overview") ||
      (n.includes("brand centre") &&
        (n.includes("read-only") ||
          n.includes("give me") ||
          n.includes("snapshot") ||
          n.includes("together"))) ||
      (n.includes("dna and intelligence") &&
        (n.includes("overview") ||
          n.includes("read-only") ||
          n.includes("give me") ||
          n.includes("together") ||
          n.includes("before we plan")))
    ) {
      return "BRAND_CENTRE_OVERVIEW";
    }

    const trimmed = userText.trim();
    if (this.isCasualGreeting(trimmed)) {
      return "BRAND_CENTRE_GREETING";
    }

    return "BRAND_CENTRE_DEFAULT";
  }

  private isCasualGreeting(trimmed: string): boolean {
    const lower = trimmed.toLowerCase();
    if (
      /^(hi|hello|hey|yo|howdy|sup|hiya)\b[!?.]*$/i.test(trimmed) ||
      /^good\s+(morning|afternoon|evening)\b[!?.]*$/i.test(trimmed) ||
      /^(test|testing)\s*[!?.]*$/i.test(trimmed)
    ) {
      return true;
    }

    return (
      trimmed.length <= 20 &&
      /^(hi|hello|hey)\b/i.test(trimmed) &&
      !lower.includes("overview") &&
      !lower.includes("campaign")
    );
  }

  private isPersonasReadQuery(normalizedText: string): boolean {
    return (
      (normalizedText.includes("persona") &&
        (normalizedText.includes("breakdown") ||
          normalizedText.includes("psychographic") ||
          normalizedText.includes("audience") ||
          normalizedText.includes("show me") ||
          normalizedText.includes("list"))) ||
      normalizedText.includes("target demographic")
    );
  }

  private isCompetitorInsightsReadQuery(normalizedText: string): boolean {
    return (
      (normalizedText.includes("competitor") &&
        (normalizedText.includes("streak") ||
          normalizedText.includes("rival") ||
          normalizedText.includes("winning creative") ||
          normalizedText.includes("market positioning") ||
          normalizedText.includes("share of voice"))) ||
      normalizedText.includes("creative streak") ||
      normalizedText.includes("winning creative")
    );
  }

  private isCampaignDraftListReadQuery(normalizedText: string): boolean {
    if (mentionsPlanner(normalizedText)) {
      return false;
    }
    return (
      (normalizedText.includes("draft") && normalizedText.includes("campaign")) ||
      normalizedText.includes("draft campaigns") ||
      normalizedText.includes("list my drafts")
    );
  }

  private isLeaksReadQuery(normalizedText: string): boolean {
    if (
      normalizedText.includes("overview") ||
      normalizedText.includes("brand centre") ||
      normalizedText.includes("dna and intelligence")
    ) {
      return false;
    }

    return (
      normalizedText.includes("leak") ||
      normalizedText.includes("intelligence gap")
    );
  }

  private isDnaBlocksReadQuery(normalizedText: string): boolean {
    if (
      normalizedText.includes("overview") ||
      normalizedText.includes("brand centre") ||
      normalizedText.includes("dna and intelligence")
    ) {
      return false;
    }

    return (
      normalizedText.includes("dna block") ||
      normalizedText.includes("core block") ||
      normalizedText.includes("core dna") ||
      (normalizedText.includes("dna") &&
        (normalizedText.includes("what is") ||
          normalizedText.includes("what are") ||
          normalizedText.includes("list them") ||
          normalizedText.includes("list out") ||
          normalizedText.includes("list the")))
    );
  }

  private isVisualIdentityReadQuery(normalizedText: string): boolean {
    const isWrite =
      /\b(update|change|set|apply|restrict|add)\b/.test(normalizedText) ||
      normalizedText.includes("font to");

    if (isWrite) {
      return false;
    }

    if (isDnaIdentityReadQuery(normalizedText)) {
      return true;
    }

    return (
      normalizedText.includes("visual identity") ||
      normalizedText.includes("visual dna") ||
      normalizedText.includes("color palette") ||
      normalizedText.includes("colour palette") ||
      normalizedText.includes("our colors") ||
      normalizedText.includes("our colours") ||
      normalizedText.includes("our fonts") ||
      normalizedText.includes("aesthetic dna") ||
      (normalizedText.includes("visual") &&
        (normalizedText.includes("identity") ||
          normalizedText.includes("aesthetic") ||
          normalizedText.includes("look") ||
          normalizedText.includes("dna")))
    );
  }

  private isEscrowSetupQuery(
    normalizedText: string,
    scopeContext: CoPilotScopeContext,
  ): boolean {
    const escrowContext =
      scopeContext === CoPilotScopeContext.ESCROW ||
      normalizedText.includes("escrow") ||
      normalizedText.includes("vault");

    if (!escrowContext) {
      return false;
    }

    return (
      normalizedText.includes("turn on") ||
      normalizedText.includes("enable") ||
      normalizedText.includes("initialize") ||
      normalizedText.includes("initialise") ||
      normalizedText.includes("set up") ||
      normalizedText.includes("setup") ||
      normalizedText.includes("which url") ||
      normalizedText.includes("what url") ||
      normalizedText.includes("where can i") ||
      normalizedText.includes("where do i") ||
      normalizedText.includes("how do i") ||
      normalizedText.includes("how to") ||
      normalizedText.includes("not initialized")
    );
  }
}
