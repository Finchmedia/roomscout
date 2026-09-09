import { spawn } from "node:child_process";
import process from "node:process";

const DEPLOYMENT = "perceptive-antelope-445";
const SITE_ORIGIN = "https://perceptive-antelope-445.eu-west-1.convex.site";
const CALLBACK_URL = `${SITE_ORIGIN}/api/webhooks/agentmail`;
const CLIENT_ID = "roomscout-agentmail-perceptive-antelope-445-eu-west-1-convex-site-v1";
const EVENT_TYPES = [
  "message.received", "message.sent", "message.delivered", "message.bounced", "message.rejected", "message.complained",
];
const apply = process.argv.slice(2).includes("--apply");

function runConvex(args, input, stage) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["convex", ...args, "--deployment", DEPLOYMENT], {
      stdio: ["pipe", "pipe", "pipe"], env: process.env,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.resume();
    child.on("error", reject);
    const timeout = globalThis.setTimeout(() => child.kill("SIGTERM"), 30_000);
    child.on("close", (code) => {
      globalThis.clearTimeout(timeout);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`CONVEX_CLI_FAILED:${stage}:${code ?? "unknown"}`));
    });
    child.stdin.end(input);
  });
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function objectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
}

function sameEvents(actual) {
  return [...new Set(actual)].sort().join("\n") === [...EVENT_TYPES].sort().join("\n");
}

function sameStrings(left, right) {
  return [...new Set(left)].sort().join("\n") === [...new Set(right)].sort().join("\n");
}

function sameConfiguration(left, right) {
  return left && right && left.id === right.id && left.url === right.url && left.clientId === right.clientId &&
    left.enabled === right.enabled && sameStrings(left.events, right.events) &&
    sameStrings(left.inboxIds, right.inboxIds) && sameStrings(left.podIds, right.podIds);
}

function parseWebhook(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.webhook_id !== "string" || typeof value.url !== "string") return null;
  return {
    id: value.webhook_id, url: value.url, clientId: typeof value.client_id === "string" ? value.client_id : undefined,
    enabled: value.enabled !== false, events: stringArray(value.event_types), inboxIds: stringArray(value.inbox_ids),
    podIds: stringArray(value.pod_ids), secret: typeof value.secret === "string" ? value.secret.trim() : undefined,
  };
}

async function providerRequest(apiKey, path, init = {}) {
  const response = await globalThis.fetch(`https://api.agentmail.to/v0${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${apiKey}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: globalThis.AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`AGENTMAIL_WEBHOOK_REQUEST_FAILED:${response.status}`);
  return await response.json();
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== "--apply")) {
    throw new Error("USAGE: node tools/agentmail-webhook-bootstrap.mjs [--apply]");
  }
  const apiKey = await runConvex(["env", "get", "AGENTMAIL_API_KEY"], undefined, "read-api-key");
  if (!apiKey) throw new Error("AGENTMAIL_API_KEY_MISSING");
  let configuredSecret;
  try { configuredSecret = await runConvex(["env", "get", "AGENTMAIL_WEBHOOK_SECRET"], undefined, "read-webhook-secret"); } catch { configuredSecret = undefined; }

  const page = await providerRequest(apiKey, "/webhooks?limit=100");
  if (page?.next_page_token) throw new Error("AGENTMAIL_ACCOUNT_WEBHOOK_LIST_TRUNCATED");
  const hooks = objectArray(page?.webhooks).map(parseWebhook).filter(Boolean);
  const byClient = hooks.filter((hook) => hook.clientId === CLIENT_ID);
  const callbackCollisions = hooks.filter((hook) => hook.url === CALLBACK_URL && hook.clientId !== CLIENT_ID);
  const candidate = byClient[0];
  let detailSecret;
  if (candidate && !candidate.secret) {
    const detail = parseWebhook(await providerRequest(apiKey, `/webhooks/${encodeURIComponent(candidate.id)}`));
    if (sameConfiguration(candidate, detail)) detailSecret = detail?.secret;
  }
  if (!apply) {
    process.stdout.write(JSON.stringify({
      deployment: "development",
      mode: "diagnostic",
      webhookCount: hooks.length,
      clientMatchCount: byClient.length,
      callbackCollisionCount: callbackCollisions.length,
      candidateChecks: candidate ? {
        urlMatch: candidate.url === CALLBACK_URL,
        enabled: candidate.enabled,
        eventsMatch: sameEvents(candidate.events),
        accountWide: candidate.inboxIds.length === 0 && candidate.podIds.length === 0,
        inboxFilterCount: candidate.inboxIds.length,
        podFilterCount: candidate.podIds.length,
        secretReturnedByList: Boolean(candidate.secret),
        secretReturnedByDetail: Boolean(detailSecret),
      } : null,
      configuredSecretPresent: Boolean(configuredSecret),
      configuredSecretMatchesProvider: Boolean((candidate?.secret ?? detailSecret) && configuredSecret === (candidate?.secret ?? detailSecret)),
    }) + "\n");
    return;
  }
  if (byClient.length > 1) throw new Error("AGENTMAIL_ACCOUNT_WEBHOOK_DUPLICATE_CLIENT_ID");
  const existing = byClient[0];
  if (callbackCollisions.length > 0) {
    throw new Error("AGENTMAIL_ACCOUNT_WEBHOOK_URL_ALREADY_CLAIMED");
  }
  if (existing && (existing.url !== CALLBACK_URL || !existing.enabled || !sameEvents(existing.events) || existing.inboxIds.length || existing.podIds.length > 1)) {
    throw new Error("AGENTMAIL_ACCOUNT_WEBHOOK_CONFIG_MISMATCH");
  }

  let secret = existing?.secret ?? detailSecret;
  let outcome = "reused";
  let validatedHook = existing;
  if (!existing) {
    const createResponse = await providerRequest(apiKey, "/webhooks", {
      method: "POST",
      body: { url: CALLBACK_URL, event_types: EVENT_TYPES, client_id: CLIENT_ID },
    });
    const createdId = createResponse && typeof createResponse === "object" && !Array.isArray(createResponse) &&
      typeof createResponse.webhook_id === "string" ? createResponse.webhook_id : undefined;
    secret = createResponse && typeof createResponse === "object" && !Array.isArray(createResponse) &&
      typeof createResponse.secret === "string" ? createResponse.secret.trim() : undefined;
    if (!createdId || !secret) {
      throw new Error("AGENTMAIL_ACCOUNT_WEBHOOK_CREATE_RESPONSE_INVALID");
    }
    const verificationPage = await providerRequest(apiKey, "/webhooks?limit=100");
    const verified = objectArray(verificationPage?.webhooks).map(parseWebhook).filter(Boolean)
      .find((hook) => hook.id === createdId && hook.clientId === CLIENT_ID);
    if (!verified || verified.url !== CALLBACK_URL || !verified.enabled || !sameEvents(verified.events) ||
      verified.inboxIds.length || verified.podIds.length > 1) throw new Error("AGENTMAIL_ACCOUNT_WEBHOOK_CREATE_RESPONSE_INVALID");
    validatedHook = verified;
    outcome = "created";
  }

  if (secret) {
    if (configuredSecret !== secret) {
      await runConvex(["env", "set", "AGENTMAIL_WEBHOOK_SECRET"], `${secret}\n`, "set-webhook-secret");
    }
    process.stdout.write(JSON.stringify({ deployment: "development", mode: "apply", outcome, coverage: validatedHook?.podIds.length === 1 ? "pod_wide" : "account_wide", podCoverageVerifiedByInboxProof: false, secretState: "configured_from_provider" }) + "\n");
  } else {
    process.stdout.write(JSON.stringify({ deployment: "development", mode: "apply", outcome, coverage: validatedHook?.podIds.length === 1 ? "pod_wide" : "account_wide", podCoverageVerifiedByInboxProof: false, secretState: configuredSecret ? "configured_unverified" : "missing_requires_provenance" }) + "\n");
    process.exitCode = 2;
  }
}

function safeErrorCode(error) {
  const message = error instanceof Error ? error.message : "";
  const allowed = new Set([
    "USAGE: node tools/agentmail-webhook-bootstrap.mjs [--apply]",
    "AGENTMAIL_API_KEY_MISSING",
    "AGENTMAIL_ACCOUNT_WEBHOOK_LIST_TRUNCATED",
    "AGENTMAIL_ACCOUNT_WEBHOOK_DUPLICATE_CLIENT_ID",
    "AGENTMAIL_ACCOUNT_WEBHOOK_URL_ALREADY_CLAIMED",
    "AGENTMAIL_ACCOUNT_WEBHOOK_CONFIG_MISMATCH",
    "AGENTMAIL_ACCOUNT_WEBHOOK_CREATE_RESPONSE_INVALID",
  ]);
  if (allowed.has(message)) return message;
  if (message.startsWith("CONVEX_CLI_FAILED:")) return "CONVEX_CLI_FAILED";
  if (message.startsWith("AGENTMAIL_WEBHOOK_REQUEST_FAILED:")) return "AGENTMAIL_WEBHOOK_REQUEST_FAILED";
  return "AGENTMAIL_WEBHOOK_BOOTSTRAP_UNEXPECTED_ERROR";
}

main().catch((error) => {
  process.stderr.write(`${safeErrorCode(error)}\n`);
  process.exitCode = 1;
});
