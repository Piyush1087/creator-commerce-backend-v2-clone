/**
 * Ping Gemini + OpenAI with keys from repo `.env`. Prints fingerprints and
 * HTTP/API errors only — never the secret values.
 *
 *   node scripts/test-provider-keys.mjs
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { GoogleGenAI } from "@google/genai";

config({ path: resolve(process.cwd(), ".env"), override: true });

const GEMINI_MODEL = process.env.GATEKEEPER_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const OPENAI_MODEL = process.env.GATEKEEPER_OPENAI_MODEL_ID?.trim() || "gpt-4o";

function fingerprint(name, value) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return `${name}: MISSING`;
  return `${name}: present len=${trimmed.length} suffix=${trimmed.slice(-4)}`;
}

function sanitize(raw) {
  return String(raw)
    .replace(/sk-[a-zA-Z0-9_\-]+/g, "sk-[redacted]")
    .replace(/AIza[0-9A-Za-z_\-]+/g, "AIza[redacted]")
    .replace(/\bAQ\.[0-9A-Za-z_\-]+/g, "AQ.[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

function failDetail(error) {
  const status = error?.status ?? error?.statusCode ?? error?.error?.code ?? "";
  const name = error?.name ?? "Error";
  const message =
    error?.error?.message || error?.message || String(error);
  return `${name} ${status} ${sanitize(message)}`.trim();
}

async function testGemini(apiKey) {
  const client = new GoogleGenAI({ apiKey });
  const started = Date.now();
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: "Reply with the single word ok.",
  });
  const text = (response.text ?? "").trim().slice(0, 80);
  return `OK ${Date.now() - started}ms model=${GEMINI_MODEL} text=${JSON.stringify(text)}`;
}

async function testGeminiGatekeeperShape(apiKey) {
  const client = new GoogleGenAI({ apiKey });
  const started = Date.now();
  await client.interactions.create({
    model: GEMINI_MODEL,
    input: "Reply with the single word ok.",
    tools: [{ type: "url_context" }, { type: "google_search" }],
    store: false,
  });
  return `OK ${Date.now() - started}ms model=${GEMINI_MODEL} tools=url_context+google_search`;
}

async function testOpenAiModels(apiKey) {
  const started = Date.now();
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${sanitize(body)}`);
  }
  return `OK ${Date.now() - started}ms GET /v1/models`;
}

async function testOpenAiResponses(apiKey) {
  const started = Date.now();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      store: false,
      input: "Reply with the single word ok.",
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${sanitize(body)}`);
  }
  return `OK ${Date.now() - started}ms POST /v1/responses model=${OPENAI_MODEL}`;
}

async function run(label, fn) {
  try {
    const result = await fn();
    console.log(`  PASS ${label}: ${result}`);
  } catch (error) {
    console.log(`  FAIL ${label}: ${failDetail(error)}`);
  }
}

const geminiKey = process.env.GEMINI_API_KEY ?? "";
const openaiKey = process.env.OPENAI_API_KEY ?? "";

console.log("Provider key probe (secrets not printed)");
console.log(fingerprint("GEMINI_API_KEY", geminiKey));
console.log(fingerprint("OPENAI_API_KEY", openaiKey));
console.log(`models: gemini=${GEMINI_MODEL} openai=${OPENAI_MODEL}`);
console.log("");

if (!geminiKey.trim()) {
  console.log("  SKIP Gemini: GEMINI_API_KEY missing");
} else {
  await run("Gemini generateContent", () => testGemini(geminiKey));
  await run("Gemini Gatekeeper interactions+tools", () =>
    testGeminiGatekeeperShape(geminiKey),
  );
}

if (!openaiKey.trim()) {
  console.log("  SKIP OpenAI: OPENAI_API_KEY missing");
} else {
  await run("OpenAI list models", () => testOpenAiModels(openaiKey));
  await run("OpenAI Responses (Gatekeeper endpoint)", () =>
    testOpenAiResponses(openaiKey),
  );
}
