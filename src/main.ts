import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://[::1]:5173",
  "https://dashboard.dev.thecreatorshop.in",
  "https://dashboard.thecreatorshop.in",
] as const;

const LOCAL_DEV_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function parseCorsOrigins(
  raw: string | undefined,
  defaults: readonly string[],
): string[] {
  if (raw == null || !String(raw).trim()) {
    return [...defaults];
  }
  const list = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? list : [...defaults];
}

function resolveCorsOrigin(
  allowedOrigins: readonly string[],
  stage: string | undefined,
) {
  const allowLocalDevOrigins = stage === "local";

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean | string) => void,
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, origin);
      return;
    }
    if (allowLocalDevOrigins && LOCAL_DEV_ORIGIN.test(origin)) {
      callback(null, origin);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const stage = config.get<string>("STAGE");

  const corsOrigins = parseCorsOrigins(
    config.get<string>("CORS_ORIGINS"),
    DEFAULT_CORS_ORIGINS,
  );

  app.enableCors({
    origin: resolveCorsOrigin(corsOrigins, stage),
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
      "x-idempotency-key",
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const port = config.get<number>("PORT", 3000);
  await app.listen(port);
}

void bootstrap();
