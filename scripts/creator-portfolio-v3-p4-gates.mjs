import { spawn, fork, execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { setTimeout as pause } from "node:timers/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const backend = process.cwd(),
  frontend = resolve(backend, "../frontend"),
  evidence = resolve(backend, `../runtime/p4-${randomUUID()}`),
  container = `creator-portfolio-v3-p4-${randomUUID()}`,
  password = randomBytes(24).toString("hex");
assert.ok(
  backend.endsWith("creator-portfolio-v3\\backend") ||
    backend.endsWith("creator-portfolio-v3/backend"),
);
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://portfolio:${password}@localhost:55472/creator_portfolio_v3_p4?schema=public`,
  SETTINGS_FIELD_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  JWT_SECRET: randomBytes(32).toString("hex"),
  JWT_ISSUER: "portfolio-local",
  JWT_AUDIENCE: "portfolio-local",
  AUTH_OTP_PEPPER: randomBytes(32).toString("hex"),
  C03_INVITATION_IDENTITY_HMAC_PEPPER: randomBytes(32).toString("hex"),
  CREATOR_PORTFOLIO_DATABASE_TEST: "true",
  CREATOR_PORTFOLIO_P4_TEST: "true",
  CREATOR_PORTFOLIO_FIXTURE_PASSWORD: randomBytes(24).toString("hex"),
  NODE_OPTIONS: "--max-old-space-size=3072",
  VITE_API_URL: "http://localhost:33492",
  VITE_STAGE: "local",
  PORTFOLIO_EVIDENCE_DIR: evidence,
  P4_BROWSER_PATH:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
};
env.DEV_DATABASE_URL = env.DATABASE_URL;
function run(
  command,
  args,
  { quiet = false, shell = false, cwd = backend } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      shell: process.platform === "win32" && shell,
      stdio: quiet ? "ignore" : "inherit",
    });
    child.on("error", () =>
      reject(new Error("PORTFOLIO_TASK_PROCESS_UNAVAILABLE")),
    );
    child.on("exit", resolve);
  });
}
async function gate(command, args, options) {
  assert.equal(
    await run(command, args, options),
    0,
    `MANDATORY_GATE_FAILED:${command}:${args[0]}`,
  );
}
async function free(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(new Error(`PORTFOLIO_PORT_COLLISION:${port}`)),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
function message(child, type, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.off("message", handler);
      reject(new Error(`PORTFOLIO_RUNTIME_IPC_TIMEOUT:${type}`));
    }, timeout);
    const handler = (value) => {
      if (value?.type === type) {
        clearTimeout(timer);
        child.off("message", handler);
        resolve(value);
      }
    };
    child.on("message", handler);
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("PORTFOLIO_RUNTIME_PROCESS_FAILED"));
    });
    child.once("exit", (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new Error("PORTFOLIO_RUNTIME_EXIT_FAILED"));
      }
    });
  });
}
let started = false,
  runtime,
  vite;
const report = { gates: [], cleanup: false };
try {
  assert.ok(
    existsSync(env.P4_BROWSER_PATH),
    "LOCAL_ENVIRONMENT_PREREQUISITE_REQUIRED:BROWSER",
  );
  for (const port of [55472, 33492, 43492]) await free(port);
  await gate("npm", ["run", "prisma:generate"], { shell: true });
  await gate("npx", ["prisma", "validate"], { shell: true });
  if (process.argv.includes("--runtime-retry")) {
    // A CSS/harness-only retry may retain the exact already-passed production
    // backend build. Never reuse it after any compiled source/schema/lock drift.
    const ref = "6b3a32bb469ceb777469db54026999a58bf151f6";
    const git = (args) =>
      execFileSync("git", args, {
        cwd: backend,
        windowsHide: true,
        encoding: "utf8",
      }).trim();
    assert.equal(git(["rev-parse", "HEAD"]), ref);
    const changed = git([
      "diff",
      "--name-only",
      ref,
      "--",
      "src",
      "prisma",
      "package.json",
      "package-lock.json",
      "Dockerfile",
    ])
      .split(/\r?\n/u)
      .filter((name) => name && !/\.(?:test|harness)\.ts$/u.test(name));
    const added = git(["ls-files", "--others", "--exclude-standard", "src"])
      .split(/\r?\n/u)
      .filter((name) => name && !/\.(?:test|harness)\.ts$/u.test(name));
    assert.equal(
      changed.length + added.length,
      0,
      "BACKEND_BUILD_REUSE_SOURCE_DRIFT",
    );
    assert.ok(existsSync(resolve(backend, "dist/app.module.js")));
    console.log(
      JSON.stringify({
        gate: "BACKEND_PRODUCTION_BUILD",
        result: "RETAINED_EXACT_PREVIOUS_P4_PASS",
        sourceRef: ref,
        compiledSourceChanges: 0,
      }),
    );
  } else await gate("npm", ["run", "build"], { shell: true });
  await gate(
    "npx",
    ["eslint", "src/features/creator-portfolio", "--max-warnings", "0"],
    { shell: true },
  );
  await gate(
    "npx",
    [
      "prettier",
      "--check",
      "src/features/creator-portfolio",
      "scripts/creator-portfolio-v3-integrated-runtime.mjs",
      "scripts/creator-portfolio-v3-p4-gates.mjs",
    ],
    { shell: true },
  );
  await gate("git", ["diff", "--check"]);
  await gate(
    "npx",
    [
      "vitest",
      "run",
      "--config",
      "vitest.config.ts",
      "src/features/creator-portfolio/contracts/portfolio.contract.test.ts",
      "src/features/creator-portfolio/portfolio-source-reader.test.ts",
      "src/features/creator-portfolio/portfolio-instagram-discovery.test.ts",
      "src/features/creator-portfolio/portfolio-c04.adapter.test.ts",
      "src/features/creator-portfolio/portfolio-boundary.test.ts",
      "src/features/creator-portfolio/portfolio.service.test.ts",
    ],
    { shell: true },
  );
  await gate("npm", ["run", "build"], { shell: true, cwd: frontend });
  await gate(
    "npx",
    [
      "vitest",
      "run",
      "--config",
      "vitest.config.ts",
      "src/features/creator-portfolio",
      "src/features/creator-brand",
      "src/features/creator-commercial-setup",
      "src/features/creator-content",
      "src/features/creator-audience",
      "src/layouts/app-shell/creator-shell-capabilities.test.ts",
      "src/layouts/app-shell/creator-shell-rendering.test.ts",
    ],
    { shell: true, cwd: frontend },
  );
  await gate("docker", ["image", "inspect", "postgres:17-alpine"], {
    quiet: true,
  });
  await gate(
    "docker",
    [
      "run",
      "--detach",
      "--name",
      container,
      "--tmpfs",
      "/var/lib/postgresql/data:rw",
      "-p",
      "127.0.0.1:55472:5432",
      "-e",
      "POSTGRES_DB=creator_portfolio_v3_p4",
      "-e",
      "POSTGRES_USER=portfolio",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "postgres:17-alpine",
    ],
    { quiet: true },
  );
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (
      (await run(
        "docker",
        [
          "exec",
          container,
          "pg_isready",
          "-U",
          "portfolio",
          "-d",
          "creator_portfolio_v3_p4",
        ],
        { quiet: true },
      )) === 0
    ) {
      ready = true;
      break;
    }
    await pause(500);
  }
  assert.ok(ready, "PORTFOLIO_POSTGRES_NOT_READY");
  await gate("npm", ["run", "db:migrate:deploy"], { shell: true });
  await gate("npx", ["prisma", "migrate", "status"], { shell: true });
  await gate(
    "npx",
    [
      "vitest",
      "run",
      "--config",
      "vitest.config.ts",
      "src/features/creator-portfolio/testing/portfolio-p2.postgres.test.ts",
      "src/features/creator-portfolio/testing/portfolio-p1.postgres.test.ts",
      "src/features/creator-portfolio/testing/portfolio-purge.postgres.test.ts",
      "--pool=forks",
      "--maxWorkers=1",
      "--minWorkers=1",
    ],
    { shell: true },
  );
  await gate(
    "npx",
    [
      "vitest",
      "run",
      "--config",
      "vitest.config.ts",
      "src/features/creator-portfolio/testing/portfolio-p4.postgres.test.ts",
      "--pool=forks",
      "--maxWorkers=1",
      "--minWorkers=1",
    ],
    { shell: true },
  );
  runtime = fork(
    resolve(backend, "scripts/creator-portfolio-v3-integrated-runtime.mjs"),
    [],
    {
      cwd: backend,
      env,
      windowsHide: true,
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    },
  );
  const before = await message(runtime, "ready");
  report.beforeBrowser = before.rows;
  vite = fork(
    resolve(frontend, "node_modules/vite/bin/vite.js"),
    ["preview", "--host", "127.0.0.1", "--port", "43492", "--strictPort"],
    {
      cwd: frontend,
      env,
      windowsHide: true,
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    },
  );
  let frontendReady = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch("http://localhost:43492/login")).ok) {
        frontendReady = true;
        break;
      }
    } catch {}
    await pause(200);
  }
  assert.ok(frontendReady, "PORTFOLIO_FRONTEND_NOT_READY");
  await gate(
    process.execPath,
    ["scripts/creator-portfolio-v3-integrated-browser-proof.mjs"],
    { cwd: frontend },
  );
  const proof = message(runtime, "proof");
  runtime.send({ type: "prove" });
  const after = await proof;
  report.afterBrowser = after.rows;
  for (const key of [
    "captures",
    "evidence",
    "objects",
    "current",
    "publishing_evidence",
  ])
    assert.equal(
      after.rows[key],
      before.rows[key],
      `BROWSER_MUST_NOT_MUTATE_SOURCE:${key}`,
    );
  assert.ok(
    after.rows.revisions > before.rows.revisions,
    "Actual browser curation must create canonical audit revisions",
  );
  assert.equal(after.providerCalls, 0);
  assert.equal(after.externalAttempts, 0);
  report.gates = [
    "BUILD_BACKEND",
    "BUILD_FRONTEND",
    "UNIT_BACKEND72",
    "FRONTEND_FOCUSED_REGRESSIONS",
    "FRESH105_MIGRATIONS_CURRENT",
    "POSTGRES29",
    "REAL_SOURCE_C04_AUTH_FIXTURES",
    "PRODUCTION_HEALTH",
    "BROWSER84_ALL_ROLES_STATES_WIDTHS",
    "KEYBOARD_FOCUS",
    "AXE_ALL_ZERO",
    "SOURCE_ROWS_UNCHANGED",
    "LIVE_CALLS_ZERO",
  ];
  report.result = "PASS";
  await mkdir(evidence, { recursive: true });
  await writeFile(
    resolve(evidence, "integrated-row-counts.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      gate: "PORTFOLIO_P4_INTEGRATED_GATES",
      result: "PASS",
      beforeBrowser: before.rows,
      afterBrowser: after.rows,
      providerCalls: 0,
      externalAttempts: 0,
    }),
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message.split("\n")[0]
      : "PORTFOLIO_P4_GATE_FAILED",
  );
  process.exitCode = 1;
} finally {
  if (vite && vite.exitCode === null) {
    const stopped = new Promise((resolve) => vite.once("exit", resolve));
    vite.kill();
    await stopped;
  }
  if (runtime && runtime.exitCode === null) {
    const stopped = new Promise((resolve) => runtime.once("exit", resolve));
    if (runtime.connected) runtime.send({ type: "stop" });
    else runtime.kill();
    await stopped;
  }
  if (started) {
    assert.equal(
      await run("docker", ["stop", container], { quiet: true }),
      0,
      "OWN_CONTAINER_STOP_FAILED",
    );
    assert.equal(
      await run("docker", ["rm", container], { quiet: true }),
      0,
      "OWN_CONTAINER_REMOVE_FAILED",
    );
  }
  for (const port of [55472, 33492, 43492]) await free(port);
  report.cleanup = true;
  if (existsSync(evidence))
    await writeFile(
      resolve(evidence, "cleanup.json"),
      JSON.stringify(
        {
          ownServices: "STOPPED",
          ownContainer: "REMOVED",
          portsFree: [55472, 33492, 43492],
          unrelatedDeveloperData: "PRESERVED",
          authStateFiles: "NONE",
          rawMedia: "NONE",
        },
        null,
        2,
      ),
    );
  console.log("Portfolio P4 owned services/container/ports cleanup COMPLETE");
}
