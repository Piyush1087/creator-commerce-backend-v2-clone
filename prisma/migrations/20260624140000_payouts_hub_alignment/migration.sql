-- Brand payouts workspace role, escrow UPI VPA, creator bank verification status

CREATE TYPE "BrandPayoutsWorkspaceRole" AS ENUM ('CAMPAIGN_MANAGER', 'FINANCE_ADMIN');
CREATE TYPE "CreatorBankVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'SUSPENDED');

ALTER TABLE "brand_profiles"
  ADD COLUMN "payouts_workspace_role" "BrandPayoutsWorkspaceRole" NOT NULL DEFAULT 'FINANCE_ADMIN';

ALTER TABLE "brand_escrow_vaults"
  ADD COLUMN "upi_vpa" TEXT;

ALTER TABLE "creator_bank_details"
  ADD COLUMN "verification_status" "CreatorBankVerificationStatus" NOT NULL DEFAULT 'VERIFIED';
