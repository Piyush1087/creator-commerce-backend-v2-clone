import { resolve } from "node:path";

import { FINAL_GATE_DB_PREFIX, FINAL_GATE_MARKER } from "./contracts";

export function requireDisposableFinalGateDatabase(): URL {
  if (process.env[FINAL_GATE_MARKER] !== "true") {
    throw new Error(`${FINAL_GATE_MARKER}=true is required`);
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !database.startsWith(FINAL_GATE_DB_PREFIX)
  ) {
    throw new Error(
      `Final Gate scripts require a loopback ${FINAL_GATE_DB_PREFIX}* database`,
    );
  }
  return url;
}

export function requireRunArtifactPath(name: string): string {
  const root = process.env.FINAL_GATE_ARTIFACT_DIR;
  if (!root) throw new Error("FINAL_GATE_ARTIFACT_DIR is required");
  return resolve(root, name);
}
