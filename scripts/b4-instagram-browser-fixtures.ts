import {
  AuthMethodType,
  BrandRole,
  OrganizationKind,
  PrismaClient,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { hashPasswordAsync } from "../src/shared/crypto/password.util";

const USER_ID = "b4000000-0000-4000-8000-000000000001";
const ORGANIZATION_ID = "b4000000-0000-4000-8000-000000000002";

async function main() {
  if (
    process.env.B4_BROWSER_FIXTURE_RUN !== "true" ||
    !process.env.B4_BROWSER_PASSWORD
  )
    throw new Error("B4 fixture guard and password are required");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/instagram_b4"
  )
    throw new Error("B4 fixtures require the exact disposable local database");
  const prisma = new PrismaClient();
  try {
    const fixtureExists = Boolean(
      await prisma.user.count({ where: { id: USER_ID } }),
    );
    const current = await prisma.intelligenceCurrentComponent.findFirstOrThrow({
      where: {
        objectSemanticId: "instagram_content_behavior",
        componentSemanticPath: "$",
        lifecycle: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
      include: { currentComponentGeneration: true },
    });
    const metadata = current.currentComponentGeneration
      .metadataPayload as Record<string, unknown>;
    if (
      typeof metadata.integrationId !== "string" ||
      typeof metadata.providerAccountId !== "string" ||
      typeof metadata.authorizationGeneration !== "number"
    )
      throw new Error("B4 current lineage metadata is invalid");
    const integrationId = metadata.integrationId;
    const providerANDAcct = metadata.providerAccountId;
    const authorizationGeneration = metadata.authorizationGeneration;
    const passwordHash = await hashPasswordAsync(
      process.env.B4_BROWSER_PASSWORD,
    );
    await prisma.$transaction(async (tx) => {
      if (fixtureExists) {
        await tx.user.update({
          where: { id: USER_ID },
          data: { hashedPassword: passwordHash },
        });
        await tx.userAuthMethod.updateMany({
          where: { userId: USER_ID, type: AuthMethodType.PASSWORD },
          data: { credentialHash: passwordHash },
        });
        return;
      }
      await tx.organization.create({
        data: {
          id: ORGANIZATION_ID,
          name: "B4 Browser Tenant",
          kind: OrganizationKind.BRAND,
        },
      });
      await tx.brandProfile.update({
        where: { id: current.brandId },
        data: { organizationId: ORGANIZATION_ID },
      });
      await tx.brandIntegration.update({
        where: { id: integrationId },
        data: { providerAccountId: providerANDAcct, authorizationGeneration },
      });
      await tx.user.create({
        data: {
          id: USER_ID,
          organizationId: ORGANIZATION_ID,
          email: "b4-owner@example.test",
          name: "B4 Brand Owner",
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
            create: {
              brandProfileId: current.brandId,
              role: BrandRole.BRAND_OWNER,
            },
          },
        },
      });
    });
    console.log(
      JSON.stringify({
        fixture: "B4_AUTHENTICATED_VERTICAL",
        reused: fixtureExists,
        brandId: current.brandId,
        account: "SYNTHETIC",
        credentials: "NOT_REPORTED",
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}
void main();
