import "reflect-metadata";
import { Test } from "@nestjs/testing";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CampaignApplicationsController } from "./campaign-applications.controller";
import { ApplicationSubmitService } from "./application-submit.service";
import { ApplicationTerminalService } from "./application-terminal.service";
import { ApplicationHistoryService } from "./application-history.service";
import { CreatorBriefPackService } from "./creator-brief-pack.service";
import { privateApplicationResponse } from "./campaign-applications.module";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

describe("P5 Brief Pack HTTP boundary", () => {
  it("returns private JSON and bounded errors behind JWT and UUID validation", async () => {
    const get = vi.fn();
    // Vitest's esbuild transform does not emit Nest constructor metadata.
    Reflect.defineMetadata(
      "design:paramtypes",
      [
        ApplicationSubmitService,
        ApplicationTerminalService,
        ApplicationHistoryService,
        CreatorBriefPackService,
      ],
      CampaignApplicationsController,
    );
    const module = await Test.createTestingModule({
      controllers: [CampaignApplicationsController],
      providers: [
        { provide: CreatorBriefPackService, useValue: { get } },
        ...[
          ApplicationSubmitService,
          ApplicationTerminalService,
          ApplicationHistoryService,
        ].map((provide) => ({ provide, useValue: {} })),
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: {
          switchToHttp(): {
            getRequest(): { headers: Record<string, string>; user?: object };
          };
        }) {
          const req = context.switchToHttp().getRequest();
          if (!req.headers.authorization) throw new UnauthorizedException();
          req.user = { id: "current-authenticated-user" };
          return true;
        },
      })
      .compile();
    const app = module.createNestApplication({ logger: false });
    app.use(privateApplicationResponse);
    try {
      await app.listen(0, "127.0.0.1");
      const base = `${await app.getUrl()}/api/v1/creator/applications/`;
      const applicationId = randomUUID();
      for (const status of [200, 400, 401, 403, 404, 409]) {
        get.mockReset();
        if (status === 403)
          get.mockRejectedValue(
            new ForbiddenException({ code: "CREATOR_TEAM_ACCESS_DENIED" }),
          );
        else if (status === 404)
          get.mockRejectedValue(
            new NotFoundException({ code: "APPLICATION_NOT_FOUND" }),
          );
        else if (status === 409)
          get.mockRejectedValue(
            new ConflictException({
              code: "APPLICATION_BRIEF_PACK_UNAVAILABLE",
            }),
          );
        else get.mockResolvedValue({ schemaVersion: 1 });
        const response = await fetch(
          base + (status === 400 ? "invalid" : applicationId) + "/brief-pack",
          { headers: status === 401 ? {} : { Authorization: "fixture" } },
        );
        expect(response.status).toBe(status);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(response.headers.get("vary")).toContain("Authorization");
        expect(response.headers.get("vary")).toContain("Cookie");
        expect(response.headers.get("content-type")).toContain(
          "application/json",
        );
        if (status === 400 || status === 401)
          expect(get).not.toHaveBeenCalled();
        else
          expect(get).toHaveBeenCalledWith(
            { id: "current-authenticated-user" },
            applicationId,
          );
        if (status === 409)
          expect(await response.json()).toEqual({
            code: "APPLICATION_BRIEF_PACK_UNAVAILABLE",
          });
      }
    } finally {
      await app.close();
    }
  }, 30000);
});
