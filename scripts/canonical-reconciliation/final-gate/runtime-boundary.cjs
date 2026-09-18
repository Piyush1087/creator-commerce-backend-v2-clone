"use strict";

const crypto = require("node:crypto");
const dns = require("node:dns");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const Module = require("node:module");
const net = require("node:net");
const path = require("node:path");
const tls = require("node:tls");

const MARKER = "CANONICAL_FINAL_GATE_DISPOSABLE_RUN";
const enabled = process.env[MARKER] === "true";
const artifactRoot = process.env.FINAL_GATE_ARTIFACT_DIR;
const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const providerHostPattern =
  /(?:^|\.)(?:postmarkapp\.com|googleapis\.com|amazonaws\.com|facebook\.com|instagram\.com|meta\.com)$/i;

function requiredArtifactRoot() {
  if (!artifactRoot) throw new Error("FINAL_GATE_ARTIFACT_DIR is required");
  fs.mkdirSync(artifactRoot, { recursive: true });
  return artifactRoot;
}

function artifactPath(name) {
  return path.join(requiredArtifactRoot(), name);
}

function appendSanitized(name, value) {
  fs.appendFileSync(artifactPath(name), `${JSON.stringify(value)}\n`, "utf8");
}

function normalizeHost(value) {
  if (!value) return "localhost";
  const host = String(value).trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) return host.slice(1, -1);
  if (/^[^:]+:\d+$/.test(host)) return host.replace(/:\d+$/, "");
  return host;
}

function hostFromUrl(value, fallbackProtocol) {
  if (value instanceof URL) return normalizeHost(value.hostname);
  if (typeof value === "string") {
    try {
      return normalizeHost(new URL(value, `${fallbackProtocol}//localhost`).hostname);
    } catch {
      return normalizeHost(value);
    }
  }
  if (value && typeof value === "object") {
    if (value.socketPath || value.path?.startsWith?.("\\\\.\\pipe\\")) return null;
    if (value.href || value.url)
      return hostFromUrl(value.href || value.url, fallbackProtocol);
    return normalizeHost(value.hostname || value.host);
  }
  return "localhost";
}

function hostFromSocketArgs(args) {
  const first = args[0];
  if (typeof first === "string" && !/^\d+$/.test(first)) {
    if (first.startsWith("\\\\.\\pipe\\") || first.startsWith("/")) return null;
  }
  if (first && typeof first === "object") {
    if (first.path || first.socketPath) return null;
    return normalizeHost(first.host || first.hostname);
  }
  if (typeof args[1] === "string") return normalizeHost(args[1]);
  return "localhost";
}

function rejectExternal(host, protocol, operation) {
  if (host === null || allowedHosts.has(normalizeHost(host))) return;
  const normalized = normalizeHost(host);
  appendSanitized("backend-egress-blocked.ndjson", {
    classification: providerHostPattern.test(normalized)
      ? "PROVIDER"
      : "NON_LOOPBACK_NETWORK",
    host: normalized,
    operation,
    protocol,
  });
  throw new Error(`FINAL_GATE_EGRESS_BLOCKED:${protocol}:${normalized}`);
}

function installHttpGuard(moduleValue, protocol) {
  const request = moduleValue.request.bind(moduleValue);
  const get = moduleValue.get.bind(moduleValue);
  moduleValue.request = (...args) => {
    rejectExternal(hostFromUrl(args[0], protocol), protocol, "request");
    return request(...args);
  };
  moduleValue.get = (...args) => {
    rejectExternal(hostFromUrl(args[0], protocol), protocol, "get");
    return get(...args);
  };
}

function installSocketGuard() {
  const connect = net.connect.bind(net);
  const createConnection = net.createConnection.bind(net);
  const socketConnect = net.Socket.prototype.connect;
  const tlsConnect = tls.connect.bind(tls);
  net.connect = (...args) => {
    rejectExternal(hostFromSocketArgs(args), "tcp", "connect");
    return connect(...args);
  };
  net.createConnection = (...args) => {
    rejectExternal(hostFromSocketArgs(args), "tcp", "createConnection");
    return createConnection(...args);
  };
  net.Socket.prototype.connect = function (...args) {
    const target = Array.isArray(args[0]) ? args[0] : args;
    rejectExternal(hostFromSocketArgs(target), "tcp", "socket.connect");
    return socketConnect.apply(this, args);
  };
  tls.connect = (...args) => {
    rejectExternal(hostFromSocketArgs(args), "tls", "connect");
    return tlsConnect(...args);
  };
}

function installDnsGuard() {
  for (const name of [
    "lookup",
    "resolve",
    "resolve4",
    "resolve6",
    "resolveAny",
    "resolveCaa",
    "resolveCname",
    "resolveMx",
    "resolveNaptr",
    "resolveNs",
    "resolvePtr",
    "resolveSoa",
    "resolveSrv",
    "resolveTxt",
  ]) {
    if (typeof dns[name] !== "function") continue;
    const original = dns[name].bind(dns);
    dns[name] = (host, ...args) => {
      rejectExternal(normalizeHost(host), "dns", name);
      return original(host, ...args);
    };
    if (dns.promises && typeof dns.promises[name] === "function") {
      const promiseOriginal = dns.promises[name].bind(dns.promises);
      dns.promises[name] = (host, ...args) => {
        rejectExternal(normalizeHost(host), "dns", `promises.${name}`);
        return promiseOriginal(host, ...args);
      };
    }
  }
}

function installFetchGuard() {
  if (typeof globalThis.fetch !== "function") return;
  const fetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => {
    const target = typeof input === "string" || input instanceof URL ? input : input?.url;
    try {
      rejectExternal(hostFromUrl(target, "https:"), "fetch", init?.method || "GET");
    } catch (error) {
      return Promise.reject(error);
    }
    return fetch(input, init);
  };
}

let mailInvocationCount = 0;

function mailClassification(payload) {
  const model = payload?.TemplateModel;
  if (model && typeof model.event_type === "string") return model.event_type;
  if (model && Object.hasOwn(model, "otp")) return "AUTHENTICATION_OTP";
  if (model && Object.hasOwn(model, "reset_url")) return "PASSWORD_RESET";
  if (model && Object.hasOwn(model, "acceptance_url")) return "TEAM_INVITATION";
  return "UNCLASSIFIED_TEMPLATE";
}

function simulatedDelivery(method, payload) {
  mailInvocationCount += 1;
  const messageId = `final-gate-mail-${String(mailInvocationCount).padStart(6, "0")}`;
  appendSanitized("validation-mail-adapter.ndjson", {
    classification: mailClassification(payload),
    invocation: mailInvocationCount,
    messageId,
    method,
    recipientHash: crypto
      .createHash("sha256")
      .update(String(payload?.To || "").trim().toLowerCase())
      .digest("hex"),
    templateId: Number(payload?.TemplateId) || null,
  });
  return Promise.resolve({
    ErrorCode: 0,
    Message: "OK",
    MessageID: messageId,
    SubmittedAt: "2026-01-01T00:00:00.000Z",
    To: "validation-recipient",
  });
}

class ValidationPostmarkClient {
  sendEmail(payload) {
    return simulatedDelivery("sendEmail", payload);
  }

  sendEmailWithTemplate(payload) {
    return simulatedDelivery("sendEmailWithTemplate", payload);
  }

  sendEmailBatch(payloads) {
    return Promise.all(payloads.map((payload) => simulatedDelivery("sendEmailBatch", payload)));
  }

  sendEmailBatchWithTemplates(payloads) {
    return Promise.all(
      payloads.map((payload) => simulatedDelivery("sendEmailBatchWithTemplates", payload)),
    );
  }
}

function installModuleBoundary() {
  const load = Module._load;
  Module._load = function (request, parent, isMain) {
    const loaded = load.call(this, request, parent, isMain);
    if (request === "postmark")
      return { ...loaded, ServerClient: ValidationPostmarkClient };
    if (request === "undici") {
      const guarded = { ...loaded };
      for (const name of ["fetch", "request", "stream", "pipeline", "connect"]) {
        if (typeof loaded[name] !== "function") continue;
        guarded[name] = (target, ...args) => {
          rejectExternal(hostFromUrl(target, "https:"), "undici", name);
          return loaded[name](target, ...args);
        };
      }
      return guarded;
    }
    return loaded;
  };
}

function install() {
  if (!enabled) return;
  requiredArtifactRoot();
  installHttpGuard(http, "http:");
  installHttpGuard(https, "https:");
  installSocketGuard();
  installDnsGuard();
  installFetchGuard();
  installModuleBoundary();
  if (process.env.FINAL_GATE_RUNTIME_ROLE === "backend") {
    fs.writeFileSync(
      artifactPath("backend-runtime-boundary.json"),
      JSON.stringify(
        {
          allowedHosts: [...allowedHosts].sort(),
          egressGuard: "LOOPBACK_ONLY",
          mailAdapter: "POSTMARK_IN_PROCESS_DETERMINISTIC",
          mode: "FINAL_GATE_VALIDATION_ONLY",
        },
        null,
        2,
      ),
      "utf8",
    );
  }
}

install();

module.exports = { ValidationPostmarkClient, install };
