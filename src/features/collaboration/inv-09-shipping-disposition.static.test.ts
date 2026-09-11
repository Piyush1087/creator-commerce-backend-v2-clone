import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GoneException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { CollaborationCreatorProfileService } from "./services/collaboration-creator-profile.service";
import type { PrismaService } from "../../prisma/prisma.service";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("INV-09 leftover collab shipping vs C-05 contact", () => {
  it("retires leftover HTTP shipping writes as Gone (Settings owns contact)", () => {
    const controller = read(
      "src/features/collaboration/collaboration.controller.ts",
    );
    expect(controller).toContain('@Post("creator/shipping-address")');
    expect(controller).toContain(
      'throw new GoneException("Use Creator Settings contact destination")',
    );
  });

  it("fail-closes the leftover service writer before Prisma", async () => {
    const service = new CollaborationCreatorProfileService(
      {} as PrismaService,
    );
    await expect(
      service.upsertShippingAddress(
        {
          id: "user-1",
          email: "c@example.com",
          name: null,
          role: UserRole.CREATOR,
          organizationId: null,
        },
        {
          recipient_name: "A",
          address_line_1: "1",
          city: "Mumbai",
          postal_code: "400001",
        } as never,
      ),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it("does not let C-04 fulfillment consume CreatorShippingAddress", () => {
    const fulfillment = read(
      "src/features/collaboration/services/collaboration-fulfillment.service.ts",
    );
    expect(fulfillment).not.toContain("CreatorShippingAddress");
    expect(fulfillment).not.toContain("creatorShippingAddress");
  });
});
