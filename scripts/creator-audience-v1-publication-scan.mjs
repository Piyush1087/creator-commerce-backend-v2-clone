import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
import assert from "node:assert/strict";

const root = path.resolve("..");
assert.equal(
  path.basename(root),
  "creator-audience-v1",
  "Exact task worktree root required",
);
assert.equal(path.basename(process.cwd()), "backend");
let targets = [];
for (const [repo, base] of [
  ["backend", "3504a3cc8f0dc684431b73046f5796f157708f68"],
  ["frontend", "e6e7ae8ea9f5f98f882f52230e4cae163bda1e89"],
  ["authority", "897026bb39e7390397b9fea48a696ee488c31a4c"],
]) {
  const cwd = path.join(root, repo);
  const git = (args) =>
    cp
      .execFileSync("git", args, { cwd, encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean);
  targets.push(
    ...[
      ...git(["diff", base, "--name-only"]),
      ...git(["ls-files", "--others", "--exclude-standard"]),
    ].map((name) => path.join(cwd, name)),
  );
  assert.ok(
    !git(["ls-files"]).some(
      (name) =>
        /(^|\/)\.env(\.|$)/.test(name) && !name.endsWith(".env.example"),
    ),
    "Tracked runtime configuration prohibited",
  );
}
for (const dir of fs.readdirSync(path.join(root, "evidence"))) {
  const full = path.join(root, "evidence", dir);
  if (fs.statSync(full).isDirectory())
    targets.push(...fs.readdirSync(full).map((name) => path.join(full, name)));
}
const values = [
  "JWT_SECRET",
  "AUTH_OTP_PEPPER",
  "SETTINGS_FIELD_ENCRYPTION_KEY",
  "CREATOR_AUDIENCE_V1_FIXTURE_PASSWORD",
]
  .map((key) => process.env[key])
  .filter(Boolean);
assert.equal(
  values.length,
  4,
  "Local non-secret names must be configured; values never reported",
);
values.push(decodeURIComponent(new URL(process.env.DATABASE_URL).password));
const failures = [];
for (const file of new Set(targets)) {
  const bytes = fs.readFileSync(file);
  if (values.some((value) => bytes.includes(Buffer.from(value))))
    failures.push({
      path: path.relative(root, file),
      category: "LOCAL_SYNTHETIC_SECRET",
    });
  if (
    /\.env($|\.)|storage.?state|cookie|\.mp4$|\.jpg$|\.wav$|runtime.*\.log$/.test(
      path.basename(file),
    )
  )
    failures.push({
      path: path.relative(root, file),
      category: "FORBIDDEN_ARTIFACT",
    });
  if (
    !file.endsWith(".png") &&
    /-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|https?:\/\/[^\s]+[?&](?:sig|signature|access_token)=[A-Za-z0-9]{16}/.test(
      bytes.toString("utf8"),
    )
  )
    failures.push({
      path: path.relative(root, file),
      category: "HIGH_CONFIDENCE_SECRET_OR_LOCATOR",
    });
}
console.log(
  JSON.stringify({
    gate: "P4_PUBLICATION_AND_EVIDENCE_SCAN",
    files: new Set(targets).size,
    result: failures.length ? "FAIL" : "PASS",
    failures,
    trackedEnv: "NONE",
    browserStorageState: "NONE",
    rawMedia: "NONE",
    values: "NOT_REPORTED",
  }),
);
if (failures.length) process.exit(1);
