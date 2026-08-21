import { BadRequestException } from "@nestjs/common";
import {
  BrandPreviewRuntimeState,
  IndustryVertical,
  Prisma,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { GatekeeperPersistenceService } from "../gatekeeper/gatekeeper-persistence.service";
import { BrandPreviewRunService } from "./brand-preview-run.service";

function gatekeeper(supported = true) {
  return {
    decision: { outcome: supported ? "ADMITTED" : "UNSUPPORTED" },
    confirmation: {
      confirmed_industry: supported
        ? IndustryVertical.D2C
        : IndustryVertical.OTHER,
      surface_eligible: supported,
    },
  };
}

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-stable",
    discoveryLeadId: "lead-1",
    state: BrandPreviewRuntimeState.ANALYSIS_ACTIVE,
    phase: "UNDERSTANDING_BRAND",
    completeness: null,
    retryAllowed: false,
    brandProfileId: null,
    previewOutputSnapshot: null,
    ...overrides,
  };
}

describe("BrandPreviewRunService", () => {
  it("starts exactly one run and returns its current state", async () => {
    const prisma = {
      brandPreviewRun: {
        create: vi.fn().mockResolvedValue(run()),
        findUnique: vi.fn().mockResolvedValue(run()),
      },
    };
    const service = new BrandPreviewRunService(
      prisma as unknown as PrismaService,
      {
        getGatekeeperResult: vi.fn().mockResolvedValue(gatekeeper()),
      } as unknown as GatekeeperPersistenceService,
    );
    await expect(service.startOrResume("lead-1")).resolves.toMatchObject({
      runId: "run-stable",
      state: "ANALYSIS_ACTIVE",
    });
    expect(prisma.brandPreviewRun.create).toHaveBeenCalledOnce();
  });

  it("treats a concurrent duplicate Industry-confirmation start as idempotent", async () => {
    const prisma = {
      brandPreviewRun: {
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("unique", {
            code: "P2002",
            clientVersion: "6.19.3",
          }),
        ),
        findUnique: vi.fn().mockResolvedValue(run()),
      },
    };
    const service = new BrandPreviewRunService(
      prisma as unknown as PrismaService,
      {
        getGatekeeperResult: vi.fn().mockResolvedValue(gatekeeper()),
      } as unknown as GatekeeperPersistenceService,
    );
    await expect(service.startOrResume("lead-1")).resolves.toMatchObject({
      runId: "run-stable",
      state: "ANALYSIS_ACTIVE",
    });
  });

  it("never starts Preview for unsupported Industry", async () => {
    const prisma = { brandPreviewRun: { create: vi.fn() } };
    const service = new BrandPreviewRunService(
      prisma as unknown as PrismaService,
      {
        getGatekeeperResult: vi.fn().mockResolvedValue(gatekeeper(false)),
      } as unknown as GatekeeperPersistenceService,
    );
    await expect(service.startOrResume("lead-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.brandPreviewRun.create).not.toHaveBeenCalled();
  });

  it("starts an eligible pre-existing confirmed session on first GET", async () => {
    const prisma = {
      brandPreviewRun: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(run()),
        create: vi.fn().mockResolvedValue(run()),
      },
    };
    const service = new BrandPreviewRunService(
      prisma as unknown as PrismaService,
      {
        getGatekeeperResult: vi.fn().mockResolvedValue(gatekeeper()),
      } as unknown as GatekeeperPersistenceService,
    );
    await expect(service.getOrStartEligible("lead-1")).resolves.toMatchObject({
      runId: "run-stable",
      state: "ANALYSIS_ACTIVE",
    });
  });

  it("authorizes retry only from recoverable failure", async () => {
    const prisma = {
      brandPreviewRun: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue(
          run({
            state: BrandPreviewRuntimeState.ANALYSIS_ACTIVE,
            attempt: 2,
          }),
        ),
      },
    };
    const service = new BrandPreviewRunService(
      prisma as unknown as PrismaService,
      {} as GatekeeperPersistenceService,
    );
    await expect(service.retry("lead-1")).resolves.toMatchObject({
      state: "ANALYSIS_ACTIVE",
    });
    expect(prisma.brandPreviewRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          state: BrandPreviewRuntimeState.PREVIEW_FAILED_RECOVERABLE,
          retryAllowed: true,
        }),
      }),
    );
  });

  it("makes a duplicate retry return the already-active run", async () => {
    const prisma = {
      brandPreviewRun: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue(run()),
      },
    };
    const service = new BrandPreviewRunService(
      prisma as unknown as PrismaService,
      {} as GatekeeperPersistenceService,
    );
    await expect(service.retry("lead-1")).resolves.toMatchObject({
      runId: "run-stable",
    });
  });

  it("projects READY output without internal refs, confidence, provider, or model", async () => {
    const prisma = {
      brandPreviewRun: {
        findUnique: vi.fn().mockResolvedValue(
          run({
            state: BrandPreviewRuntimeState.PREVIEW_READY,
            completeness: "PARTIAL",
            brandProfileId: "profile-stable",
            previewOutputSnapshot: {
              identity: { brand_name: "Example" },
              brand_descriptor: null,
              brand_understanding_narrative: "Narrative",
              audience_groups: [
                {
                  id: "one",
                  label: "One",
                  why_it_matters: "Why",
                  internal_grounding_refs: ["secret-ref"],
                  internal_confidence: "HIGH",
                  provider: "secret-provider",
                  model: "secret-model",
                },
              ],
              creator_marketing_opportunities: [],
              creator_archetype_recommendations: [],
            },
          }),
        ),
      },
    };
    const service = new BrandPreviewRunService(
      prisma as unknown as PrismaService,
      {} as GatekeeperPersistenceService,
    );
    const projected = await service.get("lead-1");
    expect(projected.verificationContext.brandProfileId).toBe("profile-stable");
    expect(JSON.stringify(projected)).not.toContain("secret-ref");
    expect(JSON.stringify(projected)).not.toContain("internal_confidence");
    expect(JSON.stringify(projected)).not.toContain("secret-provider");
    expect(JSON.stringify(projected)).not.toContain("secret-model");
  });
});
