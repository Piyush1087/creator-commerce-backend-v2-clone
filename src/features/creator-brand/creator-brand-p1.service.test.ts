import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { CreatorBrandService } from "./creator-brand.service";
import {
  CreatorBrandRepository,
  projectCreatorBrandAvatar,
} from "./creator-brand.repository";
import { CreatorBrandController } from "./creator-brand.controller";
import { CreatorBrandManualRequestSchema } from "./dto/creator-brand-consumer.schema";
import {
  CREATOR_BRAND_ROLE_POLICY,
  CreatorBrandProfileInputSchema,
} from "./contracts/creator-brand-profile.contract";
import { creatorWorkspaceActionsForRole } from "../creator-settings/team/creator-team.policy";
const empty = () => ({
  headline: null,
  commercialBio: null,
  primaryNicheIds: [],
  creatorArchetypeIds: [],
  archetypeState: "UNCONFIGURED",
  voiceDescriptorIds: [],
  voiceDescription: null,
  visualStyleDescriptors: [],
  palette: null,
  languages: [],
});
describe("Creator Brand P1 service/controller/static boundary", () => {
  it("canonical avatar projection excludes credentials, signed references and unsafe schemes", () => {
    expect(projectCreatorBrandAvatar("https://example.test/avatar.png")).toBe(
      "https://example.test/avatar.png",
    );
    for (const value of [
      "javascript:untrusted",
      "https://user:password@example.test/avatar",
      "https://example.test/avatar?sig=synthetic",
      "https://example.test/avatar?X-Amz-Signature=synthetic",
      "https://example.test/avatar?access_token=synthetic",
      null,
    ])
      expect(projectCreatorBrandAvatar(value)).toBeNull();
  });
  it.each(["OWNER", "MANAGER", "ASSISTANT"] as const)(
    "canonical %s Team action matches frozen P0 policy",
    (role) => {
      for (const [action, allowed] of Object.entries(
        CREATOR_BRAND_ROLE_POLICY[role],
      ))
        expect(
          creatorWorkspaceActionsForRole(role).includes(
            action as "CREATOR_BRAND_READ",
          ),
        ).toBe(allowed);
    },
  );
  it("strict manual input excludes suggestion/projection/subject claims", () => {
    const command = {
      intent: "MANUAL",
      expectedRevision: 0,
      idempotencyKey: randomUUID(),
      values: empty(),
    };
    expect(CreatorBrandManualRequestSchema.safeParse(command).success).toBe(
      true,
    );
    for (const property of [
      "origin",
      "suggestionReference",
      "workspaceId",
      "creatorProfileId",
      "name",
      "avatar",
      "handle",
    ])
      expect(
        CreatorBrandManualRequestSchema.safeParse({
          ...command,
          [property]: "untrusted",
        }).success,
      ).toBe(false);
    expect(
      CreatorBrandManualRequestSchema.safeParse({
        ...command,
        intent: "USE_SUGGESTION",
      }).success,
    ).toBe(false);
  });
  it("invalid mutation never calls repository and does not echo input", async () => {
    const mutate = vi.fn();
    const service = new CreatorBrandService({
      mutate,
    } as unknown as CreatorBrandRepository);
    const user = {
      id: randomUUID(),
      email: "synthetic@example.test",
      role: UserRole.CREATOR,
      name: null,
      organizationId: null,
    };
    await expect(
      service.mutate(user, { secret: "untrusted-data" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mutate).not.toHaveBeenCalled();
  });
  it("versioned projection is manual first, excludes internal DB identity", async () => {
    const data = {
      actor: {
        actorRole: "OWNER",
        allowedActions: creatorWorkspaceActionsForRole("OWNER"),
      },
      revision: 1,
      values: CreatorBrandProfileInputSchema.parse(empty()),
      identity: {
        creatorName: "Canonical",
        avatarImageReference: null,
        primaryInstagramHandle: null,
      },
      internalSecret: "must-not-project",
    };
    const read = vi.fn().mockResolvedValue(data);
    const mutate = vi.fn().mockResolvedValue(data);
    const service = new CreatorBrandService({
      read,
      mutate,
    } as unknown as CreatorBrandRepository);
    const user = {
      id: randomUUID(),
      email: "synthetic@example.test",
      role: UserRole.CREATOR,
      name: null,
      organizationId: null,
    };
    const response = await service.read(user);
    expect(response).toMatchObject({
      contractVersion: "creator-brand-v0.1",
      currentRevision: 1,
      context: { manualFirst: true, sourceIndependent: true },
      suggestions: { state: "UNAVAILABLE", autoApply: false },
    });
    expect(JSON.stringify(response)).not.toContain("must-not-project");
    const controller = new CreatorBrandController(service);
    const request = { user } as Parameters<CreatorBrandController["read"]>[0];
    expect(await controller.read(request)).toEqual(response);
    expect(
      await controller.mutate(request, {
        intent: "MANUAL",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
        values: empty(),
      }),
    ).toEqual(response);
  });
  it("source/current/Campaign/history writers are absent; guarded manual routes only", () => {
    const source = readFileSync(
      "src/features/creator-brand/creator-brand.repository.ts",
      "utf8",
    );
    expect(source).not.toMatch(
      /(?:intelligenceCurrent|intelligenceObject|creatorContent|uceApplication|collaboration|creatorSocialIntegration)\.(?:create|update|delete|upsert)/u,
    );
    expect(source).not.toMatch(/decryptField|\.acquire\(|fetch\(/u);
    const controller = readFileSync(
      "src/features/creator-brand/creator-brand.controller.ts",
      "utf8",
    );
    expect(controller).toContain("@UseGuards(ThrottlerGuard, JwtAuthGuard)");
    expect(controller).toContain("api/v1/creator/brand");
    expect(controller).not.toMatch(
      /@Post|@Delete|@Patch|@Public|@Param|@Query/u,
    );
  });
});
