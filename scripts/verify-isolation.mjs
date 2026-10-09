import { readFileSync, existsSync } from "node:fs";
import { generateKeyPairSync, sign } from "node:crypto";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

// Session isolation, forged-access, and public-privacy checks for a configured
// RecallRelay Supabase project (local stack or hosted). Run after verify:auth.
//
// Usage:
//   node scripts/verify-isolation.mjs
//   node scripts/verify-isolation.mjs --url http://127.0.0.1:54421 --key <publishable>
//   npm run verify:isolation

function readDotEnv(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const fileEnv = { ...readDotEnv(".env.local"), ...readDotEnv(".env") };
const get = (name) => process.env[name] || fileEnv[name] || "";

const url = (argValue("--url") || get("NEXT_PUBLIC_SUPABASE_URL")).trim().replace(/\/$/, "");
const key = (argValue("--key") || get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")).trim();

if (!url || !key) {
  console.log("verify:isolation SKIPPED: Supabase not configured (Demo data mode).");
  process.exit(0);
}

let failures = 0;
function ok(cond, label, detail = "") {
  if (cond) {
    console.log(`verify:isolation OK: ${label}`);
  } else {
    failures += 1;
    console.error(`verify:isolation FAILED: ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(buffer) {
  let value = BigInt(`0x${Buffer.from(buffer).toString("hex")}`);
  let out = "";
  while (value > 0n) {
    out = BASE58[Number(value % 58n)] + out;
    value /= 58n;
  }
  for (const byte of buffer) {
    if (byte === 0) out = "1" + out;
    else break;
  }
  return out;
}

async function siwsSignIn() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" });
  const wallet = base58(spki.subarray(spki.length - 32));
  const message = [
    "localhost wants you to sign in with your Solana account:",
    wallet,
    "",
    "Sign in to RecallRelay to verify product ownership.",
    "",
    "Version: 1",
    "URI: http://localhost:3000/signin",
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
  const signature = sign(null, Buffer.from(message, "utf8"), privateKey);
  const res = await fetch(`${url}/auth/v1/token?grant_type=web3`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ chain: "solana", message, signature: signature.toString("base64url") }),
  });
  if (!res.ok) throw new Error(`SIWS sign-in returned ${res.status}: ${await res.text()}`);
  const session = await res.json();
  return { wallet, accessToken: session.access_token, userId: session.user.id };
}

function api(accessToken) {
  const headers = {
    apikey: key,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    "Content-Type": "application/json",
  };
  return {
    async get(path) {
      const res = await fetch(`${url}/rest/v1/${path}`, { headers });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
    },
    async send(method, path, body) {
      const res = await fetch(`${url}/rest/v1/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
    },
  };
}

// --- health ------------------------------------------------------------------
const health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
if (!health.ok) {
  console.error(`verify:isolation FAILED: auth health returned ${health.status}`);
  process.exit(1);
}

let userA;
let userB;
try {
  userA = await siwsSignIn();
  const asA = api(userA.accessToken);
  const created = await asA.send("POST", "rpc/create_profile", { p_full_name: "Isolation Bot A" });
  ok(created.status < 300, "user A create_profile", created.raw);
  userB = await siwsSignIn();
  const asB = api(userB.accessToken);
  const createdB = await asB.send("POST", "rpc/create_profile", { p_full_name: "Isolation Bot B" });
  ok(createdB.status < 300, "user B create_profile", createdB.raw);
} catch (err) {
  console.error(`verify:isolation FAILED: ${err.message}`);
  console.error("  (hosted Web3 provider may be disabled — enable Authentication > Providers > Web3)");
  process.exit(1);
}

const asA = api(userA.accessToken);
const asB = api(userB.accessToken);
const anon = api(null);

// --- identity integrity -----------------------------------------------------
{
  const me = await asA.get(`profiles?id=eq.${userA.userId}&select=id,full_name,wallet_address`);
  ok(me.body?.length === 1 && me.body[0].id === userA.userId, "profile id matches auth uid");
  ok(me.body?.[0]?.wallet_address === userA.wallet, "profile wallet bound from A's SIWS identity");
  const derived = await asA.send("POST", "rpc/auth_wallet_address", {});
  ok(derived.body === userA.wallet, "auth_wallet_address() resolves A's wallet via auth.uid()", derived.raw);
  const meB = await asB.get(`profiles?id=eq.${userB.userId}&select=id,wallet_address`);
  ok(meB.body?.[0]?.wallet_address === userB.wallet, "profile wallet bound from B's SIWS identity");
  ok(userA.wallet !== userB.wallet, "throwaway wallets are distinct");
}

// --- B cannot read A's private profile --------------------------------------
{
  const row = await asB.get(`profiles?id=eq.${userA.userId}&select=id,full_name,wallet_address`);
  ok(Array.isArray(row.body) && row.body.length === 0, "B cannot read A's profile row", row.raw);
  const patch = await asB.send("PATCH", `profiles?id=eq.${userA.userId}`, { full_name: "hacked" });
  const rows = Array.isArray(patch.body) ? patch.body.length : patch.status >= 400 ? -1 : 0;
  ok(patch.status < 400 && rows === 0, "B cannot update A's profile (0 rows)", `status=${patch.status}`);
  const after = await asA.get(`profiles?id=eq.${userA.userId}&select=full_name`);
  ok(after.body?.[0]?.full_name !== "hacked", "A's profile name unchanged after B's attempt");
}

// --- forged wallet binding --------------------------------------------------
{
  const forged = await asB.send("PATCH", `profiles?id=eq.${userB.userId}`, {
    wallet_address: "ForgedWalletAddressDoNotAccept1112223334445556",
  });
  ok(forged.status >= 400, "B cannot overwrite own wallet_address (no column privilege)", `status=${forged.status}`);
  const still = await asB.get(`profiles?id=eq.${userB.userId}&select=wallet_address`);
  ok(still.body?.[0]?.wallet_address === userB.wallet, "B's wallet binding unchanged");
}

// --- forged profile insert --------------------------------------------------
{
  const insert = await asB.send("POST", "profiles", { id: randomUUID(), full_name: "forged" });
  ok(insert.status >= 400, "B cannot insert profile rows directly", `status=${insert.status}`);
}

// --- ownership history privacy ----------------------------------------------
{
  // Seeded Bob (2222...-2222) owns units; B must not see his ownership records.
  const bob = "22222222-2222-2222-2222-222222222222";
  const seen = await asB.get(
    `ownership_records?or=(from_profile_id.eq.${bob},to_profile_id.eq.${bob})&select=id`,
  );
  ok(Array.isArray(seen.body) && seen.body.length === 0, "B cannot read Bob's ownership history", seen.raw);
}

// --- notification isolation -------------------------------------------------
{
  const mine = await asA.get(`notifications?select=id,profile_id,kind`);
  ok(
    Array.isArray(mine.body) && mine.body.length > 0 && mine.body.every((n) => n.profile_id === userA.userId),
    "A sees only own notifications",
  );
  const bAll = await asB.get(`notifications?select=id,profile_id`);
  ok(
    Array.isArray(bAll.body) && bAll.body.every((n) => n.profile_id === userB.userId),
    "B sees only own notifications",
  );
  const target = mine.body?.[0];
  if (target) {
    const steal = await asB.send("PATCH", `notifications?id=eq.${target.id}`, {
      read_at: new Date().toISOString(),
    });
    const rows = Array.isArray(steal.body) ? steal.body.length : steal.status >= 400 ? -1 : 0;
    ok(steal.status < 400 && rows === 0, "B cannot mark A's notification read", `status=${steal.status}`);
  }
}

// --- manufacturer isolation -------------------------------------------------
{
  const northstar = "44444444-4444-4444-4444-444444444444";
  const members = await asB.get(`manufacturer_members?manufacturer_id=eq.${northstar}&select=manufacturer_id,profile_id,role`);
  ok(Array.isArray(members.body) && members.body.length === 0, "B cannot read Northstar membership rows");
  const role = await asB.send("POST", "rpc/manufacturer_member_role", {
    p_manufacturer_id: northstar,
  });
  ok(role.body === null, "B has no role on Northstar", role.raw);
  const join = await asB.send("POST", "manufacturer_members", {
    manufacturer_id: northstar,
    profile_id: userB.userId,
    role: "owner",
  });
  ok(join.status >= 400, "B cannot grant himself manufacturer membership", `status=${join.status}`);
  const model = await asB.send("POST", "product_models", {
    manufacturer_id: northstar,
    sku: "FORGED",
    name: "Forged model",
    category: "Test",
  });
  ok(model.status >= 400, "B cannot create models under Northstar", `status=${model.status}`);
}

// --- unauthorized transfer / recall rejection (anon + B) --------------------
{
  const xferAnon = await anon.send("POST", "rpc/transfer_product_ownership", {
    p_unit_id: "66666666-6666-6666-6666-666666666601",
    p_recipient_wallet: userB.wallet,
    p_note: "anon forged",
  });
  ok(xferAnon.status >= 400, "anon cannot transfer ownership", `status=${xferAnon.status}`);
  const recallB = await asB.send("POST", "rpc/issue_recall", {
    p_manufacturer_id: "44444444-4444-4444-4444-444444444444",
    p_model_id: "55555555-5555-5555-5555-555555555501",
    p_title: "Forged recall",
    p_severity: "urgent",
    p_required_action: "Stop",
    p_scope_kind: "all_units",
  });
  ok(recallB.status >= 400, "non-member cannot issue recall", `status=${recallB.status}`);
}

// --- public verification privacy --------------------------------------------
{
  const pub = await anon.send("POST", "rpc/lookup_public_product", { p_identifier: "HC10-2048" });
  const row = Array.isArray(pub.body) ? pub.body[0] : pub.body;
  ok(pub.status < 300 && row, "anon can verify the seeded serial");
  ok(row?.is_recalled === true, "seeded serial is flagged recalled");
  const json = JSON.stringify(pub.body ?? null);
  for (const leak of ["wallet_address", "full_name", "email", "Bob", "7xKX", "22222222"]) {
    ok(!json.includes(leak), `public lookup does not leak '${leak}'`);
  }
  const invalid = await anon.send("POST", "rpc/lookup_public_product", {
    p_identifier: "NOT-A-REAL-SERIAL",
  });
  const invalidRows = Array.isArray(invalid.body) ? invalid.body.length : 0;
  ok(invalid.status < 300 && invalidRows === 0, "invalid serial returns no rows, no raw error");
  for (const t of ["profiles", "product_units", "notifications", "ownership_records"]) {
    const res = await anon.get(`${t}?select=id&limit=1`);
    ok(res.status >= 400, `anon cannot read ${t}`, `status=${res.status}`);
  }
}

// --- cleanup -----------------------------------------------------------------
function supabaseStatus() {
  const isWindows = process.platform === "win32";
  const command = isWindows ? "npx.cmd supabase status -o json" : "npx supabase status -o json";
  const result = spawnSync(command, { encoding: "utf8", shell: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) return {};
  try {
    return JSON.parse(result.stdout);
  } catch {
    return {};
  }
}

const serviceKey = supabaseStatus().SERVICE_ROLE_KEY;
if (serviceKey) {
  for (const u of [userA, userB]) {
    const del = await fetch(`${url}/auth/v1/admin/users/${u.userId}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    console.log(del.ok
      ? `verify:isolation OK: cleaned up test user ${u.userId}.`
      : `verify:isolation WARN: could not clean up test user ${u.userId} (${del.status}).`);
  }
} else {
  console.log(`verify:isolation WARN: no local service key for ${url}; test users left in place.`);
  console.log(`  userA=${userA.userId} userB=${userB.userId}`);
}

if (failures > 0) {
  console.error(`verify:isolation FAILED: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log("verify:isolation OK: full session isolation and public privacy checks passed.");
process.exit(0);
