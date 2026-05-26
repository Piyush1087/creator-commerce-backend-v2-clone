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

    /** Loaded from deploy machine `.env` via dotenv above — keep in sync with app ConfigService usage. */
    const apiEnvironment = {
      STAGE: $app.stage,
      PORT: "80",
      DATABASE_URL,
      APP_BACKEND_URL:
        $app.stage === "prod"
          ? "https://api.thecreatorshop.in"
          : "https://api.dev.thecreatorshop.in",
      APP_FRONTEND_URL:
        $app.stage === "prod"
          ? "https://dashboard.thecreatorshop.in"
          : "https://dashboard.dev.thecreatorshop.in",
      CORS_ORIGINS:
        process.env.CORS_ORIGINS ||
        "http://localhost:5173,https://dashboard.dev.thecreatorshop.in",
      JWT_SECRET: $app.stage === "prod" ? JWT_SECRET_PROD : JWT_SECRET_DEV,
      S3_BUCKET_NAME: filesBucket.name,
      AWS_REGION: "ap-south-1",
      POSTMARK_SERVER_TOKEN: process.env.POSTMARK_SERVER_TOKEN as string,
      POSTMARK_OTP_TEMPLATE_ID: process.env.POSTMARK_OTP_TEMPLATE_ID as string,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY as string,
      GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      GEMINI_REQUEST_TIMEOUT_MS:
        process.env.GEMINI_REQUEST_TIMEOUT_MS || "120000",
      PARALLEL_API_KEY: process.env.PARALLEL_API_KEY as string,
      PARALLEL_EXTRACT_TIMEOUT_MS:
        process.env.PARALLEL_EXTRACT_TIMEOUT_MS || "120000",
      PARALLEL_SEARCH_TIMEOUT_MS:
        process.env.PARALLEL_SEARCH_TIMEOUT_MS || "90000",
      PARALLEL_SEARCH_MAX_CHARS_TOTAL:
        process.env.PARALLEL_SEARCH_MAX_CHARS_TOTAL || "24000",
      PARALLEL_COMPETITOR_SEARCH_ENABLED:
        process.env.PARALLEL_COMPETITOR_SEARCH_ENABLED ?? "true",
      BRAND_VERIFICATION_USE_REAL_OTP:
        process.env.BRAND_VERIFICATION_USE_REAL_OTP ?? "true",
      BRAND_SCAN_LIMITS_ENABLED:
        process.env.BRAND_SCAN_LIMITS_ENABLED ?? "true",
      DEFAULT_CURRENCY_CODE: process.env.DEFAULT_CURRENCY_CODE || "USD",
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
