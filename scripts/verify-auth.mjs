import { readFileSync, existsSync } from "node:fs";
import { generateKeyPairSync, sign } from "node:crypto";
import { spawnSync } from "node:child_process";

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

const url = get("NEXT_PUBLIC_SUPABASE_URL").trim().replace(/\/$/, "");
const key = get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY").trim();

if (!url || !key) {
  console.log("verify:auth SKIPPED: Supabase not configured (Demo data mode).");
  process.exit(0);
}

// --- 1. auth health -------------------------------------------------------
const health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
if (!health.ok) {
  console.error(`verify:auth FAILED: auth health returned ${health.status}`);
  process.exit(1);
}
console.log("verify:auth OK: Supabase auth reachable.");

// --- 2. full Solana SIWS round trip with a throwaway keypair ---------------
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

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const spki = publicKey.export({ type: "spki", format: "der" });
const wallet = base58(spki.subarray(spki.length - 32));

const issuedAt = new Date().toISOString();
const message = [
  "localhost wants you to sign in with your Solana account:",
  wallet,
  "",
  "Sign in to RecallRelay to verify product ownership.",
  "",
  "Version: 1",
  "URI: http://localhost:3000/signin",
  `Issued At: ${issuedAt}`,
].join("\n");

const signature = sign(null, Buffer.from(message, "utf8"), privateKey);

const tokenResponse = await fetch(`${url}/auth/v1/token?grant_type=web3`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({
    chain: "solana",
    message,
    signature: signature.toString("base64url"),
  }),
});

if (!tokenResponse.ok) {
  console.error(`verify:auth FAILED: SIWS sign-in returned ${tokenResponse.status}: ${await tokenResponse.text()}`);
  process.exit(1);
}

const session = await tokenResponse.json();
const accessToken = session.access_token;
const userId = session.user?.id;
if (!accessToken || !userId) {
  console.error("verify:auth FAILED: SIWS response missing session or user.");
  process.exit(1);
}
console.log(`verify:auth OK: SIWS sign-in created session for user ${userId}`);
console.log(`  wallet: ${wallet}`);

// --- 3. exercise the authenticated app APIs --------------------------------
const headers = {
  apikey: key,
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

const profileRes = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}&select=id,full_name,wallet_address`, { headers });
const profiles = await profileRes.json();

if (profiles.length === 0) {
  const createRes = await fetch(`${url}/rest/v1/rpc/create_profile`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_full_name: "Verify Bot" }),
  });
  if (!createRes.ok) {
    console.error(`verify:auth FAILED: create_profile returned ${createRes.status}: ${await createRes.text()}`);
    process.exit(1);
  }
  console.log("verify:auth OK: create_profile RPC created the owner profile.");
} else {
  console.log("verify:auth OK: profile already exists for this wallet.");
}

const bound = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}&select=wallet_address`, { headers });
const boundRows = await bound.json();
if (boundRows[0]?.wallet_address !== wallet) {
  console.error(`verify:auth FAILED: profile wallet ${boundRows[0]?.wallet_address} != signed wallet ${wallet}`);
  process.exit(1);
}
console.log("verify:auth OK: profile wallet matches the SIWS identity (original casing preserved).");

const lookup = await fetch(`${url}/rest/v1/rpc/find_profile_by_wallet`, {
  method: "POST",
  headers,
  body: JSON.stringify({ p_wallet: wallet }),
});
const found = await lookup.json();
if (!Array.isArray(found) || found.length !== 1 || found[0].is_self !== true) {
  console.error(`verify:auth FAILED: find_profile_by_wallet returned ${JSON.stringify(found)}`);
  process.exit(1);
}
console.log("verify:auth OK: find_profile_by_wallet resolves the signed-in wallet as self.");

// --- 4. cleanup via the service role key when available --------------------
const serviceKey = supabaseStatus().SERVICE_ROLE_KEY;
if (serviceKey) {
  const del = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  console.log(del.ok
    ? "verify:auth OK: test user cleaned up via admin API."
    : `verify:auth WARN: could not clean up test user (${del.status}).`);
} else {
  console.log("verify:auth WARN: service role key not found; test user left in place.");
}

console.log("verify:auth OK: full SIWS round trip passed.");
process.exit(0);

function supabaseStatus() {
  const isWindows = process.platform === "win32";
  const command = isWindows ? 'npx.cmd supabase status -o json' : "npx supabase status -o json";
  const result = spawnSync(command, {
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) return {};
  try {
    return JSON.parse(result.stdout);
  } catch {
    return {};
  }
}
