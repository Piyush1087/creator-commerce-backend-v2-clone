import "reflect-metadata";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { AuthSessionService } from "../auth/auth-session.service";
import { JwtStrategy } from "../auth/jwt.strategy";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CampaignOpportunityModule } from "./campaign-opportunity.module";
import {
  CampaignOpportunityController,
  CreatorOpportunitiesController,
} from "./campaign-opportunity.controller";
import { CampaignOpportunityService } from "./campaign-opportunity.service";

describe("Opportunity private HTTP responses before guards", () => {
  it("preserves privacy, guard rejection, public handlers and CORS variance", async () => {
    const service = {
      collection: vi.fn(),
      detail: vi.fn().mockResolvedValue({ schemaVersion: 1, state: "TEASER" }),
      issue: vi.fn().mockResolvedValue({
        intent: "CAMPAIGN_APPLY",
        continuationToken: "t".repeat(43),
        expiresAt: new Date("2030-01-01"),
      }),
    };
    // Vitest's TS transform does not emit Nest constructor parameter metadata.
    for (const controller of [
      CampaignOpportunityController,
      CreatorOpportunitiesController,
    ]) {
      Reflect.defineMetadata(
        "design:paramtypes",
        [CampaignOpportunityService],
        controller,
      );
    }
    @Module({
      imports: [],
      controllers: [
        CampaignOpportunityController,
        CreatorOpportunitiesController,
      ],
      providers: [
        { provide: CampaignOpportunityService, useValue: service },
        { provide: AuthSessionService, useValue: { validate: vi.fn() } },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_SECRET: "opportunity-http-regression-test-only",
            JWT_ISSUER: "opportunity-test",
            JWT_AUDIENCE: "opportunity-test",
          }),
        },
        {
          provide: JwtAuthGuard,
          useFactory: () => new JwtAuthGuard(new Reflector()),
        },
        {
          provide: JwtStrategy,
          inject: [ConfigService, AuthSessionService],
          useFactory: (config: ConfigService, sessions: AuthSessionService) =>
            new JwtStrategy(config, sessions),
        },
      ],
    })
    class HttpFixtureModule extends CampaignOpportunityModule {}
    const module = await Test.createTestingModule({
      imports: [HttpFixtureModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new JwtAuthGuard(new Reflector()))
      .compile();
    const app = module.createNestApplication({ logger: false });
    const origin = "http://localhost:5173";
    app.enableCors({ origin: [origin], credentials: true });
    try {
      await app.listen(0, "127.0.0.1");
      const base = await app.getUrl();
      const privacy = (response: globalThis.Response) => {
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        const vary = response.headers
          .get("vary")
          ?.toLowerCase()
          .split(/\s*,\s*/);
        expect(vary).toEqual(
          expect.arrayContaining(["authorization", "cookie", "origin"]),
        );
        expect(response.headers.get("access-control-allow-origin")).toBe(
          origin,
        );
        expect(response.headers.get("access-control-allow-credentials")).toBe(
          "true",
        );
      };
      for (const authorization of [undefined, "Bearer invalid-test-token"]) {
        const response = await fetch(
          `${base}/api/v1/creator/campaigns/opportunities`,
          {
            headers: {
              Origin: origin,
              ...(authorization ? { Authorization: authorization } : {}),
            },
          },
        );
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({
          message: "Unauthorized",
          statusCode: 401,
        });
        privacy(response);
      }
      expect(service.collection).not.toHaveBeenCalled();
      const campaign = "00000000-0000-4000-8000-000000000001";
      const detail = await fetch(
        `${base}/api/v1/campaign-opportunities/${campaign}`,
        { headers: { Origin: origin } },
      );
      expect(detail.status).toBe(200);
      expect(await detail.json()).toEqual({
        schemaVersion: 1,
        state: "TEASER",
      });
      privacy(detail);
      const continuation = await fetch(
        `${base}/api/v1/campaign-opportunities/${campaign}/apply-continuation`,
        {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: "{}",
        },
      );
      expect(continuation.status).toBe(201);
      expect(await continuation.json()).toMatchObject({
        continuationPresent: true,
      });
      privacy(continuation);
      expect(service.detail).toHaveBeenCalledOnce();
      expect(service.issue).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  }, 30000);
});
