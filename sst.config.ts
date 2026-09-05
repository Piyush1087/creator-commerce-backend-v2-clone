/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "creatorshop-be",
      removal: "retain",
      home: "aws",
      providers: {
        aws: {
          region: "ap-south-1",
          profile: input?.stage === "prod" ? "creator-prod" : "creator-dev",
        },
      },
    };
  },
  async run() {
    const path = await import("path");
    const dotenv = await import("dotenv");
    const fs = await import("fs");
    const cwd = process.cwd();
    const envPaths = [
      path.join(cwd, ".env"),
      path.join(cwd, "creator-commerce-backend-v2", ".env"),
    ];

    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: true });
        break;
      }
    }

    const vpc = new sst.aws.Vpc("vpc2", {
      bastion: $app.stage === "prod",
    });

    const aurora = new sst.aws.Aurora("core", {
      engine: "postgres",
      vpc,
      scaling: {
        min: "0 ACU",
        max: "2 ACU",
        pauseAfter: "15 minutes",
      },
      dev: {
        username: "postgres",
        password: "password",
        database: "thecreatorshop",
        host: "localhost",
        port: 5432,
      },
    });

    const devDatabaseUrlOverride =
      $app.stage === "dev" ? process.env.DEV_DATABASE_URL : undefined;
    const DATABASE_URL =
      devDatabaseUrlOverride && devDatabaseUrlOverride.trim().length > 0
        ? devDatabaseUrlOverride
        : $interpolate`postgresql://${aurora.username}:${aurora.password}@${aurora.host}:${aurora.port}/${aurora.database}`;

    const requiredEnv = (name: string): string => {
      const value = process.env[name]?.trim();
      if (!value || /placeholder|replace-me|not-for-deploy/i.test(value)) {
        throw new Error(
          `${name} must be configured with a non-placeholder value`,
        );
      }
      return value;
    };
    const authSuffix = $app.stage === "prod" ? "PROD" : "DEV";
    const JWT_SECRET = requiredEnv(`JWT_SECRET_${authSuffix}`);
    const AUTH_OTP_PEPPER = requiredEnv(`AUTH_OTP_PEPPER_${authSuffix}`);
    const GATEKEEPER_TERMS_VERSION = requiredEnv("GATEKEEPER_TERMS_VERSION");
    const GATEKEEPER_PRIVACY_POLICY_VERSION = requiredEnv(
      "GATEKEEPER_PRIVACY_POLICY_VERSION",
    );

    const defaultFrontendUrl =
      $app.stage === "prod"
        ? "https://dashboard.thecreatorshop.in"
        : $app.stage === "dev"
          ? "https://dashboard.dev.thecreatorshop.in"
          : "http://localhost:5173";

    const defaultCorsOrigins =
      $app.stage === "prod"
        ? "https://dashboard.thecreatorshop.in"
        : "http://localhost:5173,https://dashboard.dev.thecreatorshop.in,https://dashboard.thecreatorshop.in";

    const { buildNotificationPostmarkTemplateEnv } =
      await import("./src/features/notifications/config/notification-postmark-env");

    const filesBucket = new sst.aws.Bucket("files-v2", {
      access: "public",
      transform: {
        bucket: (args) => {
          args.bucket = `creatorshop-v2-files-${$app.stage}`;
        },
      },
    });

    const cluster = new sst.aws.Cluster("api-cluster", { vpc });

    /**
     * Secrets and keys from repo `.env` (dotenv above). Deployed S3 bucket name
     * comes from SST `files-v2`, not `S3_BUCKET_NAME` in `.env` (local only).
     */
    const apiEnvironment = {
      STAGE: $app.stage,
      PORT: "80",
      DATABASE_URL,
      RUN_MIGRATIONS_ON_START: $app.stage === "dev" ? "true" : "false",
      APP_BACKEND_URL:
        $app.stage === "prod"
          ? "https://api.thecreatorshop.in"
          : "https://api.dev.thecreatorshop.in",
      CORS_ORIGINS: process.env.CORS_ORIGINS?.trim() || defaultCorsOrigins,
      JWT_SECRET,
      JWT_ISSUER:
        process.env.JWT_ISSUER?.trim() || `creatorshop-api-${$app.stage}`,
      JWT_AUDIENCE: process.env.JWT_AUDIENCE?.trim() || "creatorshop-dashboard",
      JWT_ACCESS_TTL: "15m",
      AUTH_REFRESH_TTL: "30d",
      AUTH_OTP_TTL: "10m",
      AUTH_RESET_TTL: "30m",
      AUTH_OTP_PEPPER,
      S3_BUCKET_NAME: filesBucket.name,
      AWS_REGION: process.env.AWS_REGION ?? "ap-south-1",
      POSTMARK_SERVER_TOKEN: process.env.POSTMARK_SERVER_TOKEN as string,
      POSTMARK_OTP_TEMPLATE_ID: process.env.POSTMARK_OTP_TEMPLATE_ID as string,
      POSTMARK_AUTH_OTP_TEMPLATE_ID: process.env
        .POSTMARK_AUTH_OTP_TEMPLATE_ID as string,
      POSTMARK_PASSWORD_RESET_TEMPLATE_ID: process.env
        .POSTMARK_PASSWORD_RESET_TEMPLATE_ID as string,
      POSTMARK_AUTH_FROM:
        process.env.POSTMARK_AUTH_FROM ?? "no-reply@thecreatorshop.in",
      POSTMARK_AUTH_MESSAGE_STREAM:
        process.env.POSTMARK_AUTH_MESSAGE_STREAM ?? "outbound",
      POSTMARK_NOTIFICATION_FROM:
        process.env.POSTMARK_NOTIFICATION_FROM ?? "no-reply@thecreatorshop.in",
      POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID:
        process.env.POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID ??
        process.env.POSTMARK_OTP_TEMPLATE_ID ??
        "",
      NOTIFICATIONS_DEV_EMIT_ENABLED:
        $app.stage === "prod"
          ? "false"
          : (process.env.NOTIFICATIONS_DEV_EMIT_ENABLED ?? "false"),
      APP_FRONTEND_URL:
        $app.stage === "prod"
          ? process.env.APP_FRONTEND_URL_PROD?.trim() || defaultFrontendUrl
          : $app.stage === "dev"
            ? process.env.APP_FRONTEND_URL_DEV?.trim() || defaultFrontendUrl
            : process.env.APP_FRONTEND_URL?.trim() || defaultFrontendUrl,
      ...buildNotificationPostmarkTemplateEnv(process.env),
      // Brand onboarding Stage 1A — Zyte + Playwright (Parallel is legacy only)
      BRAND_SCAN_ACQUISITION:
        process.env.BRAND_SCAN_ACQUISITION?.trim() || "zyte",
      ZYTE_API_KEY: process.env.ZYTE_API_KEY as string,
      ZYTE_API_URL:
        process.env.ZYTE_API_URL?.trim() || "https://api.zyte.com/v1/extract",
      ZYTE_REQUEST_TIMEOUT_MS: process.env.ZYTE_REQUEST_TIMEOUT_MS ?? "15000",
      // Stage 1A: Zyte + Playwright on deployed stages. Local follows .env (default off).
      // To disable PW on ECS intentionally, set PLAYWRIGHT_ENABLED=false and
      // PLAYWRIGHT_FORCE_OFF=true in the deploy .env.
      PLAYWRIGHT_ENABLED:
        $app.stage === "local"
          ? process.env.PLAYWRIGHT_ENABLED?.trim() || "false"
          : process.env.PLAYWRIGHT_FORCE_OFF === "true"
            ? "false"
            : "true",
      PLAYWRIGHT_TIMEOUT_MS: process.env.PLAYWRIGHT_TIMEOUT_MS ?? "25000",
      // Parallel provider is reused by Data Extraction company_public_web_research.
      PARALLEL_API_KEY: process.env.PARALLEL_API_KEY ?? "",
      PARALLEL_EXTRACT_TIMEOUT_MS:
        process.env.PARALLEL_EXTRACT_TIMEOUT_MS ?? "300000",
      PARALLEL_SEARCH_TIMEOUT_MS:
        process.env.PARALLEL_SEARCH_TIMEOUT_MS ?? "60000",
      PARALLEL_SEARCH_MAX_CHARS_TOTAL:
        process.env.PARALLEL_SEARCH_MAX_CHARS_TOTAL ?? "24000",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY as string,
      // Generic fallback matches development. Chat/Home release must set
      // GEMINI_MODEL=gemini-3.5-flash explicitly in the deployment environment.
      GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      GATEKEEPER_GEMINI_MODEL:
        process.env.GATEKEEPER_GEMINI_MODEL ??
        process.env.GEMINI_MODEL ??
        "gemini-3.6-flash",
      MCP_PLANNER_GEMINI_MODEL:
        process.env.MCP_PLANNER_GEMINI_MODEL ??
        process.env.GEMINI_MODEL ??
        "gemini-2.5-flash",
      BRAND_DNA_GEMINI_MODEL:
        process.env.BRAND_DNA_GEMINI_MODEL ??
        process.env.GEMINI_MODEL ??
        "gemini-2.5-flash",
      GEMINI_REQUEST_TIMEOUT_MS:
        process.env.GEMINI_REQUEST_TIMEOUT_MS ?? "120000",
      GATEKEEPER_TERMS_VERSION,
      GATEKEEPER_PRIVACY_POLICY_VERSION,
      GATEKEEPER_SUPPORT_URL: process.env.GATEKEEPER_SUPPORT_URL?.trim() ?? "",
      GATEKEEPER_OPENAI_MODEL_ID:
        process.env.GATEKEEPER_OPENAI_MODEL_ID?.trim() ?? "",
      BRAND_VERIFICATION_USE_REAL_OTP:
        process.env.BRAND_VERIFICATION_USE_REAL_OTP ?? "false",
      CREATOR_VERIFICATION_USE_REAL_OTP:
        process.env.CREATOR_VERIFICATION_USE_REAL_OTP ?? "false",
      // Data Extraction OpenAI runtime: model id is supplied by Intelligence at call time.
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
      OPENAI_REQUEST_TIMEOUT_MS:
        process.env.OPENAI_REQUEST_TIMEOUT_MS ?? "120000",
      DATA_EXTRACTION_PROVIDER_MAX_ATTEMPTS:
        process.env.DATA_EXTRACTION_PROVIDER_MAX_ATTEMPTS ?? "3",
      INSTAGRAM_API_ID: process.env.INSTAGRAM_API_ID as string,
      INSTAGRAM_APP_SECRET: process.env.INSTAGRAM_APP_SECRET as string,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
      // QA apply/eligibility bypass — default test@creator.com on non-prod; empty on prod unless set.
      CREATOR_APPLY_BYPASS_EMAILS:
        $app.stage === "prod"
          ? (process.env.CREATOR_APPLY_BYPASS_EMAILS ?? "")
          : (process.env.CREATOR_APPLY_BYPASS_EMAILS ?? "test@creator.com"),
      BRAND_SCAN_LIMITS_ENABLED:
        process.env.BRAND_SCAN_LIMITS_ENABLED ??
        ($app.stage === "local" ? "false" : "true"),
      BRAND_SCAN_FORCE_REFRESH: process.env.BRAND_SCAN_FORCE_REFRESH ?? "false",
      RAZORPAY_API_KEY_ID: process.env.RAZORPAY_API_KEY_ID as string,
      RAZORPAY_API_KEY_SECRET: process.env.RAZORPAY_API_KEY_SECRET as string,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET as string,
      RAZORPAY_ROUTE_WEBHOOK_SECRET:
        process.env.RAZORPAY_ROUTE_WEBHOOK_SECRET ?? "",
      RAZORPAY_ROUTE_WEBHOOK_EVENT_MAP:
        process.env.RAZORPAY_ROUTE_WEBHOOK_EVENT_MAP ?? "{}",
      RAZORPAY_BRAND_RETURN_WEBHOOK_SECRET:
        process.env.RAZORPAY_BRAND_RETURN_WEBHOOK_SECRET ?? "",
      RAZORPAY_BRAND_RETURN_WEBHOOK_EVENT_MAP:
        process.env.RAZORPAY_BRAND_RETURN_WEBHOOK_EVENT_MAP ?? "{}",
      SETTINGS_FIELD_ENCRYPTION_KEY: process.env
        .SETTINGS_FIELD_ENCRYPTION_KEY as string,
      PUBLIC_API_BASE_URL:
        process.env.PUBLIC_API_BASE_URL?.trim() ||
        ($app.stage === "prod"
          ? "https://api.thecreatorshop.in"
          : $app.stage === "dev"
            ? "https://api.dev.thecreatorshop.in"
            : "http://localhost:3000"),
      POSTMARK_TEAM_INVITE_TEMPLATE_ID:
        process.env.POSTMARK_TEAM_INVITE_TEMPLATE_ID ?? "",
      EXTERNAL_API_TIMEOUT_MS: process.env.EXTERNAL_API_TIMEOUT_MS ?? "10000",
    };

    cluster.addService("api", {
      link: [aurora, filesBucket],
      architecture: "arm64",
      memory: "1 GB",
      cpu: "0.5 vCPU",
      environment: apiEnvironment,
      loadBalancer: {
        ports: [{ listen: "443/https", forward: "80/http" }],
        health: {
          "80/http": {
            path: "/health/live",
            interval: "10 seconds",
            timeout: "5 seconds",
            healthyThreshold: 2,
            unhealthyThreshold: 5,
          },
        },
        domain: {
          name:
            $app.stage === "prod"
              ? "api.thecreatorshop.in"
              : "api.dev.thecreatorshop.in",
          cert:
            $app.stage === "prod"
              ? "arn:aws:acm:ap-south-1:250037328530:certificate/9547cda0-07e6-46b2-b4ff-5cdac211ab92"
              : "arn:aws:acm:ap-south-1:841162679642:certificate/a1a5e51e-510c-4f5d-8f78-baa76c32bab9",
          dns: false,
        },
      },
      dev: {
        command: "npm run start:dev",
      },
      transform: {
        service: (args) => {
          args.healthCheckGracePeriodSeconds = 120;
        },
        // Surface scan holds the HTTP connection through Parallel + Gemini (~3–5 min).
        // ALB default idle timeout is 60s, which drops the client with "Failed to fetch"
        // while the ECS task still completes and persists the profile.
        loadBalancer: (args) => {
          args.idleTimeout = 600;
        },
      },
    });

    new sst.x.DevCommand("Prisma", {
      environment: { DATABASE_URL },
      dev: {
        autostart: false,
        command: "npx prisma studio",
      },
    });
  },
});
