import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const boundary = resolve(
  "scripts/canonical-reconciliation/final-gate/runtime-boundary.cjs",
);
const temporaryRoots: string[] = [];

function run(script: string) {
  const artifactRoot = mkdtempSync(join(tmpdir(), "final-gate-boundary-"));
  temporaryRoots.push(artifactRoot);
  const result = spawnSync(process.execPath, ["--require", boundary, "-e", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      CANONICAL_FINAL_GATE_DISPOSABLE_RUN: "true",
      FINAL_GATE_ARTIFACT_DIR: artifactRoot,
      FINAL_GATE_RUNTIME_ROLE: "backend",
    },
  });
  return { artifactRoot, result };
}

function records(root: string, name: string) {
  try {
    return readFileSync(join(root, name), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true });
});

describe("final-gate validation runtime boundary", () => {
  it("replaces Postmark with deterministic sanitized local delivery", () => {
    const recipient = "sensitive-recipient@example.test";
    const { artifactRoot, result } = run(`
      const { ServerClient } = require("postmark");
      new ServerClient("not-a-real-token").sendEmailWithTemplate({
        To: ${JSON.stringify(recipient)},
        TemplateId: 4,
        TemplateModel: { event_type: "campaigns.application_received" }
      }).then((response) => process.stdout.write(response.MessageID));
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("final-gate-mail-000001");
    const deliveries = records(artifactRoot, "validation-mail-adapter.ndjson");
    expect(deliveries).toEqual([
      {
        classification: "campaigns.application_received",
        invocation: 1,
        messageId: "final-gate-mail-000001",
        method: "sendEmailWithTemplate",
        recipientHash: createHash("sha256").update(recipient).digest("hex"),
        templateId: 4,
      },
    ]);
    expect(JSON.stringify(deliveries)).not.toContain(recipient);
    expect(records(artifactRoot, "backend-egress-blocked.ndjson")).toEqual([]);
  });

  it("permits loopback and rejects a non-loopback fetch before networking", () => {
    const { artifactRoot, result } = run(`
      const http = require("node:http");
      const request = http.get("http://127.0.0.1:9", () => {});
      request.on("error", () => {
        fetch("https://example.com/private/path")
          .catch((error) => process.stdout.write(error.message));
      });
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("FINAL_GATE_EGRESS_BLOCKED:fetch:example.com");
    expect(records(artifactRoot, "backend-egress-blocked.ndjson")).toEqual([
      {
        classification: "NON_LOOPBACK_NETWORK",
        host: "example.com",
        operation: "GET",
        protocol: "fetch",
      },
    ]);
  });

  it("classifies a blocked Postmark socket target as a provider attempt", () => {
    const { artifactRoot, result } = run(`
      const https = require("node:https");
      try { https.request("https://api.postmarkapp.com/email"); }
      catch (error) { process.stdout.write(error.message); }
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      "FINAL_GATE_EGRESS_BLOCKED:https::api.postmarkapp.com",
    );
    expect(records(artifactRoot, "backend-egress-blocked.ndjson")).toEqual([
      {
        classification: "PROVIDER",
        host: "api.postmarkapp.com",
        operation: "request",
        protocol: "https:",
      },
    ]);
  });
});
