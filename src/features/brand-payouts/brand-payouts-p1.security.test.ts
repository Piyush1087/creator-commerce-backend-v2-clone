import { randomUUID } from "node:crypto";
import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BrandRole,
  EscrowTransactionStatus,
  EscrowTransactionType,
  PrismaClient,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "../brand-centre/brand-workspace-authorization.service";
import type {
  BrandPayoutsAuthorizationScopeV1,
  BrandPayoutsFullFinancialAuthorizationScopeV1,
} from "./contracts/brand-payouts-authorization.contract";
import {
  BrandPayoutsActivityCsvQueryDto,
  BrandPayoutsActivityQueryDto,
  BrandPayoutsObligationsQueryDto,
} from "./dto/brand-payouts-query.dto";
import { BrandPayoutsAuthorizationService } from "./services/brand-payouts-authorization.service";
import { BrandPayoutsQueryService } from "./services/brand-payouts-query.service";
import { BrandPayoutsReadEnvironmentService } from "./services/brand-payouts-read-environment.service";
import { FinancialActivityProjectionService } from "./services/financial-activity-projection.service";
import { PayoutObligationProjectionService } from "./services/payout-obligation-projection.service";
import {
  BrandPayoutsCursorCodec,
  isAfterCursor,
} from "./utils/brand-payouts-cursor";
import { classifyLedgerEntry } from "./utils/brand-payouts-projection";

const asOf = new Date("2026-09-04T12:00:00.000Z");
const ownerScope: BrandPayoutsFullFinancialAuthorizationScopeV1 = {
  kind: "FULL_FINANCIAL",
  role: "BRAND_OWNER",
  brandProfileId: "brand-a",
  membershipId: "membership-owner",
  authorizationVersion: "membership:2026-09-04T10:00:00.000Z",
  authorizedAsOf: asOf,
};
const managerScope: BrandPayoutsAuthorizationScopeV1 = {
  kind: "NO_FINANCIAL_ROWS",
  role: "CAMPAIGN_MANAGER",
  reason: "CANONICAL_ENTITY_SCOPE_UNAVAILABLE",
  brandProfileId: "brand-a",
  membershipId: "membership-manager",
  authorizationVersion: "membership:2026-09-04T10:00:00.000Z",
  authorizedAsOf: asOf,
};
const environment = { assertDatabaseUtc: vi.fn().mockResolvedValue(undefined) };

function cursorCodec(): BrandPayoutsCursorCodec {
  return new BrandPayoutsCursorCodec(
    new ConfigService({ JWT_SECRET: "unit-test-cursor-secret" }),
  );
}

function emptyPrisma(overrides: Record<string, unknown> = {}) {
  return {
    escrowTransactionLedger: { findMany: vi.fn().mockResolvedValue([]) },
    creatorPayoutObligation: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    routeTransferAttempt: { findMany: vi.fn().mockResolvedValue([]) },
    routeTransferReversal: { findMany: vi.fn().mockResolvedValue([]) },
    brandReturnRequest: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    brandEscrowVault: { findUnique: vi.fn().mockResolvedValue(null) },
    ...overrides,
  };
}

function activityService(prisma: object) {
  return new FinancialActivityProjectionService(
    prisma as never,
    cursorCodec(),
    environment as never,
  );
}

async function csvText(body: AsyncIterable<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

describe("Brand Payouts P1 authorization and fail-closed scope", () => {
  it.each([
    [BrandRole.BRAND_OWNER, "FULL_FINANCIAL"],
    [BrandRole.FINANCE_ADMIN, "FULL_FINANCIAL"],
    [BrandRole.CAMPAIGN_MANAGER, "NO_FINANCIAL_ROWS"],
  ] as const)(
    "derives %s only from the current active membership",
    async (role, kind) => {
      const workspace = {
        resolveBrandContextReadOnly: vi.fn().mockResolvedValue({
          brandProfileId: "brand-a",
          membership: {
            id: "membership-1",
            role,
            updatedAt: new Date("2026-09-04T10:00:00.000Z"),
          },
        }),
      };
      const service = new BrandPayoutsAuthorizationService(workspace as never);
      await expect(
        service.resolve({ id: "user-1" } as never),
      ).resolves.toMatchObject({
        kind,
        role,
        brandProfileId: "brand-a",
        membershipId: "membership-1",
      });
      expect(workspace.resolveBrandContextReadOnly).toHaveBeenCalledOnce();
    },
  );

  it("returns zero Campaign Manager rows and non-disclosing details before financial queries", async () => {
    const forbiddenPrisma = new Proxy(
      {},
      {
        get: () => {
          throw new Error("financial query attempted");
        },
      },
    );
    const activity = activityService(forbiddenPrisma);
    const obligations = new PayoutObligationProjectionService(
      forbiddenPrisma as never,
      cursorCodec(),
      environment as never,
    );
    const query = new BrandPayoutsQueryService(
      forbiddenPrisma as never,
      cursorCodec(),
      environment as never,
      activity,
      obligations,
    );
    const responses = await Promise.all([
      query.readOverview({ authorization: managerScope, asOf }),
      query.listActivity({ authorization: managerScope, asOf, limit: 50 }),
      query.listObligations({ authorization: managerScope, asOf, limit: 50 }),
      query.listBrandReturns({ authorization: managerScope, asOf, limit: 50 }),
      query.listReserveRequests({
        authorization: managerScope,
        asOf,
        limit: 50,
      }),
    ]);
    expect(responses[0].viewer.projection_scope).toBe("NO_FINANCIAL_ROWS");
    for (const response of responses.slice(1)) {
      expect(response.sections[0]?.payload).toEqual([]);
      expect(response.sections[0]?.available_actions).toEqual([]);
    }
    await expect(
      query.readActivity({
        authorization: managerScope,
        asOf,
        resourceId: "ledger:any:recorded",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("Brand Payouts P1 DTO and cursor security", () => {
  it("validates page bounds, closed filters, and explicit-offset ranges", async () => {
    const valid = plainToInstance(BrandPayoutsActivityQueryDto, {
      limit: "100",
      categories: "MONEY_MOVEMENT,PROVIDER_EXECUTION",
      from: "2026-08-01T05:30:00+05:30",
      to: "2026-09-01T00:00:00.000Z",
    });
    expect(await validate(valid)).toEqual([]);
    expect(valid.limit).toBe(100);
    expect(valid.categories).toEqual(["MONEY_MOVEMENT", "PROVIDER_EXECUTION"]);

    const invalid = plainToInstance(BrandPayoutsObligationsQueryDto, {
      limit: "101",
      lifecycles: "PAID",
    });
    expect(await validate(invalid)).toHaveLength(2);

    const missingOffset = plainToInstance(BrandPayoutsActivityCsvQueryDto, {
      from: "2026-08-01T00:00:00",
      to: "2026-09-01T00:00:00",
    });
    expect(await validate(missingOffset)).not.toEqual([]);
  });

  it("binds signed cursors to Brand, membership, role, endpoint, filters, and as-of", () => {
    const codec = cursorCodec();
    const recordedAt = new Date("2026-09-04T11:00:00.123Z");
    const cursor = codec.encode({
      endpoint: "activity",
      filterKey: '{"categories":[]}',
      authorization: ownerScope,
      asOf,
      lastRecordedAt: recordedAt,
      lastStableId: "ledger:z:recorded",
    });
    expect(
      codec.decode({
        cursor,
        endpoint: "activity",
        filterKey: '{"categories":[]}',
        authorization: ownerScope,
        requestAsOf: new Date("2026-09-04T12:01:00.000Z"),
      }),
    ).toEqual({
      asOf,
      lastRecordedAt: recordedAt,
      lastStableId: "ledger:z:recorded",
    });
    const tampered = `${cursor.slice(0, -1)}${cursor.endsWith("a") ? "b" : "a"}`;
    expect(() =>
      codec.decode({
        cursor: tampered,
        endpoint: "activity",
        filterKey: '{"categories":[]}',
        authorization: ownerScope,
        requestAsOf: asOf,
      }),
    ).toThrow();
    expect(() =>
      codec.decode({
        cursor,
        endpoint: "activity",
        filterKey: '{"categories":[]}',
        authorization: { ...ownerScope, brandProfileId: "brand-b" },
        requestAsOf: asOf,
      }),
    ).toThrow();
  });

  it("continues same-millisecond rows by stable identity without duplicates", () => {
    const boundary = {
      asOf,
      lastRecordedAt: new Date("2026-09-04T11:00:00.123Z"),
      lastStableId: "ledger:m:recorded",
    };
    expect(
      isAfterCursor(boundary.lastRecordedAt, "ledger:l:recorded", boundary),
    ).toBe(true);
    expect(
      isAfterCursor(boundary.lastRecordedAt, "ledger:m:recorded", boundary),
    ).toBe(false);
    expect(
      isAfterCursor(boundary.lastRecordedAt, "ledger:n:recorded", boundary),
    ).toBe(false);
  });
});

describe("Brand Payouts P1 activity truth and recorded Security corrections", () => {
  it("omits TDS and never turns fixed-tranche legacy rows into settlement", () => {
    expect(
      classifyLedgerEntry(
        EscrowTransactionType.TDS_BUFFER_REVERSAL,
        EscrowTransactionStatus.CLEARED,
      ),
    ).toBeNull();
    expect(
      classifyLedgerEntry(
        EscrowTransactionType.TRANCHE_ADVANCE_RELEASE,
        EscrowTransactionStatus.CLEARED,
      ),
    ).toEqual({
      category: "INFORMATIONAL_LIFECYCLE",
      isFinancialMovement: false,
      normalizedStatus: "LEGACY_RECORDED_EVENT",
      legacyLimitationReason: "LEGACY_LEDGER_SEMANTICS_NOT_CANONICAL_EXECUTION",
    });
  });

  it("does not expose an unproven ledger Collaboration reference", async () => {
    const createdAt = new Date("2026-09-04T11:00:00.000Z");
    const prisma = emptyPrisma({
      escrowTransactionLedger: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ledger-1",
            brandProfileId: "brand-a",
            vaultId: "vault-a",
            collaborationId: "foreign-or-unverified-collaboration",
            transactionType: EscrowTransactionType.RESERVE,
            amount: new Decimal("10.0000"),
            currency: "INR",
            transactionStatus: EscrowTransactionStatus.CLEARED,
            createdAt,
            vault: {
              id: "vault-a",
              brandProfileId: "brand-a",
              currency: "INR",
              updatedAt: createdAt,
            },
          },
        ]),
      },
    });
    const response = await activityService(prisma).listActivity({
      authorization: ownerScope,
      asOf,
      limit: 10,
    });
    const row = response.sections[0]?.payload?.[0];
    expect(row?.source_reference).toBe("ledger:ledger-1");
    expect(row?.references).toEqual({
      campaign_id: null,
      collaboration_id: null,
      creator_reference: null,
      obligation_id: null,
      brand_return_id: null,
    });
  });

  it("degrades a processed reversal without its immutable processed timestamp", async () => {
    const t0 = new Date("2026-09-04T09:00:00.000Z");
    const t1 = new Date("2026-09-04T09:01:00.000Z");
    const t2 = new Date("2026-09-04T09:02:00.000Z");
    const t3 = new Date("2026-09-04T09:03:00.000Z");
    const t4 = new Date("2026-09-04T09:04:00.000Z");
    const t5 = new Date("2026-09-04T09:05:00.000Z");
    const creatorProfile = { id: "creator-a", updatedAt: t5 };
    const obligation = {
      id: "obligation-a",
      brandProfileId: "brand-a",
      collaborationId: "collaboration-a",
      vaultId: "vault-a",
      creatorProfileId: "creator-a",
      entitlementAmount: new Decimal("100.0000"),
      currency: "INR",
      updatedAt: t5,
      vault: {
        id: "vault-a",
        brandProfileId: "brand-a",
        currency: "INR",
        updatedAt: t5,
      },
      collaboration: {
        id: "collaboration-a",
        brandProfileId: "brand-a",
        campaignId: "campaign-a",
        updatedAt: t5,
        creatorUser: { creatorProfile },
      },
    };
    const transfer = {
      id: "transfer-a",
      amount: new Decimal("100.0000"),
      currency: "INR",
      state: "PARTIALLY_REVERSED",
      settlementState: "SETTLED",
      onHold: false,
      initiatedAt: t0,
      providerAcceptedAt: t1,
      processedAt: t2,
      releasedAt: null,
      settledAt: t3,
      failedAt: null,
      createdAt: t0,
      updatedAt: t5,
      obligation,
    };
    const prisma = emptyPrisma({
      routeTransferReversal: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "reversal-a",
            amount: new Decimal("20.0000"),
            currency: "INR",
            state: "PROCESSED",
            initiatedAt: t4,
            processedAt: null,
            failedAt: null,
            createdAt: t4,
            updatedAt: t5,
            transferAttempt: transfer,
          },
        ]),
      },
    });
    const response = await activityService(prisma).listActivity({
      authorization: ownerScope,
      asOf,
      limit: 10,
    });
    const row = response.sections[0]?.payload?.[0];
    expect(row?.normalized_status).toBe("LEGACY_UNRECONCILED");
    expect(row?.legacy?.limitation_reason_code).toBe(
      "REVERSAL_PROCESSED_MILESTONE_UNPROVEN",
    );
    expect(row?.is_financial_movement).toBe(false);
  });

  it("exports only the bounded projection with RFC 4180 and formula defense", async () => {
    const createdAt = new Date("2026-09-04T11:00:00.000Z");
    const prisma = emptyPrisma({
      creatorPayoutObligation: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "obligation-a",
            brandProfileId: "brand-a",
            vaultId: "vault-a",
            collaborationId: "collaboration-a",
            creatorProfileId: "creator-a",
            entitlementAmount: new Decimal("10.0000"),
            currency: "INR",
            status: "ELIGIBLE",
            createdAt,
            updatedAt: createdAt,
            vault: {
              id: "vault-a",
              brandProfileId: "brand-a",
              currency: "INR",
              updatedAt: createdAt,
            },
            collaboration: {
              id: "collaboration-a",
              brandProfileId: "brand-a",
              campaignId: "=HYPERLINK(test)",
              updatedAt: createdAt,
              creatorUser: {
                creatorProfile: { id: "creator-a", updatedAt: createdAt },
              },
            },
          },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });
    const exported = await activityService(prisma).readActivityCsv({
      authorization: ownerScope,
      asOf,
      fromInclusive: new Date("2026-09-01T00:00:00.000Z"),
      toExclusive: new Date("2026-09-05T00:00:00.000Z"),
    });
    const body = await csvText(exported.body);
    expect(exported.contentType).toBe("text/csv; charset=utf-8");
    expect(body).toContain("\r\n");
    expect(body).toContain("'=HYPERLINK(test)");
    expect(body).not.toContain("TDS_BUFFER_REVERSAL");
  });
});

describe("Brand Payouts P1 environment boundary", () => {
  it("fails closed when the database session is not UTC", async () => {
    const service = new BrandPayoutsReadEnvironmentService({
      $queryRaw: vi.fn().mockResolvedValue([{ TimeZone: "Asia/Kolkata" }]),
    } as never);
    await expect(service.assertDatabaseUtc()).rejects.toMatchObject({
      status: 503,
    });
  });
});

describe.skipIf(process.env.BRAND_PAYOUTS_DATABASE_TEST !== "true")(
  "Brand Payouts P1 disposable PostgreSQL security gate",
  () => {
    const queries: string[] = [];
    const prisma = new PrismaClient({
      log: [{ emit: "event", level: "query" }],
    });
    prisma.$on("query", (event) => queries.push(event.query));
    const db = prisma as unknown as PrismaService;
    const authorization = new BrandPayoutsAuthorizationService(
      new BrandWorkspaceAuthorizationService(
        db,
        new BrandCentreAuthService(db, {
          evictIfInactive: vi.fn(),
          touchActivity: vi.fn(),
        } as never),
      ),
    );
    const cursors = new BrandPayoutsCursorCodec(
      new ConfigService({ JWT_SECRET: "bp-p1-postgres-cursor-secret" }),
    );
    const readEnvironment = new BrandPayoutsReadEnvironmentService(db);
    const activity = new FinancialActivityProjectionService(
      db,
      cursors,
      readEnvironment,
    );
    const obligations = new PayoutObligationProjectionService(
      db,
      cursors,
      readEnvironment,
    );
    const payouts = new BrandPayoutsQueryService(
      db,
      cursors,
      readEnvironment,
      activity,
      obligations,
    );

    const testIds = {
      organizations: [] as string[],
      brands: [] as string[],
      users: [] as string[],
    };
    let brandAId: string;
    let brandBId: string;
    let ownerId: string;
    let financeId: string;
    let managerId: string;
    let brandBActorId: string;
    let noMembershipId: string;
    let inactiveId: string;
    let crossBrandId: string;
    let vaultAId: string;
    let vaultBId: string;
    let obligationAId: string;
    let obligationBId: string;

    async function createBrand(label: string) {
      const organization = await prisma.organization.create({
        data: { name: `BP-P1 ${label}`, kind: "BRAND" },
      });
      testIds.organizations.push(organization.id);
      const brand = await prisma.brandProfile.create({
        data: {
          organizationId: organization.id,
          domain: `${randomUUID()}.example.test`,
          name: `BP-P1 ${label}`,
          industry: "D2C",
          countryCode: "IN",
          currencyCode: "INR",
        },
      });
      testIds.brands.push(brand.id);
      return { organization, brand };
    }

    async function createBrandActor(
      organizationId: string,
      brandProfileId: string,
      role: BrandRole,
      isActive = true,
    ) {
      const user = await prisma.user.create({
        data: {
          organizationId,
          email: `${randomUUID()}@example.test`,
          role: UserRole.BRAND,
          authState: UserAuthState.ACTIVE,
        },
      });
      testIds.users.push(user.id);
      await prisma.brandTeamMember.create({
        data: { brandProfileId, userId: user.id, role, isActive },
      });
      return user.id;
    }

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/bp_p1_")
      ) {
        throw new Error(
          "Brand Payouts P1 tests require a disposable loopback bp_p1_* database",
        );
      }

      const brandA = await createBrand("Brand A");
      const brandB = await createBrand("Brand B");
      brandAId = brandA.brand.id;
      brandBId = brandB.brand.id;
      ownerId = await createBrandActor(
        brandA.organization.id,
        brandAId,
        BrandRole.BRAND_OWNER,
      );
      financeId = await createBrandActor(
        brandA.organization.id,
        brandAId,
        BrandRole.FINANCE_ADMIN,
      );
      managerId = await createBrandActor(
        brandA.organization.id,
        brandAId,
        BrandRole.CAMPAIGN_MANAGER,
      );
      brandBActorId = await createBrandActor(
        brandB.organization.id,
        brandBId,
        BrandRole.BRAND_OWNER,
      );
      inactiveId = await createBrandActor(
        brandA.organization.id,
        brandAId,
        BrandRole.BRAND_OWNER,
        false,
      );
      crossBrandId = await createBrandActor(
        brandA.organization.id,
        brandBId,
        BrandRole.BRAND_OWNER,
      );
      const noMembership = await prisma.user.create({
        data: {
          organizationId: brandA.organization.id,
          email: `${randomUUID()}@example.test`,
          role: UserRole.BRAND,
          authState: UserAuthState.ACTIVE,
        },
      });
      noMembershipId = noMembership.id;
      testIds.users.push(noMembership.id);

      const [vaultA, vaultB] = await Promise.all([
        prisma.brandEscrowVault.create({
          data: {
            brandProfileId: brandAId,
            razorpayVirtualAccountId: `sensitive-va-${randomUUID()}`,
            virtualAccountNumber: `sensitive-account-${randomUUID()}`,
            currency: "INR",
            totalPooledBalance: "1000.0000",
            availableBalance: "700.0000",
            lockedCampaignFunds: "200.0000",
            activeReturnCommitment: "100.0000",
          },
        }),
        prisma.brandEscrowVault.create({
          data: {
            brandProfileId: brandBId,
            razorpayVirtualAccountId: `sensitive-va-${randomUUID()}`,
            virtualAccountNumber: `sensitive-account-${randomUUID()}`,
            currency: "INR",
            totalPooledBalance: "9999.0000",
            availableBalance: "9999.0000",
          },
        }),
      ]);
      vaultAId = vaultA.id;
      vaultBId = vaultB.id;
      const recordedAt = new Date("2026-09-04T11:00:00.123Z");
      await prisma.escrowTransactionLedger.createMany({
        data: [
          {
            id: "bp-p1-ledger-a-001",
            vaultId: vaultAId,
            brandProfileId: brandAId,
            collaborationId: "unverified-sensitive-collaboration-reference",
            transactionType: EscrowTransactionType.CREATOR_PAYOUT_SETTLEMENT,
            amount: "10.0000",
            currency: "INR",
            idempotencyKey: `bp-p1-${randomUUID()}`,
            gatewayReferenceId: `sensitive-gateway-${randomUUID()}`,
            transactionStatus: EscrowTransactionStatus.CLEARED,
            errorDiagnosticPayload: { secret: "sensitive-provider-diagnostic" },
            createdAt: recordedAt,
          },
          {
            id: "bp-p1-ledger-a-002",
            vaultId: vaultAId,
            brandProfileId: brandAId,
            transactionType: EscrowTransactionType.CREATOR_PAYOUT_SETTLEMENT,
            amount: "20.0000",
            currency: "INR",
            idempotencyKey: `bp-p1-${randomUUID()}`,
            transactionStatus: EscrowTransactionStatus.CLEARED,
            createdAt: recordedAt,
          },
          {
            id: "bp-p1-ledger-a-003",
            vaultId: vaultAId,
            brandProfileId: brandAId,
            transactionType: EscrowTransactionType.RESERVE,
            amount: "30.0000",
            currency: "INR",
            idempotencyKey: `bp-p1-${randomUUID()}`,
            transactionStatus: EscrowTransactionStatus.CLEARED,
            createdAt: recordedAt,
          },
          {
            id: "bp-p1-ledger-b-001",
            vaultId: vaultBId,
            brandProfileId: brandBId,
            transactionType: EscrowTransactionType.CREATOR_PAYOUT_SETTLEMENT,
            amount: "9999.0000",
            currency: "INR",
            idempotencyKey: `bp-p1-${randomUUID()}`,
            transactionStatus: EscrowTransactionStatus.CLEARED,
            createdAt: recordedAt,
          },
        ],
      });

      const creatorOrganization = await prisma.organization.create({
        data: { name: "BP-P1 Creator", kind: "CREATOR" },
      });
      testIds.organizations.push(creatorOrganization.id);
      const creatorUser = await prisma.user.create({
        data: {
          organizationId: creatorOrganization.id,
          email: `${randomUUID()}@example.test`,
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
        },
      });
      testIds.users.push(creatorUser.id);
      const creatorProfile = await prisma.creatorProfile.create({
        data: {
          userId: creatorUser.id,
          displayName: "BP-P1 Creator",
          primaryRegion: "IN",
        },
      });
      const payoutProfile = await prisma.creatorPayoutProfile.create({
        data: {
          creatorProfileId: creatorProfile.id,
          externalReferenceId: `sensitive-external-${randomUUID()}`,
          linkedAccountId: `sensitive-linked-${randomUUID()}`,
          stakeholderId: `sensitive-stakeholder-${randomUUID()}`,
          providerAccountStatus: "sensitive-provider-status",
          operationalEligibility: "ELIGIBLE_FOR_TRANSFER",
        },
      });
      for (const [brand, vault, suffix] of [
        [brandA.brand, vaultA, "a"],
        [brandB.brand, vaultB, "b"],
      ] as const) {
        const campaign = await prisma.uceCampaign.create({
          data: { brandProfileId: brand.id, name: `BP-P1 campaign ${suffix}` },
        });
        const brief = await prisma.uceCampaignBrief.create({
          data: {
            campaignId: campaign.id,
            internalTitle: `BP-P1 brief ${suffix}`,
            creativeGuidelines: "Disposable PostgreSQL fixture",
            requiredPlatforms: ["INSTAGRAM"],
          },
        });
        const collaboration = await prisma.collaboration.create({
          data: {
            brandProfileId: brand.id,
            creatorUserId: creatorUser.id,
            campaignId: campaign.id,
            briefId: brief.id,
            industry: "D2C_ECOMMERCE",
          },
        });
        const obligation = await prisma.creatorPayoutObligation.create({
          data: {
            settlementInstructionId: `bp-p1-instruction-${suffix}`,
            collaborationId: collaboration.id,
            vaultId: vault.id,
            brandProfileId: brand.id,
            creatorProfileId: creatorProfile.id,
            payoutProfileId: payoutProfile.id,
            obligationType: "FULL",
            entitlementAmount: suffix === "a" ? "80.0000" : "888.0000",
            currency: "INR",
            instructionIssuedAt: recordedAt,
          },
        });
        if (suffix === "a") obligationAId = obligation.id;
        else obligationBId = obligation.id;
      }
      queries.length = 0;
    });

    afterAll(async () => {
      try {
        await prisma.creatorPayoutObligation.deleteMany({
          where: { brandProfileId: { in: testIds.brands } },
        });
        await prisma.collaboration.deleteMany({
          where: { brandProfileId: { in: testIds.brands } },
        });
        await prisma.uceCampaignBrief.deleteMany({
          where: { campaign: { brandProfileId: { in: testIds.brands } } },
        });
        await prisma.uceCampaign.deleteMany({
          where: { brandProfileId: { in: testIds.brands } },
        });
        await prisma.escrowTransactionLedger.deleteMany({
          where: { brandProfileId: { in: testIds.brands } },
        });
        await prisma.brandEscrowVault.deleteMany({
          where: { brandProfileId: { in: testIds.brands } },
        });
        await prisma.brandTeamMember.deleteMany({
          where: { brandProfileId: { in: testIds.brands } },
        });
        await prisma.user.deleteMany({ where: { id: { in: testIds.users } } });
        await prisma.brandProfile.deleteMany({
          where: { id: { in: testIds.brands } },
        });
        await prisma.organization.deleteMany({
          where: { id: { in: testIds.organizations } },
        });
      } finally {
        await prisma.$disconnect();
      }
    });

    it.each([
      ["Owner", () => ownerId, "BRAND_OWNER"],
      ["Finance", () => financeId, "FINANCE_ADMIN"],
    ] as const)(
      "returns Brand A financial truth to %s only",
      async (_label, id, role) => {
        queries.length = 0;
        const scope = await authorization.resolve({ id: id() } as never);
        expect(scope).toMatchObject({
          kind: "FULL_FINANCIAL",
          role,
          brandProfileId: brandAId,
        });
        const asOf = new Date();
        const [overview, obligationPage] = await Promise.all([
          payouts.readOverview({ authorization: scope, asOf }),
          payouts.listObligations({ authorization: scope, asOf, limit: 50 }),
        ]);
        expect(overview.sections[0]?.payload).toMatchObject({
          projection: "FULL_FINANCIAL",
          available_funds: {
            status: "AUTHORITATIVE",
            value: { amount: "700.0000", currency: "INR" },
          },
          committed_protected_funds: {
            status: "AUTHORITATIVE",
            value: { amount: "200.0000", currency: "INR" },
          },
          settled_activity: {
            status: "AUTHORITATIVE",
            value: { amount: "30.0000", currency: "INR" },
          },
        });
        expect(obligationPage.sections[0]?.payload).toHaveLength(1);
        expect(obligationPage.sections[0]?.payload[0]).toMatchObject({
          obligation_id: obligationAId,
          payment_due_at: null,
          lifecycle: "LEGACY_UNRECONCILED",
          legacy: {
            classification: "LEGACY_UNRECONCILED",
            limitation_reason_code: "PROTECTED_FUNDING_EVIDENCE_UNAVAILABLE",
          },
        });
        const serialized = JSON.stringify({ overview, obligationPage });
        expect(serialized).not.toContain(obligationBId);
        expect(serialized).not.toContain("888.0000");
        expect(serialized).not.toMatch(
          /razorpay|virtualAccountNumber|gatewayReference|diagnosticPayload|linkedAccount|stakeholder|providerAccountStatus/iu,
        );
        expect(
          queries.filter((query) =>
            /\b(INSERT|UPDATE|DELETE|MERGE)\b/iu.test(query),
          ),
        ).toEqual([]);
      },
    );

    it("returns no financial rows to Campaign Manager without querying a financial source", async () => {
      const scope = await authorization.resolve({ id: managerId } as never);
      expect(scope.kind).toBe("NO_FINANCIAL_ROWS");
      queries.length = 0;
      const asOf = new Date();
      const [overview, activityPage, obligationPage, returnPage, reservePage] =
        await Promise.all([
          payouts.readOverview({ authorization: scope, asOf }),
          payouts.listActivity({ authorization: scope, asOf, limit: 50 }),
          payouts.listObligations({ authorization: scope, asOf, limit: 50 }),
          payouts.listBrandReturns({ authorization: scope, asOf, limit: 50 }),
          payouts.listReserveRequests({
            authorization: scope,
            asOf,
            limit: 50,
          }),
        ]);
      expect(overview.sections[0]?.payload.projection).toBe(
        "CAMPAIGN_OPERATIONAL",
      );
      for (const page of [
        activityPage,
        obligationPage,
        returnPage,
        reservePage,
      ]) {
        expect(page.sections[0]?.payload).toEqual([]);
      }
      expect(queries).toEqual([]);
    });

    it("isolates Brand B and rejects missing, inactive, and cross-Brand memberships", async () => {
      const brandBScope = await authorization.resolve({
        id: brandBActorId,
      } as never);
      const page = await payouts.listActivity({
        authorization: brandBScope,
        asOf: new Date(),
        limit: 50,
        categories: ["MONEY_MOVEMENT"],
      });
      const serialized = JSON.stringify(page);
      expect(serialized).toContain("bp-p1-ledger-b-001");
      expect(serialized).not.toContain("bp-p1-ledger-a-");
      for (const id of [noMembershipId, inactiveId, crossBrandId]) {
        await expect(
          authorization.resolve({ id } as never),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
    });

    it("continues immutable same-millisecond activity without duplicates or foreign rows", async () => {
      const scope = await authorization.resolve({ id: ownerId } as never);
      const request = {
        authorization: scope,
        asOf: new Date(),
        limit: 2,
        categories: ["MONEY_MOVEMENT", "PROTECTED_ALLOCATION"] as const,
      };
      const first = await payouts.listActivity(request);
      const nextCursor = first.sections[0]?.page.next_cursor;
      expect(nextCursor).toBeTruthy();
      const second = await payouts.listActivity({
        ...request,
        cursor: nextCursor ?? undefined,
      });
      const firstIds =
        first.sections[0]?.payload.map((item) => item.activity_id) ?? [];
      const secondIds =
        second.sections[0]?.payload.map((item) => item.activity_id) ?? [];
      expect(first.as_of).toBe(second.as_of);
      expect(firstIds).toHaveLength(2);
      expect(secondIds).toHaveLength(1);
      expect(new Set([...firstIds, ...secondIds]).size).toBe(3);
      expect([...firstIds, ...secondIds].join(" ")).not.toContain(
        "bp-p1-ledger-b-001",
      );
      expect(
        [
          ...(first.sections[0]?.payload ?? []),
          ...(second.sections[0]?.payload ?? []),
        ].every((item) => item.source_owner === "FINANCIAL_LEDGER"),
      ).toBe(true);
    });
  },
);
