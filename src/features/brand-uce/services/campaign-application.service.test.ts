import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { CampaignApplicationService } from "./campaign-application.service";
import { BrandUceController } from "../brand-uce.controller";

function fixture() {
  const row = {
    id: "application-1",
    status: "SUBMITTED",
    createdAt: new Date("2026-08-15T00:00:00Z"),
    creatorUser: { id: "creator-1", name: "Creator", email: "creator@example.invalid" },
    canonicalBrief: { id: "brief-1", title: "Launch brief" },
    collaboration: null,
  };
  const prisma = {
    campaignApplication: {
      findMany: vi.fn().mockResolvedValue([row]),
      findFirst: vi.fn().mockResolvedValue({ id: row.id, status: row.status }),
      update: vi.fn().mockResolvedValue({ ...row, status: "ACCEPTED" }),
    },
  };
  const access = { assertCampaignOwned: vi.fn().mockResolvedValue({ id: "campaign-1" }) };
  return { service: new CampaignApplicationService(prisma as never, access as never), prisma, access };
}

describe("CampaignApplicationService", () => {
  it("returns truthful unavailable Discovery rather than legacy prospects", async () => {
    const { service } = fixture();
    await expect(service.discovery("brand-1", "campaign-1")).resolves.toEqual(
      expect.objectContaining({ availability: "UNAVAILABLE", recommendations: [] }),
    );
  });

  it("lists Applications through the owned Campaign and preserves only a Collaboration reference", async () => {
    const { service, prisma } = fixture();
    const rows = await service.list("brand-1", "campaign-1");
    expect(prisma.campaignApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaignId: "campaign-1" } }),
    );
    expect(rows[0]?.collaboration_reference).toBeNull();
  });

  it("accepts a submitted Application without creating a Collaboration", async () => {
    const { service, prisma } = fixture();
    await service.decide("brand-1", "campaign-1", "application-1", "ACCEPTED");
    expect(prisma.campaignApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACCEPTED" } }),
    );
    expect((prisma as Record<string, unknown>).collaboration).toBeUndefined();
  });

  it("rejects a missing or already decided Application", async () => {
    const { service, prisma } = fixture();
    prisma.campaignApplication.findFirst.mockResolvedValueOnce(null);
    await expect(service.decide("brand-1", "campaign-1", "missing", "REJECTED")).rejects.toBeInstanceOf(NotFoundException);
    prisma.campaignApplication.findFirst.mockResolvedValueOnce({ id: "application-1", status: "ACCEPTED" });
    await expect(service.decide("brand-1", "campaign-1", "application-1", "REJECTED")).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects legacy pipeline commands before they can mutate a Campaign", async () => {
    const controller = new BrandUceController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      controller.createProspect({} as never, "campaign-1", {} as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

});
