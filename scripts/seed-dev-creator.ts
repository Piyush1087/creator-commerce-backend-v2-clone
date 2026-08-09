/**
 * Seed / upsert QA creator: test@creator.com
 *
 * Usage (from backend-v2 root, with DATABASE_URL set):
 *   npm run db:seed:dev-creator
 *
 * Idempotent create-or-update for user + creator profile (+ stub bank/shipping).
 * Pair with CREATOR_APPLY_BYPASS_EMAILS=test@creator.com so this account can
 * see ELIGIBLE_ONLY campaigns and apply without real Instagram Graph data.
 *
 * Login: test@creator.com — OTP stub 123456 when CREATOR_VERIFICATION_USE_REAL_OTP=false
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

const STUB_AUDIENCE_MATRIX = {
  age_distribution: { "18-24": 0.35, "25-34": 0.4, "35-44": 0.25 },
  top_countries: { IN: 0.72, US: 0.15 },
  gender_skew: { female: 0.58, male: 0.42 },
};

const PROFILE_FIELDS = {
  displayName: CREATOR_DISPLAY_NAME,
  instagramHandle: CREATOR_HANDLE,
  primaryRegion: "IN",
  followerCount: 45_000,
  audienceDemographicsMatrix: STUB_AUDIENCE_MATRIX,
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
            create: { ...PROFILE_FIELDS },
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
            ...PROFILE_FIELDS,
          },
        });
        console.log("Created missing creator profile");
      } else {
        await prisma.creatorProfile.update({
          where: { id: user.creatorProfile.id },
          data: { ...PROFILE_FIELDS },
        });
        console.log("Updated creator profile (handle, followers, region, audience)");
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

    const existingUserProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!existingUserProfile) {
      await prisma.userProfile.create({
        data: {
          userId: user.id,
          displayName: CREATOR_DISPLAY_NAME,
          totalReachCache: profile.followerCount,
          engagementRateCache: 6.2,
          topLocationCache: "Mumbai, IN",
          showTotalReach: true,
          showEngagementRate: true,
          showViewsMetric: true,
          showRatesColumn: true,
          shortFormVideoRate: 1250,
          storyBundleRate: 450,
        },
      });
      console.log("Created user profile (media kit layer)");
    } else {
      await prisma.userProfile.update({
        where: { userId: user.id },
        data: {
          displayName: CREATOR_DISPLAY_NAME,
          totalReachCache: profile.followerCount,
          topLocationCache: "Mumbai, IN",
        },
      });
      console.log("Updated user profile (media kit layer)");
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
    console.log("Creator seed complete (create-or-update).");
    console.log(`  Email:    ${CREATOR_EMAIL}`);
    console.log(`  OTP:      123456 (when CREATOR_VERIFICATION_USE_REAL_OTP=false)`);
    console.log(`  Handle:   @${CREATOR_HANDLE}`);
    console.log(`  Followers:${PROFILE_FIELDS.followerCount} (MICRO tier stub)`);
    console.log(
      `  Bypass:   set CREATOR_APPLY_BYPASS_EMAILS=${CREATOR_EMAIL} for targeting override`,
    );
    console.log(`  Threads:  ${threadCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
