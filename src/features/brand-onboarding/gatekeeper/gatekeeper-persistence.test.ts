import type { ConfigService } from "@nestjs/config";
import { IndustryVertical } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { DiscoverValidateRequestDto } from "../dto/discover-validate-request.dto";
import { GatekeeperPersistenceService } from "./gatekeeper-persistence.service";
import { GatekeeperPolicyVersionService } from "./gatekeeper-policy-version.service";
import {
  GATEKEEPER_RESULT_VERSION,
  type GatekeeperStructuredResult,
} from "./gatekeeper-v1.types";

function result(): GatekeeperStructuredResult {
  return {
    version: GATEKEEPER_RESULT_VERSION,
    submission: {
      normalized_url: "https://example.com/",
      normalized_domain: "example.com",
    },
    assessment: {
      provisional_industry: IndustryVertical.D2C,
      provisional_sub_industry: "Free Form Specialty",
      entity_category: "BRAND",
      english_evidence_status: "SUFFICIENT",
      creator_marketing_applicability: "APPLICABLE",
      commercial_destination_types: ["WEBSITE"],
      assessment_confidence: "HIGH",
    },
    decision: {
      outcome: "ADMITTED",
      reason_code: null,
      recovery_actions: ["CONTINUE"],
      manual_review_eligible: false,
    },
    confirmation: {
      assessed_industry: IndustryVertical.D2C,
      confirmed_industry: null,
      confirmation_source: null,
      industry_disagreement_flag: false,
      surface_eligible: false,
    },
    handoff: {
      gatekeeper_completed: true,
      confirmed_industry_required: true,
    },
    execution: {
      primary: "SUCCEEDED",
      parallel: "NOT_RUN",
      reassessment: "NOT_RUN",
      openai: "NOT_RUN",
    },
  };
}

describe("Gatekeeper persistence", () => {
  let temporaryPayload: Record<string, unknown>;
  const auditCreate = vi.fn();
  const upsert = vi.fn();
  const update = vi.fn();
  const findUnique = vi.fn();

  const transactionClient = {
    discoveryLead: { findUnique, upsert, update },
    gatekeeperSubmissionAudit: { create: auditCreate },
  };
  const prisma = {
    discoveryLead: { findUnique, update },
    $transaction: vi.fn(
      async (callback: (tx: typeof transactionClient) => unknown) =>
        callback(transactionClient),
    ),
  } as unknown as PrismaService;
  const config = {
    get: vi.fn((key: string, fallback: string) => {
      if (key === "GATEKEEPER_TERMS_VERSION") return "terms-server-2026-08";
      if (key === "GATEKEEPER_PRIVACY_POLICY_VERSION") {
        return "privacy-server-2026-08";
      }
      return fallback;
    }),
  } as unknown as ConfigService;
  const policies = new GatekeeperPolicyVersionService(config);
  const persistence = new GatekeeperPersistenceService(prisma, policies);
  const dto = {
    url: "https://example.com",
    ownershipAuthorizationAttested: true,
    termsAccepted: true,
    privacyPolicyAccepted: true,
    termsVersion: "untrusted-client-terms",
    privacyPolicyVersion: "untrusted-client-privacy",
  } as DiscoverValidateRequestDto & {
    termsVersion: string;
    privacyPolicyVersion: string;
  };

  beforeEach(() => {
    temporaryPayload = { unrelatedNamespace: { preserved: true } };
    auditCreate.mockReset();
    upsert.mockReset();
    update.mockReset();
    findUnique.mockReset();
    findUnique.mockImplementation(
      async (args: { where: Record<string, string> }) => {
        if (args.where.normalizedUrl || args.where.id === "lead-1") {
          return { id: "lead-1", temporaryPayload };
        }
        return null;
      },
    );
    upsert.mockImplementation(
      async (args: {
        update: { temporaryPayload: Record<string, unknown> };
      }) => {
        temporaryPayload = args.update.temporaryPayload;
        return { id: "lead-1" };
      },
    );
    update.mockResolvedValue({ id: "lead-1" });
    auditCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("round-trips the versioned structured Gatekeeper result", async () => {
    await persistence.persistResult(dto, { sessionId: "session-1" }, result());

    await expect(persistence.getGatekeeperResult("lead-1")).resolves.toEqual(
      result(),
    );
  });

  it("preserves unrelated DiscoveryLead temporaryPayload namespaces", async () => {
    await persistence.persistResult(dto, {}, result());

    expect(temporaryPayload).toMatchObject({
      unrelatedNamespace: { preserved: true },
      gatekeeper: result(),
    });
  });

  it("creates a new append-only legal audit for every submission", async () => {
    await persistence.persistResult(dto, { sessionId: "session-1" }, result());
    await persistence.persistResult(dto, { sessionId: "session-2" }, result());

    expect(auditCreate).toHaveBeenCalledTimes(2);
    expect(auditCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        rawUrl: "https://example.com",
        normalizedUrl: "https://example.com/",
        normalizedDomain: "example.com",
        ownershipAuthorizationAttested: true,
        termsAccepted: true,
        privacyPolicyAccepted: true,
        discoveryLeadId: "lead-1",
      },
    });
  });

  it("uses server-owned policy versions and ignores arbitrary client strings", async () => {
    await persistence.persistResult(dto, {}, result());

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          termsVersion: "terms-server-2026-08",
          privacyPolicyVersion: "privacy-server-2026-08",
        }),
      }),
    );
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain(
      "untrusted-client",
    );
  });
});
