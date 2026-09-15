import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { setTimeout as pause } from "node:timers/promises";
const container = `creator-portfolio-v3-p2-${randomUUID()}`;
const password = randomBytes(24).toString("hex");
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://portfolio:${password}@localhost:55472/creator_portfolio_v3_p2?schema=public`,
  SETTINGS_FIELD_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  JWT_SECRET: randomBytes(32).toString("hex"),
  JWT_ISSUER: "portfolio-local",
  JWT_AUDIENCE: "portfolio-local",
  AUTH_OTP_PEPPER: randomBytes(32).toString("hex"),
  CREATOR_PORTFOLIO_DATABASE_TEST: "true",
  NODE_OPTIONS: "--max-old-space-size=3072",
};
env.DEV_DATABASE_URL = env.DATABASE_URL;
function run(command, args, { quiet = false, shell = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      windowsHide: true,
      shell: process.platform === "win32" && shell,
      stdio: quiet ? "ignore" : "inherit",
    });
    child.on("error", () =>
      reject(new Error("PORTFOLIO_TASK_PROCESS_UNAVAILABLE")),
    );
    child.on("exit", (code) => resolve(code));
  });
}
async function gate(command, args, options) {
  if ((await run(command, args, options)) !== 0)
    throw new Error(`PORTFOLIO_MANDATORY_GATE_FAILED:${command}:${args[0]}`);
}
let started = false;
try {
  // Build precedes every boot/API test: Nest clears dist while compiling.
  await gate("npm", ["run", "prisma:generate"], { shell: true });
  await gate("npx", ["prisma", "validate"], { shell: true });
  await gate("npm", ["run", "build"], { shell: true });
  await gate("npx", ["eslint", "src/features/creator-portfolio"], {
    shell: true,
  });
  await gate(
    "npx",
    [
      "prettier",
      "--check",
      "src/features/creator-portfolio",
      "scripts/creator-portfolio-v3-health-proof.mjs",
      "scripts/creator-portfolio-v3-p2-gates.mjs",
    ],
    { shell: true },
  );
  await gate("git", ["diff", "--check"]);
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(new Error("PORTFOLIO_TASK_PORT_COLLISION")),
    );
    server.listen(55472, "127.0.0.1", () => server.close(resolve));
  });
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
      "POSTGRES_DB=creator_portfolio_v3_p2",
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
          "creator_portfolio_v3_p2",
        ],
        { quiet: true },
      )) === 0
    ) {
      ready = true;
      break;
    }
    await pause(500);
  }
  if (!ready) throw new Error("PORTFOLIO_POSTGRES_NOT_READY");
  await gate("npm", ["run", "db:migrate:deploy"], { shell: true });
  await gate("npx", ["prisma", "migrate", "status"], { shell: true });
  await gate(process.execPath, [
    "scripts/creator-portfolio-v3-health-proof.mjs",
  ]);
  await gate(
    "npx",
    [
      "vitest",
      "run",
      "src/features/creator-portfolio/testing/portfolio-p2.postgres.test.ts",
      "src/features/creator-portfolio/testing/portfolio-p1.postgres.test.ts",
      "src/features/creator-portfolio/testing/portfolio-purge.postgres.test.ts",
      "--pool=forks",
      "--maxWorkers=1",
      "--minWorkers=1",
    ],
    { shell: true },
  );
  console.log(
    JSON.stringify({
      gate: "PORTFOLIO_P2_SEQUENTIAL_GATES",
      result: "PASS",
      configurationNames: [
        "DATABASE_URL",
        "DEV_DATABASE_URL",
        "SETTINGS_FIELD_ENCRYPTION_KEY",
        "JWT_SECRET",
        "JWT_ISSUER",
        "JWT_AUDIENCE",
        "AUTH_OTP_PEPPER",
      ],
      liveGraphCalls: 0,
      liveModelCalls: 0,
    }),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "PORTFOLIO_GATE_FAILED",
  );
  process.exitCode = 1;
} finally {
  if (started) {
    const stop = await run("docker", ["stop", container], { quiet: true });
    const remove = await run("docker", ["rm", container], { quiet: true });
    if (stop !== 0 || remove !== 0) {
      console.error("PORTFOLIO_TASK_CLEANUP_FAILED");
      process.exitCode = 1;
    }
  }
  console.log("Portfolio-owned P2 container/services cleanup COMPLETE");
}
