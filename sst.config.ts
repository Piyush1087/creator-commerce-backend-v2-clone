/// <reference path="./.sst/platform/config.d.ts" />

import { buildNotificationPostmarkTemplateEnv } from "./src/features/notifications/config/notification-postmark-env";

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

    const JWT_SECRET_DEV =
      process.env.JWT_SECRET_DEV ?? "ccs-jwt-dev-placeholder-change-me";
    const JWT_SECRET_PROD =
      process.env.JWT_SECRET_PROD ?? "ccs-jwt-prod-placeholder-change-me";

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
      CORS_ORIGINS:
        process.env.CORS_ORIGINS ||
        "http://localhost:5173,https://dashboard.dev.thecreatorshop.in,https://dashboard.thecreatorshop.in",
      JWT_SECRET: $app.stage === "prod" ? JWT_SECRET_PROD : JWT_SECRET_DEV,
      S3_BUCKET_NAME: filesBucket.name,
      AWS_REGION: process.env.AWS_REGION ?? "ap-south-1",
      POSTMARK_SERVER_TOKEN: process.env.POSTMARK_SERVER_TOKEN as string,
      POSTMARK_OTP_TEMPLATE_ID: process.env.POSTMARK_OTP_TEMPLATE_ID as string,
      POSTMARK_NOTIFICATION_FROM:
        process.env.POSTMARK_NOTIFICATION_FROM ??
        "no-reply@thecreatorshop.in",
      POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID:
        process.env.POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID ??
        process.env.POSTMARK_OTP_TEMPLATE_ID ??
        "",
      NOTIFICATIONS_DEV_EMIT_ENABLED:
        $app.stage === "prod"
          ? "false"
          : (process.env.NOTIFICATIONS_DEV_EMIT_ENABLED ?? "false"),
      APP_FRONTEND_URL:
        process.env.APP_FRONTEND_URL ??
        ($app.stage === "prod"
          ? "https://dashboard.thecreatorshop.in"
          : "https://dashboard.dev.thecreatorshop.in"),
      ...buildNotificationPostmarkTemplateEnv(process.env),
      PARALLEL_API_KEY: process.env.PARALLEL_API_KEY as string,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY as string,
      RAZORPAY_API_KEY_ID: process.env.RAZORPAY_API_KEY_ID as string,
      RAZORPAY_API_KEY_SECRET: process.env.RAZORPAY_API_KEY_SECRET as string,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET as string,
      SETTINGS_FIELD_ENCRYPTION_KEY:
        process.env.SETTINGS_FIELD_ENCRYPTION_KEY as string,
      EXTERNAL_API_TIMEOUT_MS:
        process.env.EXTERNAL_API_TIMEOUT_MS ?? "10000",
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
