import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function productionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      return entry.name === "testing" ? [] : productionFiles(path);
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}
describe("Portfolio amended Settings and media ownership", () => {
  it("preserves the complete accepted internal Creator purge implementation", () => {
    const path =
      "src/features/data-extraction/evidence/ownership/intelligence-owner-scope.repository.ts";
    expect(
      execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim(),
    ).toBe("1ae5c276c98d2c66a39bf464cd5453350533bdcb");
  });
  it("introduces no Settings/source deletion route, purge call, provider/model dispatch or media persistence", () => {
    for (const path of productionFiles("src/features/creator-portfolio")) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(
        /purgeCreatorInstagram\s*\(|@Delete\s*\(|\.acquireLocator\s*\(|\.download\s*\(|\.observe\s*\(|\.readInventory\s*\(|base64|thumbnailUrl/u,
      );
    }
  });
});
