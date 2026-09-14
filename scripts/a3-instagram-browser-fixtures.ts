import {
  AuthMethodType,
  BrandRole,
  IndustryVertical,
  OrganizationKind,
  PrismaClient,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import { hashPasswordAsync } from "../src/shared/crypto/password.util";

const FIXTURES = {
  primaryOrganizationId: "a3000000-0000-4000-8000-000000000001",
  primaryBrandId: "a3000000-0000-4000-8000-000000000002",
  secondaryOrganizationId: "a3000000-0000-4000-8000-000000000003",
  secondaryBrandId: "a3000000-0000-4000-8000-000000000004",
  users: [
    {
      id: "a3000000-0000-4000-8000-000000000011",
      email: "a3-owner@example.test",
      name: "A3 Brand Owner",
      role: BrandRole.BRAND_OWNER,
      organization: "primary" as const,
    },
    {
      id: "a3000000-0000-4000-8000-000000000012",
      email: "a3-manager@example.test",
      name: "A3 Campaign Manager",
      role: BrandRole.CAMPAIGN_MANAGER,
      organization: "primary" as const,
    },
    {
      id: "a3000000-0000-4000-8000-000000000013",
      email: "a3-finance@example.test",
      name: "A3 Finance Admin",
      role: BrandRole.FINANCE_ADMIN,
      organization: "primary" as const,
    },
    {
      id: "a3000000-0000-4000-8000-000000000014",
      email: "a3-second-owner@example.test",
      name: "A3 Second Tenant Owner",
      role: BrandRole.BRAND_OWNER,
      organization: "secondary" as const,
    },
  ],
} as const;

function assertDisposableDatabase(): void {
  if (process.env.A3_BROWSER_FIXTURE_RUN !== "true") {
    throw new Error("A3_BROWSER_FIXTURE_RUN=true is required");
  }
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !url.pathname.startsWith("/bs07_")
  ) {
    throw new Error("A3 fixtures require a disposable local bs07_* database");
  }
  if (!process.env.A3_BROWSER_PASSWORD) {
    throw new Error("A3_BROWSER_PASSWORD is required");
  }
}

async function main(): Promise<void> {
  assertDisposableDatabase();
  const prisma = new PrismaClient();
  try {
    const fixtureIds = [
      FIXTURES.primaryOrganizationId,
      FIXTURES.primaryBrandId,
      FIXTURES.secondaryOrganizationId,
      FIXTURES.secondaryBrandId,
      ...FIXTURES.users.map((user) => user.id),
    ];
    const [organizations, brands, users] = await Promise.all([
      prisma.organization.count({ where: { id: { in: fixtureIds } } }),
      prisma.brandProfile.count({ where: { id: { in: fixtureIds } } }),
      prisma.user.count({ where: { id: { in: fixtureIds } } }),
    ]);
    if (organizations + brands + users !== 0) {
      throw new Error(
        "A3 fixture identities already exist; refusing overwrite",
      );
    }

    const passwordHash = await hashPasswordAsync(
      process.env.A3_BROWSER_PASSWORD as string,
    );

    await prisma.$transaction(async (tx) => {
      await tx.organization.create({
        data: {
          id: FIXTURES.primaryOrganizationId,
          name: "A3 Primary Brand Tenant",
          kind: OrganizationKind.BRAND,
          brandProfile: {
            create: {
              id: FIXTURES.primaryBrandId,
              domain: "a3-primary.example.test",
              name: "A3 Primary Brand",
              industry: IndustryVertical.D2C,
              brandValues: [],
              policyFlags: [],
            },
          },
        },
      });
      await tx.organization.create({
        data: {
          id: FIXTURES.secondaryOrganizationId,
          name: "A3 Second Brand Tenant",
          kind: OrganizationKind.BRAND,
          brandProfile: {
            create: {
              id: FIXTURES.secondaryBrandId,
              domain: "a3-secondary.example.test",
              name: "A3 Second Brand",
              industry: IndustryVertical.D2C,
              brandValues: [],
              policyFlags: [],
            },
          },
        },
      });

      for (const fixture of FIXTURES.users) {
        const primary = fixture.organization === "primary";
        const organizationId = primary
          ? FIXTURES.primaryOrganizationId
          : FIXTURES.secondaryOrganizationId;
        const brandProfileId = primary
          ? FIXTURES.primaryBrandId
          : FIXTURES.secondaryBrandId;
        await tx.user.create({
          data: {
            id: fixture.id,
            organizationId,
            email: fixture.email,
            name: fixture.name,
            role: UserRole.BRAND,
            authState: UserAuthState.ACTIVE,
            emailVerifiedAt: new Date(),
            hashedPassword: passwordHash,
            authMethods: {
              create: {
                type: AuthMethodType.PASSWORD,
                credentialHash: passwordHash,
              },
            },
            brandTeamMemberships: {
              create: { brandProfileId, role: fixture.role },
            },
          },
        });
      }
    });

    console.log(
      JSON.stringify({
        fixture: "A3_AUTHENTICATED_BROWSER",
        tenants: 2,
        roles: ["BRAND_OWNER", "CAMPAIGN_MANAGER", "FINANCE_ADMIN"],
        credentials: "SYNTHETIC_NOT_REPORTED",
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
