#!/usr/bin/env node
// Phase 3 live Devnet end-to-end.
//
// Northstar Outdoor Tech -> HeatCore 10K (HC10-2048) -> Alice -> Bob, with
// every reconcile going through the trusted PostgREST RPCs exactly as the API
// routes call them. Headless keypairs only — no browser and no manual step.
//
// Targets: LOCAL Supabase (reset without seed so the scenario owns every
// row it needs) and Solana Devnet (the deployed program). The deployer
// wallet in WSL funds the two throwaway chain wallets with fractions of a
// SOL for fees and rent; nothing is airdropped.
//
// Usage:  node scripts/e2e-devnet.mjs [--skip-reset] [--funder <keypair.json>]
// Run `npm run db:reset` afterwards to restore the normal seeded local DB.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createPrivateKey, sign } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const argValue = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const SKIP_RESET = process.argv.includes("--skip-reset");
const FUNDER_PATH =
  argValue("--funder") || "\\\\wsl.localhost\\Ubuntu\\home\\okumah\\.config\\solana\\id.json";

// --- 1. local stack status -------------------------------------------------
function supabaseStatus() {
  const command = process.platform === "win32" ? "npx.cmd supabase status -o json" : "npx supabase status -o json";
  const result = spawnSync(command, { encoding: "utf8", shell: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) return {};
  try {
    return JSON.parse(result.stdout);
  } catch {
    return {};
  }
}

const status = supabaseStatus();
const url = (status.API_URL || "").replace(/\/$/, "");
const anonKey = status.ANON_KEY || "";
if (!url || !anonKey) {
  console.error("e2e:devnet FAILED: local Supabase is not running (npx supabase start).");
  process.exit(1);
}

// --- 2. reset local DB without seed ---------------------------------------
if (!SKIP_RESET) {
  console.log("e2e: resetting local database without seed...");
  const reset = spawnSync(
    process.platform === "win32" ? "npx.cmd supabase db reset --no-seed" : "npx supabase db reset --no-seed",
    { encoding: "utf8", shell: true, maxBuffer: 16 * 1024 * 1024 },
  );
  if (reset.status !== 0) {
    console.error(`e2e:devnet FAILED: db reset --no-seed failed:\n${reset.stdout}\n${reset.stderr}`);
    process.exit(1);
  }
}

// --- 3. emit the real Solana library (same code the server runs) ----------
const emitDir = join(root, ".sbf-test-build");
const tsc = spawnSync(process.platform === "win32" ? "npx.cmd tsc -p tsconfig.sbf.emit.json" : "npx tsc -p tsconfig.sbf.emit.json", {
  encoding: "utf8",
  shell: true,
  cwd: root,
  maxBuffer: 8 * 1024 * 1024,
});
if (!existsSync(join(emitDir, "chain.js"))) {
  console.error(`e2e:devnet FAILED: tsc emit produced no chain.js:\n${tsc.stdout}\n${tsc.stderr}`);
  process.exit(1);
}
if (tsc.status !== 0) console.log("e2e: note: tsc reported type errors but emitted anyway (expected: test build).");
// Node ESM needs explicit .js suffixes; the sources use extensionless specifiers.
for (const file of readdirSync(emitDir)) {
  if (!file.endsWith(".js") && !file.endsWith(".mjs")) continue;
  const path = join(emitDir, file);
  const source = readFileSync(path, "utf8");
  const fixed = source.replace(/from "(\.\/[^"]+)"/g, (m, spec) => (spec.endsWith(".js") || spec.endsWith(".mjs") ? m : `from "${spec}.js"`));
  if (fixed !== source) writeFileSync(path, fixed);
}
writeFileSync(join(emitDir, "package.json"), JSON.stringify({ type: "module" }));
const chain = await import(pathToFileURL(join(emitDir, "chain.js")).href);

const connection = chain.getConnection();
const PROGRAM_ID = chain.PROGRAM_ID;
const systemProgramId = new PublicKey("11111111111111111111111111111111");

// --- 4. assertion framework -----------------------------------------------
const results = [];
function check(step, label, condition, detail) {
  const ok = Boolean(condition);
  results.push({ step, label, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"} [${step}/13] ${label}${ok ? "" : ` — ${detail}`}`);
}
function fatal(message) {
  console.error(`e2e:devnet FAILED: ${message}`);
  process.exit(1);
}

// --- 5. headless identities (SIWS with the real chain keypairs) ------------
function walletSigner(keypair) {
  const der = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    keypair.secretKey.subarray(0, 32),
  ]);
  const privateKey = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  return (message) => sign(null, Buffer.from(message, "utf8"), privateKey).toString("base64url");
}

async function siws(keypair) {
  const wallet = keypair.publicKey.toBase58();
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
  const res = await fetch(`${url}/auth/v1/token?grant_type=web3`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ chain: "solana", message, signature: walletSigner(keypair)(message) }),
  });
  if (!res.ok) fatal(`SIWS sign-in for ${wallet} returned ${res.status}: ${await res.text()}`);
  const session = await res.json();
  if (!session.access_token || !session.user?.id) fatal(`SIWS response missing session for ${wallet}`);
  return { wallet, jwt: session.access_token, userId: session.user.id };
}

function headers(jwt) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${jwt ?? anonKey}`,
    "Content-Type": "application/json",
  };
}

async function rpc(jwt, fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: headers(jwt),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn} returned ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function rows(jwt, path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: headers(jwt) });
  const text = await res.text();
  if (!res.ok) throw new Error(`select ${path} returned ${res.status}: ${text}`);
  return JSON.parse(text);
}
const row = async (jwt, path) => (await rows(jwt, path))[0] ?? null;

// --- 6. chain helpers ------------------------------------------------------
async function sendAndConfirm(label, ixs, payer, extraSigners = []) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const message = new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
      const tx = new VersionedTransaction(message);
      tx.sign([payer, ...extraSigners]);
      const signature = await connection.sendTransaction(tx);
      const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      if (confirmation.value.err) throw new Error(`transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      console.log(`  ${label}: ${signature}`);
      return signature;
    } catch (error) {
      lastError = error;
      console.log(`  ${label}: attempt ${attempt + 1} failed (${error.message}); retrying...`);
    }
  }
  lastError.message = `${label} failed after retries: ${lastError.message}`;
  throw lastError;
}

async function fund(connection_, funder, destination, lamports) {
  const { blockhash, lastValidBlockHeight } = await connection_.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: funder.publicKey, blockhash, lastValidBlockHeight }).add(
    SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: destination.publicKey, lamports }),
  );
  tx.sign(funder);
  const signature = await connection_.sendRawTransaction(tx.serialize());
  const confirmation = await connection_.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  if (confirmation.value.err) throw new Error(`funding transfer failed: ${JSON.stringify(confirmation.value.err)}`);
  return signature;
}

// --- 7. the scenario -------------------------------------------------------
console.log("e2e: creating headless identities (staff, Alice, Bob)...");
const staffKp = Keypair.generate();
const aliceKp = Keypair.generate();
const bobKp = Keypair.generate();

let funder;
try {
  funder = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(FUNDER_PATH, "utf8"))));
} catch (error) {
  fatal(`cannot read funder keypair at ${FUNDER_PATH} (${error.message}); pass --funder <path>`);
}
const lamports = (sol) => Math.round(sol * 1_000_000_000);
console.log("e2e: funding chain wallets from the deployer (fees + rent)...");
await fund(connection, funder, staffKp, lamports(0.05));
await fund(connection, funder, aliceKp, lamports(0.02));
console.log(`  staff: ${staffKp.publicKey.toBase58()}`);
console.log(`  alice: ${aliceKp.publicKey.toBase58()}`);
console.log(`  bob:   ${bobKp.publicKey.toBase58()}`);

const staff = await siws(staffKp);
const alice = await siws(aliceKp);
const bob = await siws(bobKp);
console.log(`  staff user ${staff.userId}, alice user ${alice.userId}, bob user ${bob.userId}`);

await rpc(staff.jwt, "create_profile", { p_full_name: "Northstar E2E Staff" });
await rpc(alice.jwt, "create_profile", { p_full_name: "Alice Morgan" });
await rpc(bob.jwt, "create_profile", { p_full_name: "Bob Chen" });

const manufacturer = await rpc(staff.jwt, "create_manufacturer", {
  p_name: "Northstar Outdoor Tech",
  p_slug: "northstar-outdoor-tech",
});
const model = await rpc(staff.jwt, "create_product_model", {
  p_manufacturer_id: manufacturer.id,
  p_sku: "HC10",
  p_name: "HeatCore 10K",
  p_category: "Power stations",
});
const unit = await rpc(staff.jwt, "register_product_unit", {
  p_model_id: model.id,
  p_serial_number: "HC10-2048",
  p_initial_owner_wallet: alice.wallet,
});
console.log(`e2e: manufacturer ${manufacturer.id}, model ${model.id}, unit ${unit.id}`);

// --- 8. run the 13 steps ---------------------------------------------------
console.log("\ne2e: running steps...");

let manufacturerPda;
let productPda;
let initSig;
let registerSig;
let transferSig;

try {
// 1. initialize Northstar on chain
initSig = await sendAndConfirm(
  "initialize manufacturer",
  [
    {
      programId: new PublicKey(PROGRAM_ID),
      keys: [
        { pubkey: chain.manufacturerPdaFor(chain.hashIdentifier(manufacturer.id)), isSigner: false, isWritable: true },
        { pubkey: staffKp.publicKey, isSigner: true, isWritable: true },
        { pubkey: systemProgramId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([Buffer.from([0]), chain.hashIdentifier(manufacturer.id)]),
    },
  ],
  staffKp,
);
manufacturerPda = chain.manufacturerPdaFor(chain.hashIdentifier(manufacturer.id));
const observed1 = await chain.observeManufacturer(manufacturer.id);
check(
  1,
  "initialize Northstar on chain",
  observed1 && observed1.pda === manufacturerPda.toBase58() && observed1.authority === staff.wallet && observed1.isActive,
  JSON.stringify({ observed: observed1 && { pda: observed1.pda, authority: observed1.authority }, expectedAuthority: staff.wallet }),
);

// 2. reconcile the manufacturer (server-observed values, trusted RPC)
const mfrRow = await rpc(staff.jwt, "reconcile_manufacturer_chain_state", {
  p_manufacturer_id: manufacturer.id,
  p_program_id: PROGRAM_ID,
  p_pda: observed1.pda,
  p_authority: observed1.authority,
  p_state: "synced",
  p_tx_signature: initSig,
});
check(
  2,
  "reconcile manufacturer chain state",
  mfrRow.chain_state === "synced" && mfrRow.chain_pda === observed1.pda && mfrRow.chain_authority === staff.wallet && mfrRow.chain_program_id === PROGRAM_ID,
  JSON.stringify({ chain_state: mfrRow.chain_state, chain_pda: mfrRow.chain_pda }),
);

// 3. register HeatCore with Alice as owner
productPda = chain.productPdaFor(chain.hashIdentifier(unit.id), manufacturerPda);
registerSig = await sendAndConfirm(
  "register product",
  [
    {
      programId: new PublicKey(PROGRAM_ID),
      keys: [
        { pubkey: productPda, isSigner: false, isWritable: true },
        { pubkey: manufacturerPda, isSigner: false, isWritable: false },
        { pubkey: staffKp.publicKey, isSigner: true, isWritable: true },
        { pubkey: aliceKp.publicKey, isSigner: false, isWritable: false },
        { pubkey: systemProgramId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([Buffer.from([1]), chain.hashIdentifier(unit.id)]),
    },
  ],
  staffKp,
);
const observed2 = await chain.observeProduct(unit.id, manufacturer.id);
check(
  3,
  "register HeatCore 10K with Alice on chain",
  observed2 &&
    observed2.pda === productPda.toBase58() &&
    observed2.currentOwner === alice.wallet &&
    observed2.transferCount === 0 &&
    observed2.manufacturer === manufacturerPda.toBase58() &&
    observed2.isActive,
  JSON.stringify(observed2 && { pda: observed2.pda, currentOwner: observed2.currentOwner, transferCount: observed2.transferCount }),
);

// 4. reconcile the product (server-observed values, trusted RPC)
const unitAfterRegister = await rpc(staff.jwt, "reconcile_product_chain_state", {
  p_unit_id: unit.id,
  p_program_id: PROGRAM_ID,
  p_pda: observed2.pda,
  p_owner: observed2.currentOwner,
  p_transfer_count: observed2.transferCount,
  p_state: "synced",
  p_tx_signature: registerSig,
});
check(
  4,
  "reconcile product chain state",
  unitAfterRegister.chain_state === "synced" &&
    unitAfterRegister.chain_pda === productPda.toBase58() &&
    unitAfterRegister.chain_owner === alice.wallet &&
    unitAfterRegister.chain_transfer_count === 0 &&
    unitAfterRegister.chain_tx_signature === registerSig,
  JSON.stringify({ chain_state: unitAfterRegister.chain_state, chain_owner: unitAfterRegister.chain_owner }),
);

// 5. Alice is the current owner, chain and database agree
const unitRow5 = await row(staff.jwt, `product_units?id=eq.${unit.id}&select=current_owner_profile_id,chain_owner,chain_state`);
check(
  5,
  "Alice is current owner (chain + database)",
  observed2.currentOwner === alice.wallet && unitRow5.current_owner_profile_id === alice.userId && unitRow5.chain_owner === alice.wallet,
  JSON.stringify({ chain: observed2.currentOwner, dbOwner: unitRow5.current_owner_profile_id, alice: alice.userId }),
);

// 6. Alice transfers to Bob on chain
transferSig = await sendAndConfirm(
  "transfer product",
  [
    {
      programId: new PublicKey(PROGRAM_ID),
      keys: [
        { pubkey: productPda, isSigner: false, isWritable: true },
        { pubkey: aliceKp.publicKey, isSigner: true, isWritable: true },
        { pubkey: bobKp.publicKey, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([2]),
    },
  ],
  aliceKp,
);
const observed3 = await chain.observeProduct(unit.id, manufacturer.id);
check(
  6,
  "Alice -> Bob transfer confirmed on chain",
  observed3 && observed3.currentOwner === bob.wallet && observed3.transferCount === 1,
  JSON.stringify(observed3 && { currentOwner: observed3.currentOwner, transferCount: observed3.transferCount }),
);

// 7. reconcile the transfer (Alice — the current owner — via the trusted RPC)
const unitAfterTransfer = await rpc(alice.jwt, "apply_chain_transfer", {
  p_unit_id: unit.id,
  p_new_owner_wallet: bob.wallet,
  p_chain_owner: observed3.currentOwner,
  p_transfer_count: observed3.transferCount,
  p_tx_signature: transferSig,
});
check(
  7,
  "reconcile transfer through trusted RPC",
  unitAfterTransfer.current_owner_profile_id === bob.userId &&
    unitAfterTransfer.chain_owner === bob.wallet &&
    unitAfterTransfer.chain_transfer_count === 1 &&
    unitAfterTransfer.chain_state === "synced" &&
    unitAfterTransfer.chain_tx_signature === transferSig,
  JSON.stringify({ owner: unitAfterTransfer.current_owner_profile_id, chain_owner: unitAfterTransfer.chain_owner }),
);

// 8. Bob is the current owner on chain
check(8, "Bob is current owner on chain", observed3.currentOwner === bob.wallet, `chain owner ${observed3.currentOwner}`);

// 9. transfer count is exactly 1, chain and database agree
const unitRow9 = await row(staff.jwt, `product_units?id=eq.${unit.id}&select=chain_transfer_count`);
check(
  9,
  "transfer count is 1 (chain + database)",
  observed3.transferCount === 1 && unitRow9.chain_transfer_count === 1,
  JSON.stringify({ chain: observed3.transferCount, db: unitRow9.chain_transfer_count }),
);

// 10. Supabase records Bob as the owner profile
const unitRow10 = await row(staff.jwt, `product_units?id=eq.${unit.id}&select=current_owner_profile_id`);
check(10, "Supabase current owner profile is Bob", unitRow10.current_owner_profile_id === bob.userId, `db owner ${unitRow10.current_owner_profile_id}`);

// 11. exactly one chain-confirmed transfer ownership record
const transferRecords = await rows(staff.jwt, `ownership_records?unit_id=eq.${unit.id}&note=eq.${encodeURIComponent("Confirmed on Solana")}&select=id,to_profile_id`);
check(
  11,
  "exactly one chain-confirmed ownership record",
  transferRecords.length === 1 && transferRecords[0].to_profile_id === bob.userId,
  JSON.stringify(transferRecords),
);

// 12. exactly one transfer notification for Bob
const bobNotifications = await rows(bob.jwt, `notifications?unit_id=eq.${unit.id}&kind=eq.transfer&select=id`);
check(12, "exactly one transfer notification for Bob", bobNotifications.length === 1, `found ${bobNotifications.length}`);

// 13. public verification is blockchain-backed and leaks no identity
const publicRows = await fetch(`${url}/rest/v1/rpc/lookup_public_product`, {
  method: "POST",
  headers: headers(null),
  body: JSON.stringify({ p_identifier: "HC10-2048" }),
});
const publicBody = await publicRows.json();
const publicRow = Array.isArray(publicBody) ? publicBody[0] : null;
check(
  13,
  "public verification is blockchain-backed without identity columns",
  publicRow &&
    publicRow.chain_state === "synced" &&
    publicRow.chain_pda === productPda.toBase58() &&
    publicRow.chain_owner === bob.wallet &&
    publicRow.chain_program_id === PROGRAM_ID &&
    typeof publicRow.chain_tx_signature === "string" &&
    publicRow.chain_tx_signature.length > 0 &&
    !("current_owner_profile_id" in publicRow) &&
    !("full_name" in publicRow),
  JSON.stringify(publicRow ?? publicBody),
);

} catch (error) {
  console.error(`\ne2e:devnet FAILED during steps:\n${error.stack ?? error.message}`);
  console.log("\n=== E2E RECORD (Devnet, partial) ===");
  console.log(`program:                ${PROGRAM_ID}`);
  console.log(`manufacturer PDA:       ${manufacturerPda?.toBase58() ?? "n/a"}`);
  console.log(`product PDA:            ${productPda?.toBase58() ?? "n/a"}`);
  console.log(`initialize tx:          ${initSig ?? "n/a"}`);
  console.log(`registration tx:        ${registerSig ?? "n/a"}`);
  console.log(`transfer tx:            ${transferSig ?? "n/a"}`);
  for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"} [${r.step}/13] ${r.label}${r.ok ? "" : ` — ${r.detail}`}`);
  process.exit(1);
}

// --- 9. record -------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log("\n=== E2E RECORD (Devnet) ===");
console.log(`program:                ${PROGRAM_ID}`);
console.log(`manufacturer PDA:       ${manufacturerPda.toBase58()}`);
console.log(`product PDA:            ${productPda.toBase58()}`);
console.log(`initialize tx:          ${initSig}`);
console.log(`registration tx:        ${registerSig}`);
console.log(`transfer tx:            ${transferSig}`);
console.log(`assertions:             ${results.length - failed.length}/${results.length} pass`);
if (failed.length > 0) {
  console.log("\ne2e:devnet FAILED:");
  for (const f of failed) console.log(`  [${f.step}/13] ${f.label}: ${f.detail}`);
  process.exit(1);
}
console.log("\ne2e:devnet OK: full Northstar -> HeatCore -> Alice -> Bob Devnet round trip passed.");
console.log("e2e: note: run `npm run db:reset` to restore the seeded local database.");
process.exit(0);
