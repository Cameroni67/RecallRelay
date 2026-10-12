/**
 * demo-reset — restores or verifies the RecallRelay demo fixture.
 *
 * Canonical demo story (see README):
 *   Northstar Outdoor Tech → HeatCore 10K → serial HC10-2048,
 *   registered by Alice Morgan, transferred to Bob Chen,
 *   recall "Battery overheating risk" / Urgent /
 *   "Stop using immediately and contact the manufacturer."
 *
 * Behavior by data mode:
 *   local  : `node scripts/demo-reset.mjs`        → `supabase db reset`
 *            (restores the seeded local fixture; local data only)
 *   hosted : `node scripts/demo-reset.mjs`        → NEVER destructive.
 *            Hosted data is never reset by this script; it runs the same
 *            read-only verification instead and explains how to reseed.
 *   any    : `node scripts/demo-reset.mjs --check` → read-only fixture
 *            verification against the configured environment (no writes).
 *
 * The check also asserts the public lookup response contains NO owner PII
 * (email, profile id, wallet) — the public verification contract.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import http from "node:http";
import https from "node:https";

const DEMO_SERIAL = "HC10-2048";
const DEMO_MODEL = "HeatCore 10K";
const DEMO_RECALL_TITLE = "Battery overheating risk";
const DEMO_REQUIRED_ACTION = "Stop using immediately and contact the manufacturer.";
const FORBIDDEN_KEYS = ["email", "profile_id", "wallet", "full_name", "owner_name"];

function readDotEnv(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

const fileEnv = { ...readDotEnv(".env.local"), ...readDotEnv(".env") };
const get = (name) => process.env[name] || fileEnv[name] || "";
const url = get("NEXT_PUBLIC_SUPABASE_URL").trim().replace(/\/+$/, "");
const key = get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY").trim();
const mode = get("NEXT_PUBLIC_RECALLRELAY_ENV").trim();
const checkOnly = process.argv.includes("--check");

/**
 * Plain HTTP POST (no fetch keep-alive sockets): the script exits with
 * process.exit() and a lingering undici socket trips a libuv assertion on
 * Windows. Connection: close keeps shutdown clean.
 */
function postJson(targetUrl, payload, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const lib = parsed.protocol === "https:" ? https : http;
    const body = JSON.stringify(payload);
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body), Connection: "close" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, data }));
      },
    );
    req.setTimeout(15000, () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
    req.end(body);
  });
}

async function verifyFixture() {
  if (!url || !key) {
    console.log("demo-reset: no Supabase configured — running in Demo data mode (Phase 1 fixtures).");
    console.log("demo-reset OK: nothing to verify against a database.");
    return true;
  }

  let rows;
  try {
    const response = await postJson(
      `${url}/rest/v1/rpc/lookup_public_product`,
      { p_identifier: DEMO_SERIAL },
      { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    );
    if (response.status < 200 || response.status >= 300) {
      console.error(`demo-reset FAILED: lookup returned HTTP ${response.status}.`);
      if (mode === "local") {
        console.error("  Is local Supabase running? Try: npm run supabase:start");
      }
      return false;
    }
    rows = JSON.parse(response.data);
  } catch (error) {
    console.error(`demo-reset FAILED: could not reach ${url} (${error.message}).`);
    if (mode === "local") console.error("  Is local Supabase running? Try: npm run supabase:start");
    return false;
  }

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    console.error(`demo-reset FAILED: demo unit ${DEMO_SERIAL} not found in the configured database.`);
    return false;
  }

  const problems = [];
  if (row.model_name !== DEMO_MODEL) problems.push(`model is "${row.model_name}"`);
  if (row.recall_title !== DEMO_RECALL_TITLE) problems.push(`recall title is "${row.recall_title}"`);
  if (row.recall_severity !== "urgent") problems.push(`severity is "${row.recall_severity}"`);
  if (row.recall_required_action !== DEMO_REQUIRED_ACTION)
    problems.push(`required action is "${row.recall_required_action}"`);
  const leaked = Object.keys(row).filter((k) => FORBIDDEN_KEYS.some((f) => k.includes(f)));
  if (leaked.length) problems.push(`public lookup exposes PII fields: ${leaked.join(", ")}`);

  if (problems.length) {
    console.error("demo-reset FAILED: demo fixture mismatch:");
    for (const problem of problems) console.error(`  - ${problem}`);
    return false;
  }

  console.log("demo-reset OK: demo fixture verified (read-only).");
  console.log(`  ${DEMO_MODEL} · ${DEMO_SERIAL} · recall "${DEMO_RECALL_TITLE}" (urgent)`);
  console.log(`  required action: ${DEMO_REQUIRED_ACTION}`);
  console.log("  public lookup exposes no owner PII.");
  return true;
}

async function main() {
  if (checkOnly) {
    const ok = await verifyFixture();
    process.exit(ok ? 0 : 1);
  }

  if (mode === "hosted") {
    console.log("demo-reset: hosted data mode — destructive resets are NEVER run against hosted data.");
    console.log("demo-reset: verifying the hosted demo fixture read-only instead (use --check for this explicitly).");
    const ok = await verifyFixture();
    if (!ok) {
      console.error("  Hosted fixture missing or altered. Reseed via a reviewed migration — not by resetting.");
    }
    process.exit(ok ? 0 : 1);
  }

  if (!mode) {
    // Demo data mode: fixtures live in src/lib/data.ts — nothing to reset.
    console.log("demo-reset: no database configured — Phase 1 fixtures are compiled in src/lib/data.ts.");
    console.log("demo-reset OK: restart `npm run dev` to reload demo data.");
    process.exit(0);
  }

  // Local data mode: restore the seeded local database (local only).
  console.log("demo-reset: restoring the LOCAL demo fixture via `supabase db reset`…");
  const result = spawnSync("npx supabase db reset", { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error("demo-reset FAILED: `supabase db reset` failed. Is local Supabase running? Try: npm run supabase:start");
    process.exit(result.status ?? 1);
  }
  const ok = await verifyFixture();
  process.exit(ok ? 0 : 1);
}

main();
