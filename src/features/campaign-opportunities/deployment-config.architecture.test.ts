import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("C03 deployment secret projection", () => {
  const config = readFileSync("sst.config.ts", "utf8");
  const example = readFileSync(".env.example", "utf8");
  it("selects PROD only for prod and requires the dedicated stage input", () => {
    expect(config).toContain(
      'const authSuffix = $app.stage === "prod" ? "PROD" : "DEV";',
    );
    expect(config).toMatch(
      /const C03_INVITATION_IDENTITY_HMAC_PEPPER = requiredEnv\(\s*`C03_INVITATION_IDENTITY_HMAC_PEPPER_\$\{authSuffix\}`\s*,?\s*\);/,
    );
  });
  it("projects only the canonical key to the ECS environment", () => {
    const environment = config
      .split("const apiEnvironment = {")[1]
      ?.split("};")[0];
    expect(environment).toMatch(
      /^\s*C03_INVITATION_IDENTITY_HMAC_PEPPER,\s*$/m,
    );
    expect(environment).not.toMatch(
      /C03_INVITATION_IDENTITY_HMAC_PEPPER_(DEV|PROD)/,
    );
    expect(config).toContain("environment: apiEnvironment");
    expect(config.match(/C03_INVITATION_IDENTITY_HMAC_PEPPER/g)).toHaveLength(
      3,
    );
  });
  it("documents placeholder-only direct and deployment inputs", () => {
    for (const suffix of ["", "_DEV", "_PROD"]) {
      expect(example).toMatch(
        new RegExp(
          `^C03_INVITATION_IDENTITY_HMAC_PEPPER${suffix}=replace-me\\r?$`,
          "m",
        ),
      );
    }
  });
});
