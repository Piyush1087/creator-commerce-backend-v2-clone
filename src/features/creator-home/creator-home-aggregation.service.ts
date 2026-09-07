import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";

import type {
  HomeFreshnessState,
  HomeSourceState,
} from "../../shared/home/home.types";
import {
  homeResponseState,
  newestFirst,
  uniqueHomeStrings,
} from "../../shared/home/home.utils";
import type { AuthUser } from "../auth/types/auth-user";
import { ApplicationHomeReadService } from "../campaign-applications/application-home-read.service";
import { CampaignOpportunityService } from "../campaign-opportunities/campaign-opportunity.service";
import { CollaborationHomeReadService } from "../collaboration/services/collaboration-home-read.service";
import { CreatorSettingsHomeReadService } from "../creator-settings/home/creator-settings-home-read.service";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { CreatorHomeNotificationReadService } from "../notifications/services/creator-home-notification-read.service";
import {
  CREATOR_HOME_SOURCE_DOMAINS,
  type CreatorHomeSectionId,
  type CreatorHomeSourceDomain,
} from "./creator-home.contract";
import {
  CreatorHomeResponseSchema,
  type CreatorHomeItem,
} from "./creator-home.schema";

const PREVIEW_LIMIT = 4;
const ACTIVITY_SOURCE_LIMIT = 24;

type Collected<T> = {
  data: T | null;
  state: HomeSourceState;
  limitations: string[];
};

@Injectable()
export class CreatorHomeAggregationService {
  constructor(
    private readonly actors: CreatorWorkspaceActorService,
    private readonly settings: CreatorSettingsHomeReadService,
    private readonly opportunities: CampaignOpportunityService,
    private readonly applications: ApplicationHomeReadService,
    private readonly collaborations: CollaborationHomeReadService,
    private readonly notifications: CreatorHomeNotificationReadService,
  ) {}

  async read(user: AuthUser) {
    const actor = await this.actors.resolveReadOnly(user);
    const generatedAt = new Date().toISOString();
    const [
      settings,
      opportunities,
      applications,
      collaborations,
      notifications,
    ] = await Promise.all([
      this.collect("SETTINGS", () => this.settings.read(user, actor)),
      this.collect("OPPORTUNITIES", () =>
        this.opportunities.readForHome(user, actor, PREVIEW_LIMIT),
      ),
      this.collect("APPLICATIONS", () =>
        this.applications.read(actor, PREVIEW_LIMIT, ACTIVITY_SOURCE_LIMIT),
      ),
      this.collect("COLLABORATIONS", () =>
        this.collaborations.read(actor, PREVIEW_LIMIT, ACTIVITY_SOURCE_LIMIT),
      ),
      this.collect("NOTIFICATIONS", () =>
        this.notifications.read(actor, ACTIVITY_SOURCE_LIMIT),
      ),
    ]);

    const collected = {
      SETTINGS: settings,
      OPPORTUNITIES: opportunities,
      APPLICATIONS: applications,
      COLLABORATIONS: collaborations,
      NOTIFICATIONS: notifications,
    };
    const sourceStates = CREATOR_HOME_SOURCE_DOMAINS.map((sourceDomain) => {
      const source = collected[sourceDomain] as Collected<unknown>;
      return {
        sourceDomain,
        state: source.state,
        freshness: (sourceDomain === "SETTINGS" ||
        source.state === "UNAVAILABLE"
          ? "UNKNOWN"
          : "CURRENT") as HomeFreshnessState,
        observedAt: this.observedAt(source, generatedAt),
        truncated: this.truncated(source),
        limitations: source.limitations,
      };
    });

    const attention: CreatorHomeItem[] = (settings.data?.blockers ?? []).map(
      (blocker) => ({
        id: blocker.id,
        kind: "ATTENTION",
        title: blocker.title,
        subtitle: blocker.subtitle,
        status: blocker.code,
        occurredAt: null,
        unreadCount: null,
        availableActions: [],
        action: {
          state: blocker.actionState,
          destination:
            blocker.actionState === "AVAILABLE"
              ? { destinationId: "CREATOR_SETTINGS_INSTAGRAM" }
              : null,
          reasonCode:
            blocker.actionState === "READ_ONLY"
              ? "OWNER_OR_MANAGER_ACTION_NEEDED"
              : null,
        },
        source: "SETTINGS",
      }),
    );
    for (const collaboration of collaborations.data?.preview ?? []) {
      if (
        collaboration.availableActions.some(
          (action) => action !== "PostCollaborationMessage",
        )
      ) {
        attention.push(this.collaborationItem(collaboration, "ATTENTION"));
      }
    }

    const work: CreatorHomeItem[] = [
      ...(applications.data?.preview ?? []).map((application) => ({
        id: `application:${application.id}`,
        kind: "APPLICATION" as const,
        title: application.campaignName,
        subtitle: application.briefName,
        status: application.status,
        occurredAt: application.updatedAt,
        unreadCount: null,
        availableActions: application.availableActions,
        action: {
          state: "AVAILABLE" as const,
          destination: {
            destinationId: "CREATOR_APPLICATION_DETAIL" as const,
            entityId: application.id,
          },
          reasonCode: null,
        },
        source: "APPLICATIONS" as const,
      })),
      ...(collaborations.data?.preview ?? []).map((collaboration) =>
        this.collaborationItem(collaboration, "COLLABORATION"),
      ),
    ];
    const campaigns: CreatorHomeItem[] = (
      opportunities.data?.preview ?? []
    ).map((campaign) => ({
      id: `campaign:${campaign.id}`,
      kind: "CAMPAIGN",
      title: campaign.name,
      subtitle: campaign.platforms.length
        ? campaign.platforms.join(" · ")
        : "Campaign opportunity",
      status: campaign.canApply
        ? "APPLICATION_OPEN"
        : campaign.applyBlockedReason,
      occurredAt: campaign.applicationDeadline,
      unreadCount: null,
      availableActions: campaign.canApply ? ["APPLY"] : [],
      action: {
        state: "AVAILABLE",
        destination: {
          destinationId: "CREATOR_OPPORTUNITY_DETAIL",
          entityId: campaign.id,
        },
        reasonCode: null,
      },
      source: "OPPORTUNITIES",
    }));
    const activity = this.activity(
      applications.data?.activity ?? [],
      collaborations.data?.activity ?? [],
      notifications.data?.activity ?? [],
    );

    const sections = [
      this.section("NEEDS_YOUR_ATTENTION", attention, [
        settings.state,
        collaborations.state,
      ]),
      this.section("YOUR_WORK", work, [
        applications.state,
        collaborations.state,
      ]),
      this.section("CAMPAIGNS_AVAILABLE", campaigns, [opportunities.state]),
      this.section("RECENT_ACTIVITY", activity, [
        applications.state,
        collaborations.state,
        notifications.state,
      ]),
    ];
    const limitations = uniqueHomeStrings(
      sourceStates.flatMap((source) => source.limitations),
    );

    return CreatorHomeResponseSchema.parse({
      contractVersion: "1.0",
      generatedAt,
      status: homeResponseState(sourceStates.map((source) => source.state)),
      creator: settings.data?.creator ?? {
        id: actor.subjectCreatorProfileId,
        workspaceId: actor.workspaceId,
        displayName: "Creator",
        workspaceDisplayName: "Creator workspace",
        role: actor.actorRole,
      },
      kpis: [
        this.kpi(
          "AVAILABLE_CAMPAIGNS",
          opportunities,
          opportunities.data?.exactAuthorizedCount,
          generatedAt,
        ),
        this.kpi(
          "APPLICATIONS_IN_PROGRESS",
          applications,
          applications.data?.exactPendingCount,
          generatedAt,
        ),
        this.kpi(
          "ACTIVE_COLLABORATIONS",
          collaborations,
          collaborations.data?.exactActiveCount,
          generatedAt,
        ),
        this.kpi(
          "UNREAD_UPDATES",
          notifications,
          notifications.data?.exactUnreadCount,
          generatedAt,
        ),
      ],
      quickActions: [
        this.quickAction(
          "BROWSE_CAMPAIGNS",
          "Browse campaigns",
          "CREATOR_CAMPAIGNS",
        ),
        this.quickAction(
          "MY_APPLICATIONS",
          "My applications",
          "CREATOR_APPLICATIONS",
        ),
        this.quickAction(
          "COLLABORATIONS",
          "Collaborations",
          "CREATOR_COLLABORATIONS",
        ),
        this.quickAction("SETTINGS", "Settings", "CREATOR_SETTINGS"),
      ],
      sections,
      sourceStates,
      truncated: sourceStates.some((source) => source.truncated),
      limitations,
    });
  }

  private async collect<T>(
    source: CreatorHomeSourceDomain,
    read: () => Promise<T>,
  ): Promise<Collected<T>> {
    try {
      return { data: await read(), state: "READY", limitations: [] };
    } catch {
      return {
        data: null,
        state: "UNAVAILABLE",
        limitations: [`${source} source is temporarily unavailable.`],
      };
    }
  }

  private observedAt<T>(source: Collected<T>, fallback: string): string {
    const data = source.data as { observedAt?: unknown } | null;
    return typeof data?.observedAt === "string" ? data.observedAt : fallback;
  }

  private truncated<T>(source: Collected<T>): boolean {
    const data = source.data as { truncated?: unknown } | null;
    return data?.truncated === true;
  }

  private kpi(
    id: string,
    source: Collected<unknown>,
    value: number | undefined,
    fallback: string,
  ) {
    return {
      id,
      state: source.state,
      value: source.state === "UNAVAILABLE" ? null : (value ?? 0),
      freshness: source.state === "UNAVAILABLE" ? "UNKNOWN" : "CURRENT",
      observedAt: this.observedAt(source, fallback),
    };
  }

  private quickAction(id: string, label: string, destinationId: string) {
    return {
      id,
      label,
      action: {
        state: "AVAILABLE",
        destination: { destinationId },
        reasonCode: null,
      },
    };
  }

  private section(
    id: CreatorHomeSectionId,
    items: CreatorHomeItem[],
    states: HomeSourceState[],
  ) {
    const state = states.every((value) => value === "UNAVAILABLE")
      ? "UNAVAILABLE"
      : states.some((value) => value !== "READY")
        ? "PARTIAL"
        : items.length
          ? "READY"
          : "EMPTY";
    return { id, state, items };
  }

  private collaborationItem(
    collaboration: {
      id: string;
      brandName: string;
      campaignName: string;
      stage: string;
      unreadCount: number;
      availableActions: string[];
      updatedAt: string;
    },
    kind: "ATTENTION" | "COLLABORATION",
  ): CreatorHomeItem {
    return {
      id: `${kind.toLowerCase()}:collaboration:${collaboration.id}`,
      kind,
      title: collaboration.campaignName,
      subtitle: collaboration.brandName,
      status: collaboration.stage,
      occurredAt: collaboration.updatedAt,
      unreadCount: collaboration.unreadCount,
      availableActions: collaboration.availableActions,
      action: {
        state: "AVAILABLE",
        destination: {
          destinationId: "CREATOR_COLLABORATION_THREAD",
          entityId: collaboration.id,
        },
        reasonCode: null,
      },
      source: "COLLABORATIONS",
    };
  }

  private activity(
    applications: Array<{
      id: string;
      applicationId: string;
      transitionId: string;
      eventType: string;
      occurredAt: string;
    }>,
    collaborations: Array<{
      id: string;
      collaborationId: string;
      eventType: string;
      title: string;
      subtitle: string;
      occurredAt: string;
      notificationAliasKeys: string[];
    }>,
    notifications: Array<{
      id: string;
      eventType: string;
      semanticEventKey: string | null;
      title: string;
      subtitle: string;
      unread: boolean;
      occurredAt: string;
    }>,
  ): CreatorHomeItem[] {
    const aliases = new Set<string>();
    applications.forEach((event) =>
      aliases.add(
        createHash("sha256")
          .update(
            JSON.stringify([
              "c03_application",
              event.applicationId,
              event.transitionId,
            ]),
          )
          .digest("hex"),
      ),
    );
    collaborations.forEach((event) =>
      event.notificationAliasKeys.forEach((key) => aliases.add(key)),
    );
    const applicationCopy: Record<string, readonly [string, string]> = {
      SUBMITTED: [
        "Application submitted",
        "Your campaign application was submitted.",
      ],
      APPROVED: [
        "Application approved",
        "Your campaign application was approved.",
      ],
      REJECTED: [
        "Application update",
        "Your campaign application was not approved.",
      ],
      WITHDRAWN: [
        "Application withdrawn",
        "Your campaign application was withdrawn.",
      ],
      EXPIRED: ["Application expired", "Your campaign application expired."],
    };
    const canonical: CreatorHomeItem[] = [
      ...applications.map((event) => ({
        id: event.id,
        kind: "ACTIVITY" as const,
        title: applicationCopy[event.eventType]?.[0] ?? "Application updated",
        subtitle:
          applicationCopy[event.eventType]?.[1] ??
          "A campaign application changed.",
        status: event.eventType,
        occurredAt: event.occurredAt,
        unreadCount: null,
        availableActions: [],
        action: {
          state: "AVAILABLE" as const,
          destination: {
            destinationId: "CREATOR_APPLICATION_DETAIL" as const,
            entityId: event.applicationId,
          },
          reasonCode: null,
        },
        source: "APPLICATIONS" as const,
      })),
      ...collaborations.map((event) => ({
        id: event.id,
        kind: "ACTIVITY" as const,
        title: event.title,
        subtitle: event.subtitle,
        status: event.eventType,
        occurredAt: event.occurredAt,
        unreadCount: null,
        availableActions: [],
        action: {
          state: "AVAILABLE" as const,
          destination: {
            destinationId: "CREATOR_COLLABORATION_THREAD" as const,
            entityId: event.collaborationId,
          },
          reasonCode: null,
        },
        source: "COLLABORATIONS" as const,
      })),
      ...notifications
        .filter(
          (event) =>
            !aliases.has(event.semanticEventKey ?? "") &&
            !event.eventType.startsWith("COLLABORATION_") &&
            ![
              "campaigns.application_approved",
              "campaigns.application_rejected",
            ].includes(event.eventType),
        )
        .map((event) => ({
          id: event.id,
          kind: "ACTIVITY" as const,
          title: event.title,
          subtitle: event.subtitle,
          status: event.eventType,
          occurredAt: event.occurredAt,
          unreadCount: event.unread ? 1 : 0,
          availableActions: [],
          action: null,
          source: "NOTIFICATIONS" as const,
        })),
    ];
    return newestFirst(
      canonical.map((item) => ({ ...item, occurredAt: item.occurredAt! })),
    ).slice(0, ACTIVITY_SOURCE_LIMIT);
  }
}
