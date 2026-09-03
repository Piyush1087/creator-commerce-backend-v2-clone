import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { BrandCurrentReadService } from "../../brand-centre/consumer/brand-current-read.service";
import type { CanonicalOfferingDiscoveryService } from "../../brand-centre/consumer/canonical-offering-discovery.service";
import type { CanonicalOfferingStateService } from "../../brand-centre/services/canonical-offering-state.service";
import type { BrandProviderReadinessService } from "../../brand-settings/services/brand-provider-readiness.service";
import type { BrandUceCampaignService } from "../../brand-uce/services/brand-uce-campaign.service";
import type { BrandWorkspaceReadinessConsumerService } from "../../brand-workspace-readiness/brand-workspace-readiness-consumer.service";
import type { CollaborationConsumerService } from "../../collaboration/services/collaboration-consumer.service";
import type { IntelligenceConsumerService } from "../../intelligence-consumer/intelligence-consumer.service";
import type { ChatCapabilityExecutionContext } from "./chat-capability-handler.contract";
import { ChatNavigationRegistry } from "./chat-navigation.registry";
import { AppNavigateHandler } from "./handlers/app-navigate.handler";
import { BrandCurrentReadHandler } from "./handlers/brand-current-read.handler";
import { BrandIntelligenceCurrentReadHandler } from "./handlers/brand-intelligence-current-read.handler";
import { CampaignListHandler } from "./handlers/campaign-list.handler";
import { CampaignReadHandler } from "./handlers/campaign-read.handler";
import { CollaborationListHandler } from "./handlers/collaboration-list.handler";
import { CollaborationReadHandler } from "./handlers/collaboration-read.handler";
import { OfferingListHandler } from "./handlers/offering-list.handler";
import { OfferingReadHandler } from "./handlers/offering-read.handler";
import { ProductIntelligenceCurrentReadHandler } from "./handlers/product-intelligence-current-read.handler";
import { ProviderReadinessReadHandler } from "./handlers/provider-readiness-read.handler";
import { WorkspaceContextReadHandler } from "./handlers/workspace-context-read.handler";
import { WorkspaceReadinessReadHandler } from "./handlers/workspace-readiness-read.handler";

const actor = {
  id: "user-1",
  email: "user@example.test",
  name: "User",
  role: UserRole.BRAND,
  organizationId: "organization-1",
};

const baseContext: ChatCapabilityExecutionContext = {
  actor,
  chatContext: {
    actor: { userId: actor.id, role: actor.role },
    workspace: { brandProfileId: "brand-1", membershipRole: "BRAND_OWNER" },
    conversation: { id: "conversation-1" },
    surface: { kind: "HOME" },
    requestHints: {},
    capabilities: [
      { capabilityId: "workspace.context.read", availability: "AVAILABLE" },
    ],
    canonicalRefs: [{ type: "BRAND", id: "brand-1" }],
    intelligenceRefs: [],
    providerReadiness: [],
    turnStartedAt: new Date(0).toISOString(),
  },
  authorizedEntityRefs: [{ type: "BRAND", id: "brand-1" }],
};

const intelligenceResult = (
  engineId: "brand_intelligence" | "product_intelligence",
  subject: { type: "BRAND" | "OFFERING"; id: string },
) => ({
  contractVersion: "1.0" as const,
  engineId,
  subject,
  objects: [
    {
      objectId: "object-1",
      current: { kind: "VALUE" as const, resultRef: "result-1" },
      readiness: "READY" as const,
      freshness: "CURRENT" as const,
      authority: "creator_shop" as const,
    },
  ],
  capabilityAvailability: { status: "AVAILABLE" as const },
  domainPayloadVersion: "1.0" as const,
  domainPayload: {},
});

describe("P3 Chat capability handler mappings", () => {
  it("reads workspace.context.read exclusively from ChatContext", async () => {
    const result = await new WorkspaceContextReadHandler().execute(
      baseContext,
      {},
    );
    expect(result.data).toMatchObject({
      workspaceBrand: { type: "BRAND", id: "brand-1" },
      membershipRole: "BRAND_OWNER",
      surface: "HOME",
    });
  });

  it("maps brand.current.read through the canonical Brand adapter", async () => {
    const read = vi.fn().mockResolvedValue({
      brandId: "brand-1",
      observedAt: new Date(0).toISOString(),
      canonicalSnapshotRef: "canonical:brand-1",
      fields: [],
    });
    const result = await new BrandCurrentReadHandler({
      read,
    } as unknown as BrandCurrentReadService).execute(baseContext, {});
    expect(read).toHaveBeenCalledWith("brand-1");
    expect(result.grounding[0].resultRefs).toEqual(["canonical:brand-1"]);
  });

  it("maps offering.list through canonical discovery", async () => {
    const listForWorkspace = vi.fn().mockResolvedValue({
      offerings: [
        {
          offeringId: "offering-1",
          name: "Product",
          kind: "PRODUCT",
          subtype: null,
          lifecycle: "ACTIVE",
        },
      ],
    });
    const result = await new OfferingListHandler({
      listForWorkspace,
    } as unknown as CanonicalOfferingDiscoveryService).execute(baseContext, {});
    expect(listForWorkspace).toHaveBeenCalledWith(actor);
    expect(result.authorizedEntityRefs).toEqual([
      { type: "OFFERING", id: "offering-1" },
    ]);
  });

  it("maps offering.read through the exact canonical Offering state read", async () => {
    const read = vi.fn().mockResolvedValue({
      id: "offering-1",
      brandProfileId: "brand-1",
      name: "Product",
      canonicalKind: "PRODUCT",
      canonicalSubtype: null,
      canonicalLifecycle: "ACTIVE",
      description: null,
      url: "https://example.test/product",
    });
    const handler = new OfferingReadHandler({
      read,
    } as unknown as CanonicalOfferingStateService);
    const context = {
      ...baseContext,
      authorizedEntityRefs: [
        ...baseContext.authorizedEntityRefs,
        { type: "OFFERING" as const, id: "offering-1" },
      ],
    };
    await expect(
      handler.execute(context, { offeringId: "offering-1" }),
    ).resolves.toMatchObject({ availability: "AVAILABLE" });
    expect(read).toHaveBeenCalledWith("brand-1", "offering-1");
    await expect(
      handler.execute(baseContext, { offeringId: "foreign" }),
    ).resolves.toMatchObject({ availability: "NOT_AUTHORIZED" });
  });

  it("maps Brand Intelligence through the common consumer with exact subject", async () => {
    const resolveAvailability = vi
      .fn()
      .mockResolvedValue({ status: "AVAILABLE" });
    const read = vi.fn().mockResolvedValue(
      intelligenceResult("brand_intelligence", {
        type: "BRAND",
        id: "brand-1",
      }),
    );
    await new BrandIntelligenceCurrentReadHandler({
      resolveAvailability,
      read,
    } as unknown as IntelligenceConsumerService).execute(baseContext, {});
    expect(read).toHaveBeenCalledWith(actor, "brand_intelligence", {
      type: "BRAND",
      id: "brand-1",
    });
  });

  it("maps Product Intelligence only for a server-authorized Offering", async () => {
    const resolveAvailability = vi
      .fn()
      .mockResolvedValue({ status: "AVAILABLE" });
    const read = vi.fn().mockResolvedValue(
      intelligenceResult("product_intelligence", {
        type: "OFFERING",
        id: "offering-1",
      }),
    );
    const handler = new ProductIntelligenceCurrentReadHandler({
      resolveAvailability,
      read,
    } as unknown as IntelligenceConsumerService);
    await expect(
      handler.execute(baseContext, { offeringId: "foreign" }),
    ).resolves.toMatchObject({ availability: "NOT_AUTHORIZED" });
    expect(read).not.toHaveBeenCalled();
    await handler.execute(
      {
        ...baseContext,
        authorizedEntityRefs: [
          ...baseContext.authorizedEntityRefs,
          { type: "OFFERING", id: "offering-1" },
        ],
      },
      { offeringId: "offering-1" },
    );
    expect(read).toHaveBeenCalledWith(actor, "product_intelligence", {
      type: "OFFERING",
      id: "offering-1",
    });
  });

  it("maps campaign.list and campaign.read through BrandUceCampaignService", async () => {
    const listCampaigns = vi
      .fn()
      .mockResolvedValue([
        { campaign_id: "campaign-1", campaign_name: "Summer Launch" },
      ]);
    const getCampaignShell = vi.fn().mockResolvedValue({
      campaign_id: "campaign-1",
      campaign_name: "Summer Launch",
      current_status: "LIVE",
      can_edit_essentials: false,
      total_inventory_allocated: 0,
      pause_warning: null,
    });
    const campaigns = {
      listCampaigns,
      getCampaignShell,
    } as unknown as BrandUceCampaignService;
    const listed = await new CampaignListHandler(campaigns).execute(
      baseContext,
      {},
    );
    expect(listCampaigns).toHaveBeenCalledWith("brand-1", {});
    expect(listed.authorizedEntityRefs).toEqual([
      { type: "CAMPAIGN", id: "campaign-1" },
    ]);
    const read = await new CampaignReadHandler(campaigns).execute(
      {
        ...baseContext,
        authorizedEntityRefs: [
          ...baseContext.authorizedEntityRefs,
          { type: "CAMPAIGN", id: "campaign-1" },
        ],
      },
      { campaignId: "campaign-1" },
    );
    expect(getCampaignShell).toHaveBeenCalledWith("brand-1", "campaign-1");
    expect(read.data).toMatchObject({ currentStatus: "LIVE" });
  });

  it("maps Collaboration reads through the narrow consumer and requires candidate authority", async () => {
    const collaboration = {
      collaborationId: "collaboration-1",
      campaign: { id: "campaign-1", name: "Summer Launch" },
      brief: { id: "brief-1", title: "Launch brief" },
      campaignProduct: null,
      creator: { displayName: "Creator", instagramHandle: "creator" },
      lifecycle: {
        stage: "STAGE_1_NEGOTIATION",
        status: "ACTIVE_WORKFLOW",
        phase: "INBOUND_INVITE",
        milestone: "STAGE_1_NEGOTIATION",
        paused: false,
        terminated: false,
        pipelineHealth: "ON_TRACK",
        actionRequiredBy: "NONE",
      },
      attention: {
        reasonCodes: [],
        currentMilestoneDueAt: "2026-09-04T06:00:00.000Z",
        autoApprovalDueAt: null,
        productionDueAt: null,
      },
      activity: {
        negotiationRounds: 0,
        fulfillmentIssues: 0,
        revisionRounds: 0,
        unreadCount: 0,
        lastMessageSnippet: null,
        lastMessageAt: null,
        stageUpdatedAt: "2026-09-03T06:00:00.000Z",
        updatedAt: "2026-09-03T06:00:00.000Z",
      },
    };
    const list = vi.fn().mockResolvedValue({
      collaborations: [
        {
          ...collaboration,
          lifecycle: {
            stage: "STAGE_1_NEGOTIATION",
            status: "ACTIVE_WORKFLOW",
            phase: "INBOUND_INVITE",
            paused: false,
            terminated: false,
          },
          attention: {
            health: "ON_TRACK",
            actionRequiredBy: "NONE",
            reasonCodes: [],
            dueAt: "2026-09-04T06:00:00.000Z",
          },
          unreadCount: 0,
          lastMessageSnippet: null,
          lastMessageAt: null,
          stageUpdatedAt: "2026-09-03T06:00:00.000Z",
          updatedAt: "2026-09-03T06:00:00.000Z",
          activity: undefined,
        },
      ],
    });
    const read = vi.fn().mockResolvedValue(collaboration);
    const consumer = { list, read } as unknown as CollaborationConsumerService;
    const listed = await new CollaborationListHandler(consumer).execute(
      baseContext,
      {},
    );
    expect(listed.authorizedEntityRefs).toEqual([
      { type: "COLLABORATION", id: "collaboration-1" },
      { type: "CAMPAIGN", id: "campaign-1" },
    ]);

    const handler = new CollaborationReadHandler(consumer);
    await expect(
      handler.execute(baseContext, { collaborationId: "collaboration-1" }),
    ).resolves.toMatchObject({ availability: "NOT_AUTHORIZED" });
    expect(read).not.toHaveBeenCalled();
    await expect(
      handler.execute(
        {
          ...baseContext,
          authorizedEntityRefs: [
            ...baseContext.authorizedEntityRefs,
            { type: "COLLABORATION", id: "collaboration-1" },
          ],
        },
        { collaborationId: "collaboration-1" },
      ),
    ).resolves.toMatchObject({
      availability: "AVAILABLE",
      data: { collaborationId: "collaboration-1" },
    });
    expect(read).toHaveBeenCalledWith(actor, "collaboration-1");
  });

  it("keeps empty Collaboration lists available and repository failures recoverable", async () => {
    await expect(
      new CollaborationListHandler({
        list: vi.fn().mockResolvedValue({ collaborations: [] }),
      } as unknown as CollaborationConsumerService).execute(baseContext, {}),
    ).resolves.toMatchObject({
      availability: "AVAILABLE",
      data: { collaborations: [] },
    });
    await expect(
      new CollaborationListHandler({
        list: vi.fn().mockRejectedValue(new Error("repository unavailable")),
      } as unknown as CollaborationConsumerService).execute(baseContext, {}),
    ).resolves.toMatchObject({
      availability: "UNAVAILABLE_RECOVERABLE",
      authorizedEntityRefs: [],
      grounding: [],
    });
  });

  it("maps workspace and provider readiness through their narrow consumers", async () => {
    const workspaceRead = vi.fn().mockResolvedValue({
      contractVersion: "1.0",
      brandId: "brand-1",
      observedAt: "2026-09-03T06:00:00.000Z",
      workspace: { state: "READY", reasonCodes: [] },
      subscription: {
        state: "FULL_ACCESS",
        lifecycleStatus: "TRIALING",
        requiredAction: "NONE",
      },
      applicationCapabilities: [],
      billing: {
        state: "READY",
        missingFieldCodes: [],
        recoveryDestinationId: null,
      },
      setupItems: [],
      limitations: [],
    });
    const providerRead = vi.fn().mockResolvedValue({
      contractVersion: "1.0",
      brandId: "brand-1",
      observedAt: "2026-09-03T06:00:00.000Z",
      providers: [
        {
          provider: "INSTAGRAM",
          state: "READY",
          reasonCode: "INSTAGRAM_READY",
          affectedProductCapabilities: [],
          humanActionRequired: false,
          recoveryDestinationId: null,
          freshness: "CURRENT",
        },
      ],
      limitations: [],
    });
    await expect(
      new WorkspaceReadinessReadHandler({
        read: workspaceRead,
      } as unknown as BrandWorkspaceReadinessConsumerService).execute(
        baseContext,
        {},
      ),
    ).resolves.toMatchObject({ availability: "AVAILABLE" });
    await expect(
      new ProviderReadinessReadHandler({
        read: providerRead,
      } as unknown as BrandProviderReadinessService).execute(baseContext, {}),
    ).resolves.toMatchObject({ availability: "AVAILABLE" });
    expect(workspaceRead).toHaveBeenCalledWith(actor);
    expect(providerRead).toHaveBeenCalledWith(actor);
  });

  it("keeps navigation code-owned and rejects unverified entity refs", async () => {
    const handler = new AppNavigateHandler(new ChatNavigationRegistry());
    const denied = await handler.execute(baseContext, {
      destinationId: "CAMPAIGNS",
      entity: { type: "CAMPAIGN", id: "foreign" },
    });
    expect(denied.availability).toBe("NOT_AUTHORIZED");
    expect(denied.navigation).toBeUndefined();
    await expect(
      handler.execute(
        {
          ...baseContext,
          authorizedEntityRefs: [
            ...baseContext.authorizedEntityRefs,
            { type: "CAMPAIGN", id: "campaign-1" },
          ],
        },
        {
          destinationId: "CAMPAIGNS",
          entity: { type: "CAMPAIGN", id: "campaign-1" },
        },
      ),
    ).resolves.toMatchObject({
      availability: "AVAILABLE",
      navigation: {
        destinationId: "CAMPAIGNS",
        entityRef: { type: "CAMPAIGN", id: "campaign-1" },
      },
    });
  });
});
