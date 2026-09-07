import { Injectable } from "@nestjs/common";

import type { IntelligenceConsumerResult } from "../intelligence-consumer/intelligence-consumer.contract";
import type { BrandHomeCandidate } from "./brand-home.types";

type CollaborationRow = Readonly<{
  collaborationId: string;
  campaign: Readonly<{ id: string; name: string }>;
  brief: Readonly<{ id: string; title: string }>;
  lifecycle: Readonly<{
    stage: string;
    status: string;
    phase: string;
    paused: boolean;
    terminated: boolean;
  }>;
  attention: Readonly<{
    health: string;
    actionRequiredBy: string;
    reasonCodes: readonly string[];
    dueAt: string;
  }>;
  stageUpdatedAt: string;
  updatedAt: string;
}>;

type WorkspaceReadiness = Readonly<{
  observedAt: string;
  workspace: Readonly<{ state: string }>;
  setupItems: readonly Readonly<{
    reasonCode: string;
    title: string;
    destinationId: string;
  }>[];
}>;

type ProviderReadiness = Readonly<{
  observedAt: string;
  providers: readonly Readonly<{
    provider: string;
    state: string;
    reasonCode: string;
    affectedProductCapabilities: readonly string[];
    humanActionRequired: boolean;
  }>[];
}>;

type Offering = Readonly<{
  offeringId: string;
  name: string;
  lifecycle: string;
}>;

type Campaign = Readonly<{
  campaignId: string;
  name: string;
  status: string;
  updatedAt: string;
}>;

@Injectable()
export class BrandHomeClassifierService {
  collaboration(
    row: CollaborationRow,
    observedAt: string,
  ): BrandHomeCandidate[] {
    const entityRef = {
      type: "COLLABORATION" as const,
      id: row.collaborationId,
    };
    const candidates: BrandHomeCandidate[] = [];
    const dueAt = this.isoOrNull(row.attention.dueAt);
    const overdue = dueAt !== null && dueAt < observedAt;
    const blocked = /BLOCKED|FAILED/u.test(row.attention.health);
    const brandActionRequired = row.attention.actionRequiredBy === "BRAND";
    if (
      brandActionRequired &&
      (overdue || row.attention.health !== "ON_TRACK")
    ) {
      const reasonCode = blocked
        ? "COLLABORATION_ACTION_BLOCKED"
        : overdue
          ? "COLLABORATION_ACTION_OVERDUE"
          : "COLLABORATION_ACTION_REQUIRED";
      candidates.push({
        id: this.itemId(reasonCode, entityRef.type, entityRef.id),
        sectionId: "NEEDS_ATTENTION",
        deduplicationKey: `COLLABORATION_ACTION:${row.collaborationId}`,
        kind: "COLLABORATION_ATTENTION",
        reasonCode,
        priorityTier: blocked
          ? "BLOCKED_FAILED_ACTION_REQUIRED"
          : "DEADLINE_SLA_TIME_SENSITIVE",
        title: `Review ${row.campaign.name} collaboration`,
        summary: overdue
          ? `Brand action for ${row.brief.title} is overdue.`
          : `Brand action is required for ${row.brief.title}.`,
        entityRefs: [entityRef, { type: "CAMPAIGN", id: row.campaign.id }],
        navigation: {
          destinationId: "COLLABORATIONS",
          entityRef,
        },
        freshness: {
          state: "CURRENT",
          observedAt,
          changedAt: this.isoOrNull(row.updatedAt),
          dueAt,
        },
        sourceDomains: ["COLLABORATION"],
        limitations: [],
      });
    }

    if (
      !row.lifecycle.paused &&
      !row.lifecycle.terminated &&
      row.lifecycle.status === "ACTIVE_WORKFLOW"
    ) {
      candidates.push({
        id: this.itemId(
          "COLLABORATION_STAGE_PROGRESS",
          entityRef.type,
          entityRef.id,
        ),
        sectionId: "CURRENT_MOMENTUM",
        deduplicationKey: `COLLABORATION_PROGRESS:${row.collaborationId}`,
        kind: "COLLABORATION_MOMENTUM",
        reasonCode: "COLLABORATION_STAGE_PROGRESS",
        priorityTier: "MEANINGFUL_MOMENTUM",
        title: `${row.campaign.name} collaboration is progressing`,
        summary: `The collaboration is in ${row.lifecycle.stage}.`,
        entityRefs: [entityRef, { type: "CAMPAIGN", id: row.campaign.id }],
        navigation: { destinationId: "COLLABORATIONS", entityRef },
        freshness: {
          state: "CURRENT",
          observedAt,
          changedAt: this.isoOrNull(row.stageUpdatedAt),
          dueAt: null,
        },
        sourceDomains: ["COLLABORATION"],
        limitations: [],
      });
    }
    return candidates;
  }

  workspace(
    readiness: WorkspaceReadiness,
    brandId: string,
    observedAt: string,
  ): BrandHomeCandidate[] {
    if (readiness.workspace.state !== "ACTION_REQUIRED") return [];
    return readiness.setupItems
      .filter((item) => item.reasonCode !== "BRAND_WORKSPACE_PARTIAL")
      .map((item) => {
        const destinationId = ["SETTINGS_BILLING", "BRAND_CENTRE"].includes(
          item.destinationId,
        )
          ? (item.destinationId as "SETTINGS_BILLING" | "BRAND_CENTRE")
          : ("SETTINGS" as const);
        return {
          id: this.itemId(item.reasonCode, "BRAND", brandId),
          sectionId: "NEEDS_ATTENTION" as const,
          deduplicationKey: `WORKSPACE:${item.reasonCode}:${brandId}`,
          kind: "WORKSPACE_SETUP" as const,
          reasonCode: item.reasonCode,
          priorityTier: "MATERIAL_SETUP_CAPABILITY_BLOCKER" as const,
          title: item.title,
          summary:
            "Complete this setup item to restore the affected workspace capability.",
          entityRefs: [{ type: "BRAND" as const, id: brandId }],
          navigation: { destinationId },
          freshness: {
            state: "CURRENT" as const,
            observedAt,
            changedAt: null,
            dueAt: null,
          },
          sourceDomains: ["WORKSPACE_READINESS" as const],
          limitations: [],
        };
      });
  }

  provider(
    readiness: ProviderReadiness,
    brandId: string,
    observedAt: string,
  ): BrandHomeCandidate[] {
    const materialCapabilities = new Set([
      "INSIGHTS",
      "BUSINESS_DISCOVERY",
      "CREATOR_DISCOVERY",
    ]);
    return readiness.providers.flatMap((provider) => {
      const material = provider.affectedProductCapabilities.some((capability) =>
        materialCapabilities.has(capability),
      );
      if (
        !material ||
        !provider.humanActionRequired ||
        !["ACTION_REQUIRED", "UNAVAILABLE"].includes(provider.state)
      ) {
        return [];
      }
      return [
        {
          id: this.itemId(provider.reasonCode, "BRAND", brandId),
          sectionId: "NEEDS_ATTENTION" as const,
          deduplicationKey: `PROVIDER_RECOVERY:${provider.provider}:${brandId}`,
          kind: "PROVIDER_RECOVERY" as const,
          reasonCode: provider.reasonCode,
          priorityTier: "MATERIAL_SETUP_CAPABILITY_BLOCKER" as const,
          title: `Reconnect ${this.titleCase(provider.provider)}`,
          summary:
            "Reconnect the provider to restore affected discovery and insights capabilities.",
          entityRefs: [{ type: "BRAND" as const, id: brandId }],
          navigation: { destinationId: "SETTINGS_INTEGRATIONS" as const },
          freshness: {
            state: "UNKNOWN" as const,
            observedAt,
            changedAt: null,
            dueAt: null,
          },
          sourceDomains: ["PROVIDER_READINESS" as const],
          limitations: [],
        },
      ];
    });
  }

  brandIntelligence(
    result: IntelligenceConsumerResult,
    brandId: string,
    observedAt: string,
  ): BrandHomeCandidate[] {
    const object = result.objects.find(
      (candidate) => candidate.objectId === "differentiation_and_proof",
    );
    if (
      !object ||
      object.current.kind !== "VALUE" ||
      !["CURRENT", "STALE"].includes(object.freshness)
    ) {
      return [];
    }
    const entityRef = { type: "BRAND" as const, id: brandId };
    return [
      {
        id: this.itemId(
          "BRAND_DIFFERENTIATION_CURRENT",
          entityRef.type,
          entityRef.id,
        ),
        sectionId: "CREATOR_SHOP_HAS_LEARNED",
        deduplicationKey: `BRAND_INTELLIGENCE:differentiation_and_proof:${brandId}`,
        kind: "BRAND_INTELLIGENCE_LEARNED",
        reasonCode: "BRAND_DIFFERENTIATION_CURRENT",
        priorityTier: "NEW_OR_CHANGED_INTELLIGENCE",
        title: "Creator Shop has learned what differentiates your Brand",
        summary:
          "Current Brand Intelligence includes differentiation and supporting proof.",
        entityRefs: [entityRef],
        navigation: { destinationId: "BRAND_CENTRE", entityRef },
        freshness: {
          state: object.freshness,
          observedAt,
          changedAt: object.changedAt,
          dueAt: null,
        },
        sourceDomains: ["BRAND_INTELLIGENCE"],
        limitations:
          object.freshness === "STALE"
            ? ["This Intelligence is stale and reflects the last good state."]
            : object.readiness === "PARTIAL"
              ? ["This Intelligence is materially partial."]
              : [],
      },
    ];
  }

  offeringOpportunity(
    offering: Offering,
    result: IntelligenceConsumerResult,
    observedAt: string,
  ): BrandHomeCandidate[] {
    const object = result.objects.find(
      (candidate) => candidate.objectId === "offering_actionability_profile",
    );
    if (
      offering.lifecycle !== "ACTIVE" ||
      !object ||
      object.current.kind !== "VALUE" ||
      object.readiness === "NOT_READY" ||
      object.freshness !== "CURRENT"
    ) {
      return [];
    }
    const entityRef = { type: "OFFERING" as const, id: offering.offeringId };
    return [
      {
        id: this.itemId(
          "OFFERING_ACTIONABILITY_CURRENT",
          entityRef.type,
          entityRef.id,
        ),
        sectionId: "OPPORTUNITIES_NEXT_ACTIONS",
        deduplicationKey: `OFFERING_ACTION:${offering.offeringId}`,
        kind: "OFFERING_OPPORTUNITY",
        reasonCode: "OFFERING_ACTIONABILITY_CURRENT",
        priorityTier: "MATERIAL_OPPORTUNITY",
        title: `Review the opportunity for ${offering.name}`,
        summary:
          "Current Product Intelligence contains a bounded actionability profile for this Offering.",
        entityRefs: [entityRef],
        navigation: { destinationId: "OFFERINGS", entityRef },
        freshness: {
          state: object.freshness,
          observedAt,
          changedAt: object.changedAt,
          dueAt: null,
        },
        sourceDomains: ["OFFERING", "PRODUCT_INTELLIGENCE"],
        limitations:
          object.readiness === "PARTIAL"
            ? ["This opportunity is based on materially partial Intelligence."]
            : [],
        recommendation: {
          text: `Review the current actionability profile for ${offering.name}.`,
          basisRefs: [object.current.resultRef],
          nonMutating: true,
        },
      },
    ];
  }

  campaign(campaign: Campaign, observedAt: string): BrandHomeCandidate[] {
    if (campaign.status !== "LIVE") return [];
    const entityRef = { type: "CAMPAIGN" as const, id: campaign.campaignId };
    return [
      {
        id: this.itemId("CAMPAIGN_LIVE_MOMENTUM", entityRef.type, entityRef.id),
        sectionId: "CURRENT_MOMENTUM",
        deduplicationKey: `CAMPAIGN_MOMENTUM:${campaign.campaignId}`,
        kind: "CAMPAIGN_MOMENTUM",
        reasonCode: "CAMPAIGN_LIVE_MOMENTUM",
        priorityTier: "MEANINGFUL_MOMENTUM",
        title: `${campaign.name} is live`,
        summary: "This Campaign is currently live and contributing momentum.",
        entityRefs: [entityRef],
        navigation: { destinationId: "CAMPAIGNS", entityRef },
        freshness: {
          state: "CURRENT",
          observedAt,
          changedAt: this.isoOrNull(campaign.updatedAt),
          dueAt: null,
        },
        sourceDomains: ["CAMPAIGN"],
        limitations: [],
      },
    ];
  }

  private itemId(reasonCode: string, entityType: string, entityId: string) {
    return `home:v1:${reasonCode}:${entityType}:${entityId}`;
  }

  private isoOrNull(value: string | null | undefined): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
  }

  private titleCase(value: string): string {
    const normalized = value.toLocaleLowerCase();
    return normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
  }
}
