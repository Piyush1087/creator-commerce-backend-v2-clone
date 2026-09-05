import "reflect-metadata";
import { ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { JwtAuthGuard } from "./features/auth/jwt-auth.guard";
import { CreatorWorkspaceActorService } from "./features/creator-settings/team/creator-workspace-actor.service";
import { ApplicationSubmitService } from "./features/campaign-applications/application-submit.service";
import { ApplicationSubmitContextService } from "./features/campaign-applications/application-submit-context.service";
import { ApplicationTerminalService } from "./features/campaign-applications/application-terminal.service";
import { ApplicationHistoryService } from "./features/campaign-applications/application-history.service";
import { NotificationDispatchService } from "./features/notifications/services/notification-dispatch.service";
import { CampaignApplicationsController } from "./features/campaign-applications/campaign-applications.controller";
import { privateApplicationResponse } from "./features/campaign-applications/campaign-applications.module";

// Read the real bootstrap allowlist, rather than a second test-owned contract.
const main = readFileSync("src/main.ts", "utf8");
const lists = [...main.matchAll(/allowedHeaders:\s*\[([\s\S]*?)\]/g)];
const headers = [...(lists[0]?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
  (match) => match[1],
);
const origin = "http://localhost:5173";

describe("C03 canonical idempotency CORS contract", () => {
  let app: INestApplication;
  let url: string;
  const resolve = vi.fn(() => {
    throw new ForbiddenException({ code: "FIXTURE_DOMAIN_AUTHORITY_DENIED" });
  });
  beforeAll(async () => {
    // Vitest omits emitted constructor metadata. Restore production signatures
    // for this HTTP harness, as the repository's other Nest route tests do.
    Reflect.defineMetadata(
      "design:paramtypes",
      [
        ApplicationSubmitService,
        ApplicationTerminalService,
        ApplicationHistoryService,
      ],
      CampaignApplicationsController,
    );
    Reflect.defineMetadata(
      "design:paramtypes",
      [
        PrismaService,
        CreatorWorkspaceActorService,
        ApplicationSubmitContextService,
        NotificationDispatchService,
      ],
      ApplicationSubmitService,
    );
    const module = await Test.createTestingModule({
      controllers: [CampaignApplicationsController],
      providers: [
        ApplicationSubmitService,
        { provide: PrismaService, useValue: {} },
        { provide: CreatorWorkspaceActorService, useValue: { resolve } },
        { provide: ApplicationSubmitContextService, useValue: {} },
        { provide: NotificationDispatchService, useValue: {} },
        { provide: ApplicationTerminalService, useValue: {} },
        { provide: ApplicationHistoryService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication({ logger: false });
    app.enableCors({
      origin,
      credentials: true,
      methods: ["POST"],
      allowedHeaders: headers,
    });
    app.use(privateApplicationResponse);
    await app.listen(0, "127.0.0.1");
    url = `${await app.getUrl()}/api/v1/creator/campaigns/${randomUUID()}/applications`;
  });
  afterAll(async () => app?.close());

  it("keeps canonical and compatibility header names in actual bootstrap", () => {
    expect(lists).toHaveLength(1);
    expect(headers).toContain("Idempotency-Key");
    expect(headers).toContain("x-idempotency-key");
    expect(headers).not.toContain("*");
  });

  it("accepts an actual OPTIONS request without entering the command", async () => {
    resolve.mockClear();
    const response = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "authorization,content-type,idempotency-key",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );
    expect(
      response.headers
        .get("access-control-allow-headers")
        ?.toLowerCase()
        .split(/\s*,\s*/),
    ).toContain("idempotency-key");
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each(["missing", "canonical", "compatibility"] as const)(
    "%s header reaches only its authorized command boundary",
    async (kind) => {
      resolve.mockClear();
      const key = randomUUID();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(kind === "canonical" ? { "Idempotency-Key": key } : {}),
          ...(kind === "compatibility" ? { "x-idempotency-key": key } : {}),
        },
        body: JSON.stringify({
          campaignAssetId: randomUUID(),
          briefId: randomUUID(),
        }),
      });
      const body = (await response.json()) as { code: string };
      expect(response.status).toBe(kind === "canonical" ? 403 : 400);
      expect(body.code).toBe(
        kind === "canonical"
          ? "FIXTURE_DOMAIN_AUTHORITY_DENIED"
          : "APPLICATION_IDEMPOTENCY_KEY_REQUIRED",
      );
      expect(resolve).toHaveBeenCalledTimes(kind === "canonical" ? 1 : 0);
      expect(JSON.stringify(body)).not.toContain(key);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );
});
