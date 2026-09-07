import { NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import type { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";
import { CollaborationConsumerService } from "./collaboration-consumer.service";

const actor: AuthUser = {
  id: "user-1",
  email: "owner@example.test",
  name: "Owner",
  role: UserRole.BRAND,
  organizationId: "organization-1",
};

const row = {
  id: "collaboration-1",
  brandProfileId: "brand-1",
  currentStage: "STAGE_4_CONTENT_REVIEW",
  negotiationRound: 2,
  fulfillmentIssueCount: 1,
  revisionCount: 3,
  unreadCountBrand: 4,
  lastMessageSnippet: "Draft is ready for review",
  lastMessageAt: new Date("2026-09-03T05:30:00.000Z"),
  stageUpdatedAt: new Date("2026-09-03T05:00:00.000Z"),
  isPaused: false,
  isTerminated: false,
  updatedAt: new Date("2026-09-03T05:45:00.000Z"),
  campaign: { id: "campaign-1", name: "Summer Launch" },
  brief: { id: "brief-1", internalTitle: "Launch brief" },
  product: { id: "product-1", productName: "Serum" },
  creatorUser: {
    name: "Creator User",
    creatorProfile: {
      displayName: "Creator Display",
      instagramHandle: "creator",
    },
  },
  ucePipelineCollaboration: {
    collabStatus: "ACTIVE_WORKFLOW",
    currentPhase: "CONTENT_DRAFTING",
    currentMilestone: "STAGE_4_CONTENT_REVIEW",
    pipelineHealth: "APPROACHING_DEADLINE",
    actionRequiredByRole: "BRAND",
    currentMilestoneDeadline: new Date("2026-09-04T06:00:00.000Z"),
    autoApprovalDeadline72h: new Date("2026-09-06T06:00:00.000Z"),
    productionDeadlineAt: new Date("2026-09-10T06:00:00.000Z"),
  },
};

function harness(options?: { listRows?: unknown[]; readRow?: unknown }) {
  const findMany = vi.fn().mockResolvedValue(options?.listRows ?? [row]);
  const findFirst = vi
    .fn()
    .mockResolvedValue(options && "readRow" in options ? options.readRow : row);
  const prisma = {
    collaboration: { findMany, findFirst },
  } as unknown as PrismaService;
  const resolveBrandContext = vi.fn().mockResolvedValue({
    brandProfileId: "brand-1",
    membership: { role: "BRAND_OWNER" },
  });
  const service = new CollaborationConsumerService(prisma, {
    resolveBrandContext,
  } as unknown as BrandWorkspaceAuthorizationService);
  return { service, findMany, findFirst, resolveBrandContext };
}

describe("CollaborationConsumerService", () => {
  it("returns an available empty same-Brand collection without fabrication", async () => {
    const { service } = harness({ listRows: [] });
    await expect(service.list(actor)).resolves.toEqual({ collaborations: [] });
  });

  it("lists only minimized canonical workflow state without mutation calls", async () => {
    const { service, findMany } = harness();
    const result = await service.list(actor);

    expect(result).toEqual({
      collaborations: [
        expect.objectContaining({
          collaborationId: "collaboration-1",
          campaign: { id: "campaign-1", name: "Summer Launch" },
          brief: { id: "brief-1", title: "Launch brief" },
          creator: {
            displayName: "Creator Display",
            instagramHandle: "creator",
          },
          lifecycle: expect.objectContaining({ status: "ACTIVE_WORKFLOW" }),
          attention: expect.objectContaining({
            reasonCodes: ["APPROACHING_DEADLINE", "BRAND_ACTION_REQUIRED"],
          }),
        }),
      ],
    });
    const query = JSON.stringify(findMany.mock.calls[0]?.[0]);
    expect(query).toContain('"brandProfileId":"brand-1"');
    expect(query).not.toMatch(
      /email|bank|credential|redemption|tracking|token|commercial/iu,
    );
  });

  it("reads by exact workflow ID and authenticated Brand in one query", async () => {
    const { service, findFirst } = harness();
    await expect(service.read(actor, "collaboration-1")).resolves.toMatchObject(
      {
        collaborationId: "collaboration-1",
        lifecycle: {
          milestone: "STAGE_4_CONTENT_REVIEW",
          pipelineHealth: "APPROACHING_DEADLINE",
        },
        activity: { unreadCount: 4, negotiationRounds: 2 },
      },
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "collaboration-1", brandProfileId: "brand-1" },
      }),
    );
  });

  it("makes nonexistent and cross-Brand IDs indistinguishable", async () => {
    const { service } = harness({ readRow: null });
    await expect(service.read(actor, "foreign-or-missing")).rejects.toEqual(
      new NotFoundException("Collaboration not found"),
    );
  });

  it("never projects free-form message snippets", async () => {
    const unsafe = {
      ...row,
      lastMessageSnippet: "Use token secret-12345678 at https://example.test",
    };
    const { service } = harness({ listRows: [unsafe], readRow: unsafe });
    const listed = await service.list(actor);
    const read = await service.read(actor, "collaboration-1");
    expect(listed.collaborations[0]?.lastMessageSnippet).toBeNull();
    expect(read.activity.lastMessageSnippet).toBeNull();
  });
});
