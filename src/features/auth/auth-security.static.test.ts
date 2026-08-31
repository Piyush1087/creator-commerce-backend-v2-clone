import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function runtimeTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return runtimeTypeScriptFiles(path);
    if (!path.endsWith(".ts") || path.endsWith(".test.ts")) return [];
    return [path];
  });
}

describe("BS-12 runtime backdoor reconciliation", () => {
  const project = resolve(__dirname, "../../..");
  const sources = runtimeTypeScriptFiles(join(project, "src"));
  const deployment = readFileSync(join(project, "sst.config.ts"), "utf8");
  const environmentExample = readFileSync(
    join(project, ".env.example"),
    "utf8",
  );

  it("contains no fixed six-digit legacy authentication bypass", () => {
    const legacyFixedCode = ["123", "456"].join("");
    const offenders = sources.filter((file) =>
      readFileSync(file, "utf8").includes(legacyFixedCode),
    );
    expect(offenders).toEqual([]);
    expect(`${deployment}\n${environmentExample}`).not.toContain(
      legacyFixedCode,
    );
  });

  it("contains no deterministic JWT signing fallback", () => {
    expect(deployment).not.toMatch(/JWT_SECRET[^\n]+\?\?[^\n]+placeholder/i);
    expect(deployment).toContain("requiredEnv(`JWT_SECRET_${authSuffix}`)");
  });

  it("contains no deployable legacy fixed-OTP feature flags", () => {
    const deployableConfiguration = `${deployment}\n${environmentExample}`;
    expect(deployableConfiguration).not.toContain(
      "CREATOR_VERIFICATION_USE_REAL_OTP",
    );
    expect(deployableConfiguration).not.toContain(
      "BRAND_VERIFICATION_USE_REAL_OTP",
    );
    expect(deployableConfiguration).not.toMatch(/static\/stub OTP/i);
  });

  it("uses official Google verification and server-backed sid validation", () => {
    const google = readFileSync(
      join(project, "src/features/auth/google-auth.service.ts"),
      "utf8",
    );
    const strategy = readFileSync(
      join(project, "src/features/auth/jwt.strategy.ts"),
      "utf8",
    );
    expect(google).toContain("verifyIdToken");
    expect(google).not.toContain("oauth2.googleapis.com/tokeninfo");
    expect(strategy).toContain(
      "this.sessions.validate(payload.sub, payload.sid)",
    );
  });
});
