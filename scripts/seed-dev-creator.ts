/**
 * Local / dev seed: test creator account for collaboration UI.
 *
 * Usage (from backend-v2 root):
 *   npm run db:seed:dev-creator
 *
 * Requires DATABASE_URL in .env (same as Prisma).
 * Idempotent — safe to re-run.
 */
import { PrismaClient, UserRole } from "@prisma/client";

const CREATOR_EMAIL = "test@creator.com";
const CREATOR_DISPLAY_NAME = "Test Creator";
const CREATOR_HANDLE = "test_creator";
const STUB_BANK = {
  accountHolder: "Test Creator",
  bankName: "HDFC Bank",
  accountNumber: "000123456789",
  ifscOrRouting: "HDFC0001234",
};
const STUB_ADDRESS = {
  recipientName: "Test Creator",
  addressLine1: "12 Creator Lane",
  addressLine2: "Suite 4",
  city: "Mumbai",
  stateRegion: "MH",
  postalCode: "400001",
  countryCode: "IN",
  phone: "+919876543210",
};

async function main() {
  const prisma = new PrismaClient();

  try {
    let user = await prisma.user.findUnique({
      where: { email: CREATOR_EMAIL },
      include: { creatorProfile: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: CREATOR_EMAIL,
          name: CREATOR_DISPLAY_NAME,
          role: UserRole.CREATOR,
          creatorProfile: {
            create: {
              displayName: CREATOR_DISPLAY_NAME,
              instagramHandle: CREATOR_HANDLE,
            },
          },
        },
        include: { creatorProfile: true },
      });
      console.log(`Created user ${CREATOR_EMAIL} (${user.id})`);
    } else {
      if (user.role !== UserRole.CREATOR) {
        throw new Error(
          `${CREATOR_EMAIL} exists with role ${user.role}; cannot seed as CREATOR.`,
        );
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { name: CREATOR_DISPLAY_NAME },
      });
      if (!user.creatorProfile) {
        await prisma.creatorProfile.create({
          data: {
            userId: user.id,
            displayName: CREATOR_DISPLAY_NAME,
            instagramHandle: CREATOR_HANDLE,
          },
        });
      } else {
        await prisma.creatorProfile.update({
          where: { id: user.creatorProfile.id },
          data: {
            displayName: CREATOR_DISPLAY_NAME,
            instagramHandle: CREATOR_HANDLE,
          },
        });
      }
      console.log(`Updated existing user ${CREATOR_EMAIL}`);
      user = await prisma.user.findUniqueOrThrow({
        where: { email: CREATOR_EMAIL },
        include: { creatorProfile: true },
      });
    }

    const profile = user.creatorProfile;
    if (!profile) {
      throw new Error("Creator profile missing after seed");
    }

    const existingBank = await prisma.creatorBankDetails.findFirst({
      where: { creatorProfileId: profile.id, isPrimary: true },
    });
    if (!existingBank) {
      await prisma.creatorBankDetails.create({
        data: { creatorProfileId: profile.id, ...STUB_BANK, isPrimary: true },
      });
      console.log("Created primary bank details");
    }

    const existingAddress = await prisma.creatorShippingAddress.findFirst({
      where: { creatorProfileId: profile.id, isDefault: true },
    });
    if (!existingAddress) {
      await prisma.creatorShippingAddress.create({
        data: { creatorProfileId: profile.id, ...STUB_ADDRESS, isDefault: true },
      });
      console.log("Created default shipping address");
    }

    const threadCount = await prisma.collaboration.count({
      where: { creatorUserId: user.id },
    });

    console.log("");
    console.log("Creator seed complete.");
    console.log(`  Email:    ${CREATOR_EMAIL}`);
    console.log(`  OTP:      123456 (login stub)`);
    console.log(`  Handle:   @${CREATOR_HANDLE}`);
    console.log(`  Threads:  ${threadCount} (approve a UCE applicant as brand to create one)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
