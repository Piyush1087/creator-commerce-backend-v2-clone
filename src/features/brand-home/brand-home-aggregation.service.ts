import { Injectable } from "@nestjs/common";

import type { AuthUser } from "../auth/types/auth-user";
import { BrandCurrentReadService } from "../brand-centre/consumer/brand-current-read.service";
import { CanonicalOfferingDiscoveryService } from "../brand-centre/consumer/canonical-offering-discovery.service";
import { BrandWorkspaceAuthorizationService } from "../brand-centre/brand-workspace-authorization.service";
import { BrandProviderReadinessService } from "../brand-settings/services/brand-provider-readiness.service";
import { BrandCampaignConsumerService } from "../brand-uce/consumer/brand-campaign-consumer.service";
import { BrandWorkspaceReadinessConsumerService } from "../brand-workspace-readiness/brand-workspace-readiness-consumer.service";
import { CollaborationConsumerService } from "../collaboration/services/collaboration-consumer.service";
import type { IntelligenceConsumerResult } from "../intelligence-consumer/intelligence-consumer.contract";
import { IntelligenceConsumerService } from "../intelligence-consumer/intelligence-consumer.service";
import { BrandHomeClassifierService } from "./brand-home-classifier.service";
import { BrandHomeClock } from "./brand-home.clock";
import {
  BRAND_HOME_SECTION_IDS,
  type BrandHomeSectionId,
  type BrandHomeSourceDomain,
} from "./brand-home.contract";
import { BrandHomeDuplicateSuppressor } from "./brand-home-duplicate-suppressor.service";
import { BrandHomePrioritizer } from "./brand-home-prioritizer.service";
import {
  BrandHomeResponseSchema,
  type BrandHomeItem,
} from "./brand-home.schema";
import type {
  BrandHomeCandidate,
  BrandHomeSourceState,
} from "./brand-home.types";

const HOME_COLLABORATION_LIMIT = 50;
const HOME_OFFERING_LIMIT = 20;
const HOME_CAMPAIGN_LIMIT = 50;

type Collected<T> = Readonly<{
  data: T | null;
  state: "READY" | "PARTIAL" | "UNAVAILABLE";
  limitations: string[];
}>;

type ProductIntelligenceEntry = Readonly<{
  offering: Readonly<{
    offeringId: string;
    name: string;
    lifecycle: string;
  }>;
  intelligence: IntelligenceConsumerResult;
}>;

@Injectable()
export class BrandHomeAggregationService {
  constructor(
    private readonly workspace: BrandWorkspaceAuthorizationService,
    private readonly brands: BrandCurrentReadService,
    private readonly offerings: CanonicalOfferingDiscoveryService,
    private readonly intelligence: IntelligenceConsumerService,
    private readonly collaborations: CollaborationConsumerService,
    private readonly workspaceReadiness: BrandWorkspaceReadinessConsumerService,
    private readonly providerReadiness: BrandProviderReadinessService,
    private readonly campaigns: BrandCampaignConsumerService,
    private readonly classifier: BrandHomeClassifierService,
    private readonly prioritizer: BrandHomePrioritizer,
    private readonly duplicateSuppressor: BrandHomeDuplicateSuppressor,
    private readonly clock: BrandHomeClock,
  ) {}

  async read(user: AuthUser) {
    const generatedAt = this.clock.now().toISOString();
    const { brandProfileId } = await this.workspace.resolveBrandContext(user);
    const [brand, collaborations, workspaceReadiness, providerReadiness] =
      await Promise.all([
        this.collect("BRAND", () => this.brands.read(brandProfileId)),
        this.collect("COLLABORATION", () =>
          this.collaborations.listForHome(user, HOME_COLLABORATION_LIMIT),
        ),
        this.collect("WORKSPACE_READINESS", () =>
          this.workspaceReadiness.read(user),
        ),
        this.collect("PROVIDER_READINESS", () =>
          this.providerReadiness.read(user),
        ),
      ]);
    const [brandIntelligence, offeringIndex, campaigns] = await Promise.all([
      this.collect("BRAND_INTELLIGENCE", () =>
        this.intelligence.read(user, "brand_intelligence", {
          type: "BRAND",
          id: brandProfileId,
        }),
      ),
      this.collect("OFFERING", () =>
        this.offerings.listBounded(user, HOME_OFFERING_LIMIT),
      ),
      this.collect("CAMPAIGN", () =>
        this.campaigns.listForHome(brandProfileId, HOME_CAMPAIGN_LIMIT),
      ),
    ]);
    const productIntelligence = await this.collectProductIntelligence(
      user,
      offeringIndex,
    );

    const candidates: BrandHomeCandidate[] = [];
    for (const collaboration of collaborations.data?.collaborations ?? []) {
      candidates.push(
        ...this.classifier.collaboration(collaboration, generatedAt),
      );
    }
    if (workspaceReadiness.data) {
      candidates.push(
        ...this.classifier.workspace(
          workspaceReadiness.data,
          brandProfileId,
          generatedAt,
        ),
      );
    }
    if (providerReadiness.data) {
      candidates.push(
        ...this.classifier.provider(
          providerReadiness.data,
          brandProfileId,
          generatedAt,
        ),
      );
    }
    if (brandIntelligence.data) {
      candidates.push(
        ...this.classifier.brandIntelligence(
          brandIntelligence.data,
          brandProfileId,
          generatedAt,
        ),
      );
    }
    for (const entry of productIntelligence.data ?? []) {
      candidates.push(
        ...this.classifier.offeringOpportunity(
          entry.offering,
          entry.intelligence,
          generatedAt,
        ),
      );
    }
    for (const campaign of campaigns.data?.campaigns ?? []) {
      candidates.push(...this.classifier.campaign(campaign, generatedAt));
    }

    const sourceStates: BrandHomeSourceState[] = [
      this.sourceState("BRAND", brand),
      this.sourceState("WORKSPACE_READINESS", workspaceReadiness),
      this.sourceState("PROVIDER_READINESS", providerReadiness),
      this.sourceState(
        "COLLABORATION",
        collaborations,
        collaborations.data?.truncated ?? false,
      ),
      this.sourceState("BRAND_INTELLIGENCE", brandIntelligence),
      this.sourceState(
        "OFFERING",
        offeringIndex,
        offeringIndex.data?.truncated ?? false,
      ),
      this.sourceState("PRODUCT_INTELLIGENCE", productIntelligence),
      this.sourceState(
        "CAMPAIGN",
        campaigns,
        campaigns.data?.truncated ?? false,
      ),
    ];
    const deduplicated = this.duplicateSuppressor.suppress(candidates);
    const sections = BRAND_HOME_SECTION_IDS.map((sectionId) => {
      const items = this.prioritizer
        .sort(
          sectionId,
          deduplicated.filter((candidate) => candidate.sectionId === sectionId),
        )
        .map((candidate) => this.publicItem(candidate));
      return {
        id: sectionId,
        state: this.sectionState(sectionId, items, sourceStates),
        items,
      };
    });
    const limitations = this.unique(
      sourceStates.flatMap((source) => source.limitations),
    );
    const availableSourceCount = sourceStates.filter(
      (source) => source.state !== "UNAVAILABLE",
    ).length;
    const status =
      availableSourceCount === 0
        ? ("UNAVAILABLE" as const)
        : sourceStates.some((source) => source.state !== "READY")
          ? ("PARTIAL" as const)
          : ("READY" as const);
    const displayName =
      brand.data?.fields
        .find((field) => field.semantic === "brand_name")
        ?.value?.trim() || "Brand";

    return BrandHomeResponseSchema.parse({
      contractVersion: "1.0",
      generatedAt,
      status,
      brand: { id: brandProfileId, displayName },
      sections,
      sourceStates,
      truncated: sourceStates.some((source) => source.truncated),
      limitations,
    });
  }

  private async collect<T>(
    sourceDomain: BrandHomeSourceDomain,
    read: () => Promise<T>,
  ): Promise<Collected<T>> {
    try {
      return { data: await read(), state: "READY", limitations: [] };
    } catch {
      return {
        data: null,
        state: "UNAVAILABLE",
        limitations: [`${sourceDomain} source is temporarily unavailable.`],
      };
    }
  }

  private async collectProductIntelligence(
    user: AuthUser,
    offerings: Collected<{
      offerings: readonly Readonly<{
        offeringId: string;
        name: string;
        lifecycle: string;
      }>[];
      truncated: boolean;
    }>,
  ): Promise<Collected<ProductIntelligenceEntry[]>> {
    if (!offerings.data) {
      return {
        data: null,
        state: "UNAVAILABLE",
        limitations: [
          "PRODUCT_INTELLIGENCE source is unavailable because Offering discovery failed.",
        ],
      };
    }
    const settled = await Promise.allSettled(
      offerings.data.offerings.map(async (offering) => ({
        offering,
        intelligence: await this.intelligence.read(
          user,
          "product_intelligence",
          { type: "OFFERING", id: offering.offeringId },
        ),
      })),
    );
    const data = settled.flatMap((entry) =>
      entry.status === "fulfilled" ? [entry.value] : [],
    );
    const failures = settled.length - data.length;
    return {
      data,
      state:
        failures === 0 ? "READY" : data.length > 0 ? "PARTIAL" : "UNAVAILABLE",
      limitations:
        failures > 0
          ? [
              `${failures} bounded Product Intelligence source read${failures === 1 ? " was" : "s were"} unavailable.`,
            ]
          : [],
    };
  }

  private sourceState<T>(
    sourceDomain: BrandHomeSourceDomain,
    collected: Collected<T>,
    truncated = false,
  ): BrandHomeSourceState {
    return {
      sourceDomain,
      state: collected.state,
      truncated,
      limitations: [
        ...collected.limitations,
        ...(truncated ? [`${sourceDomain} source was truncated.`] : []),
      ],
    };
  }

  private sectionState(
    sectionId: BrandHomeSectionId,
    items: readonly BrandHomeItem[],
    sources: readonly BrandHomeSourceState[],
  ): "READY" | "EMPTY" | "PARTIAL" | "UNAVAILABLE" {
    const relevant = new Set(this.sectionSources(sectionId));
    const states = sources
      .filter((source) => relevant.has(source.sourceDomain))
      .map((source) => source.state);
    if (states.every((state) => state === "UNAVAILABLE")) {
      return items.length > 0 ? "PARTIAL" : "UNAVAILABLE";
    }
    if (states.some((state) => state !== "READY")) return "PARTIAL";
    return items.length > 0 ? "READY" : "EMPTY";
  }

  private sectionSources(sectionId: BrandHomeSectionId) {
    const sources: Record<BrandHomeSectionId, BrandHomeSourceDomain[]> = {
      NEEDS_ATTENTION: [
        "COLLABORATION",
        "WORKSPACE_READINESS",
        "PROVIDER_READINESS",
      ],
      CREATOR_SHOP_HAS_LEARNED: ["BRAND_INTELLIGENCE"],
      OPPORTUNITIES_NEXT_ACTIONS: ["OFFERING", "PRODUCT_INTELLIGENCE"],
      CURRENT_MOMENTUM: ["CAMPAIGN", "COLLABORATION"],
    };
    return sources[sectionId];
  }

  private publicItem(candidate: BrandHomeCandidate): BrandHomeItem {
    const {
      sectionId: _sectionId,
      deduplicationKey: _key,
      ...item
    } = candidate;
    return item;
  }

  private unique(values: readonly string[]): string[] {
    return [...new Set(values)];
  }
}
