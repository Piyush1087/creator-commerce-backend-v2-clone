import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Creator Home ownership and persistence boundaries", () => {
  it("keeps Prisma business reads in owner-local ports", () => {
    const aggregation = readFileSync(
      resolve("src/features/creator-home/creator-home-aggregation.service.ts"),
      "utf8",
    );
    expect(aggregation).not.toContain("PrismaService");
    expect(aggregation).not.toMatch(/\.findMany\(|\.count\(/);
  });

  it("keeps every Home consumer port read-only", () => {
    const files = [
      "src/features/creator-settings/home/creator-settings-home-read.service.ts",
      "src/features/campaign-applications/application-home-read.service.ts",
      "src/features/collaboration/services/collaboration-home-read.service.ts",
      "src/features/notifications/services/creator-home-notification-read.service.ts",
    ];
    for (const file of files) {
      const source = readFileSync(resolve(file), "utf8");
      expect(source).not.toMatch(
        /\.(update|updateMany|create|createMany|upsert|delete|deleteMany)\(/,
      );
    }
  });

  it("adds no migration or Home persistence", () => {
    expect(
      readdirSync(resolve("prisma/migrations"), { withFileTypes: true }).filter(
        (entry) => entry.isDirectory(),
      ),
    ).toHaveLength(94);
    const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");
    expect(schema).not.toMatch(/model (Creator)?Home(Activity|Event|Cache)?\b/);
  });
});
