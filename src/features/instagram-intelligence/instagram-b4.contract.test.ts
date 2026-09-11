import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";

import { ContractBundleIntegrityVerifier } from "../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { ContractRuntimeRegistry } from "../brand-intelligence/contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../brand-intelligence/contracts/validation/semantic.validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { InstagramB4ConsumerController } from "./consumer/instagram-b4-consumer.controller";
import { INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY } from "./runtime/instagram-content-behavior.contract";

describe("Instagram Intelligence B4 admission and consumer controller", () => {
  it("admits only the exact 1.0 root contract without mutating generated bundles", () => {
    const registry = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      new SemanticValidator(),
    );
    registry.verifyAtRoot(
      `${process.cwd()}/src/features/brand-intelligence/generated/contract-bundles`,
    );
    const bundle = registry.getVerifiedBundle(
      INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY,
    );
    expect(bundle.manifest).toMatchObject({
      processorId: "instagram_content_behavior",
      processorVersion: "1.0",
      outputContractId: "instagram_content_behavior_output_contract",
      outputContractVersion: "1.0",
      ownedObjectSemanticIds: ["instagram_content_behavior"],
      ownedPathPatterns: [
        {
          objectSemanticId: "instagram_content_behavior",
          componentPathPattern: "$",
        },
      ],
    });
    expect(
      registry
        .registrations()
        .filter((entry) => entry.processorId === "instagram_content_behavior"),
    ).toHaveLength(1);
  });

  it("resolves the active Brand server-side and never accepts a Brand selector", async () => {
    const auth = {
      resolveBrandProfileId: vi.fn().mockResolvedValue("server-brand"),
    };
    const consumer = {
      read: vi.fn().mockResolvedValue({ contractVersion: "b4-proof-1.0" }),
    };
    const controller = new InstagramB4ConsumerController(
      auth as never,
      consumer as never,
    );
    const user = { id: "user", role: "BRAND", sessionId: "session" };
    await expect(controller.read({ user } as never)).resolves.toEqual({
      contractVersion: "b4-proof-1.0",
    });
    expect(auth.resolveBrandProfileId).toHaveBeenCalledWith(user);
    expect(consumer.read).toHaveBeenCalledWith("server-brand");
    expect(controller.read.length).toBe(1);
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      InstagramB4ConsumerController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });
});
