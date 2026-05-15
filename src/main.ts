import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "https://dashboard.dev.thecreatorshop.in",
  "https://dashboard.thecreatorshop.in",
] as const;

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const corsOrigins = parseCorsOrigins(
    config.get<string>("CORS_ORIGINS"),
    DEFAULT_CORS_ORIGINS,
  );

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
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
