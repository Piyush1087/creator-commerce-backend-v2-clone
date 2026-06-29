-- Settings module: brand team/billing/notifications + creator workspace/social/shipping

CREATE TYPE "BrandRole" AS ENUM ('BRAND_OWNER', 'FINANCE_ADMIN', 'CAMPAIGN_MANAGER');
CREATE TYPE "SettingsNotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'SLACK_WEBHOOK');
CREATE TYPE "SettingsNotificationCategory" AS ENUM (
  'ESCROW_LOW_BALANCE',
  'MILESTONE_RELEASE_REQUEST',
  'TAX_COMPLIANCE_ALERT',
  'CAMPAIGN_BUDGET_OVERRUN'
);
CREATE TYPE "SocialNetworkProvider" AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE');
CREATE TYPE "OAuthTokenStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "CreatorTeamRole" AS ENUM ('OWNER', 'MANAGER', 'ASSISTANT');
CREATE TYPE "WorkspaceInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

ALTER TABLE "creator_shipping_addresses"
  ADD COLUMN IF NOT EXISTS "delivery_instructions_narrative" TEXT;

CREATE TABLE "brand_team_members" (
    "membership_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "BrandRole" NOT NULL DEFAULT 'CAMPAIGN_MANAGER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_team_members_pkey" PRIMARY KEY ("membership_id")
);

CREATE TABLE "brand_billing_profiles" (
    "profile_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "registered_company_name" VARCHAR(255) NOT NULL,
    "corporate_billing_address" TEXT NOT NULL,
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "default_tds_percentage" DECIMAL(5,2) NOT NULL DEFAULT 2.00,
    "currency_preference" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_billing_profiles_pkey" PRIMARY KEY ("profile_id")
);

CREATE TABLE "brand_withdrawal_accounts" (
    "account_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "beneficiary_name" VARCHAR(255) NOT NULL,
    "bank_name" VARCHAR(255) NOT NULL,
    "account_number_encrypted" TEXT NOT NULL,
    "ifsc_code" VARCHAR(11) NOT NULL,
    "is_verified_payout_destination" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_withdrawal_accounts_pkey" PRIMARY KEY ("account_id")
);

CREATE TABLE "brand_notification_settings" (
    "setting_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "category" "SettingsNotificationCategory" NOT NULL,
    "channel" "SettingsNotificationChannel" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "slack_webhook_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_notification_settings_pkey" PRIMARY KEY ("setting_id")
);

CREATE TABLE "creator_workspaces" (
    "id" TEXT NOT NULL,
    "owner_profile_id" TEXT NOT NULL,
    "organization_display_name" VARCHAR(150) NOT NULL DEFAULT 'My Creative Workspace',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "creator_workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "assigned_profile_id" TEXT,
    "associated_email" VARCHAR(255) NOT NULL,
    "security_role_token" "CreatorTeamRole" NOT NULL DEFAULT 'ASSISTANT',
    "is_active_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_workspace_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "creator_workspace_invitations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "allocated_role" "CreatorTeamRole" NOT NULL DEFAULT 'ASSISTANT',
    "invitation_status" "WorkspaceInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "secure_token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_workspace_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "creator_social_integrations" (
    "id" TEXT NOT NULL,
    "creator_profile_id" TEXT NOT NULL,
    "platform_network" "SocialNetworkProvider" NOT NULL,
    "native_platform_user_id" VARCHAR(100) NOT NULL,
    "channel_handle_string" VARCHAR(100) NOT NULL,
    "channel_display_title" VARCHAR(255),
    "verified_avatar_url" TEXT,
    "oauth_access_token_encrypted" TEXT NOT NULL,
    "oauth_refresh_token_encrypted" TEXT,
    "token_scope_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token_state_condition" "OAuthTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "token_expires_at" TIMESTAMP(3),
    "last_metadata_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_social_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_team_members_brand_id_user_id_key" ON "brand_team_members"("brand_id", "user_id");
CREATE INDEX "brand_team_members_user_id_brand_id_role_idx" ON "brand_team_members"("user_id", "brand_id", "role");
CREATE UNIQUE INDEX "brand_billing_profiles_brand_id_key" ON "brand_billing_profiles"("brand_id");
CREATE INDEX "brand_withdrawal_accounts_brand_id_idx" ON "brand_withdrawal_accounts"("brand_id");
CREATE UNIQUE INDEX "brand_notification_settings_brand_id_category_channel_key" ON "brand_notification_settings"("brand_id", "category", "channel");
CREATE INDEX "brand_notification_settings_brand_id_category_idx" ON "brand_notification_settings"("brand_id", "category");
CREATE UNIQUE INDEX "creator_workspace_members_workspace_id_associated_email_key" ON "creator_workspace_members"("workspace_id", "associated_email");
CREATE INDEX "creator_workspace_members_associated_email_is_active_active_idx" ON "creator_workspace_members"("associated_email", "is_active_active");
CREATE UNIQUE INDEX "creator_workspace_invitations_secure_token_hash_key" ON "creator_workspace_invitations"("secure_token_hash");
CREATE UNIQUE INDEX "creator_social_integrations_profile_platform_key" ON "creator_social_integrations"("creator_profile_id", "platform_network");
CREATE INDEX "creator_social_integrations_profile_platform_state_idx" ON "creator_social_integrations"("creator_profile_id", "platform_network", "token_state_condition");
CREATE INDEX "creator_shipping_addresses_profile_default_idx" ON "creator_shipping_addresses"("creator_profile_id", "is_default");

ALTER TABLE "brand_team_members" ADD CONSTRAINT "brand_team_members_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_team_members" ADD CONSTRAINT "brand_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_billing_profiles" ADD CONSTRAINT "brand_billing_profiles_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_withdrawal_accounts" ADD CONSTRAINT "brand_withdrawal_accounts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_notification_settings" ADD CONSTRAINT "brand_notification_settings_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_workspaces" ADD CONSTRAINT "creator_workspaces_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_workspace_members" ADD CONSTRAINT "creator_workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "creator_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_workspace_members" ADD CONSTRAINT "creator_workspace_members_assigned_profile_id_fkey" FOREIGN KEY ("assigned_profile_id") REFERENCES "creator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "creator_workspace_invitations" ADD CONSTRAINT "creator_workspace_invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "creator_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_social_integrations" ADD CONSTRAINT "creator_social_integrations_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
