import { readFileSync, existsSync } from "node:fs";

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

const url = get("NEXT_PUBLIC_SUPABASE_URL").trim();
const key = get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY").trim();
const mode = get("NEXT_PUBLIC_RECALLRELAY_ENV").trim();

if ((url && !key) || (!url && key)) {
  console.error("verify:env FAILED: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must both be set or both unset.");
  process.exit(1);
}

if (!url && !key) {
  console.log("verify:env OK: Supabase not configured — RecallRelay runs in Demo data mode (Phase 1 fixtures).");
  process.exit(0);
}

if (mode !== "local" && mode !== "hosted") {
  console.error('verify:env FAILED: NEXT_PUBLIC_RECALLRELAY_ENV must be "local" or "hosted".');
  process.exit(1);
}

const label = mode === "hosted" ? "Hosted data" : "Local data";
console.log(`verify:env OK: configured (${label}).`);
console.log(`  url: ${url}`);
console.log(`  key: ${key.slice(0, 18)}…`);
process.exit(0);
