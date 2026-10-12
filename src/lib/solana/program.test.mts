// LiteSVM tests for the RecallRelay on-chain program.
//
// These are native `.mts` tests run via Node's built-in test runner. They are
// excluded from the default vitest run so `npm test` does not attempt to load
// the Linux-native litesvm binding on Windows.
//
// Requires the compiled `.so` from `cargo build-sbf` (WSL). Run from WSL:
//   npm run test:sbf

import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendTransactionMessageInstruction,
  createTransactionMessage,
  generateKeyPairSigner,
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import {
  AccountRole,
  address,
  lamports,
  type Address,
} from "@solana/kit";
import { LiteSVM, FailedTransactionMetadata } from "litesvm";
import { PROGRAM_ID } from "./deployment";
import {
  buildInitializeManufacturerIx,
  buildRegisterProductIx,
  buildTransferProductIx,
  decodeManufacturer,
  decodeProduct,
} from "./instructions";
import { deriveManufacturerPda, deriveProductPda } from "./pdas";
import { MANUFACTURER_SIZE, PRODUCT_SIZE } from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRAM_ID_PK = address(PROGRAM_ID);
const SO_PATH =
  process.env.RECALLRELAY_SO_PATH ??
  path.resolve(
    __dirname,
    "../../../solana/recallrelay-program/target/deploy/recallrelay_program.so",
  );

const MFR_UUID_HASH = Buffer.from(
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "hex",
);
const PRODUCT_UUID_HASH = Buffer.from(
  "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
  "hex",
);
const MALFORMED_MFR_HASH = Buffer.alloc(32, 0x41);
const MALFORMED_PROD_HASH = Buffer.alloc(32, 0x42);

const svm = new LiteSVM().withBlockhashCheck(false).withTransactionHistory(0n);
svm.addProgramFromFile(PROGRAM_ID_PK, SO_PATH);

const authority = await generateKeyPairSigner();
const alice = await generateKeyPairSigner();
const bob = await generateKeyPairSigner();
const outsider = await generateKeyPairSigner();

svm.airdrop(authority.address, lamports(20_000_000_000n));
svm.airdrop(alice.address, lamports(10_000_000_000n));
svm.airdrop(bob.address, lamports(10_000_000_000n));
svm.airdrop(outsider.address, lamports(10_000_000_000n));

const [mfrPda] = await deriveManufacturerPda(MFR_UUID_HASH, PROGRAM_ID_PK);
const [productPda] = await deriveProductPda(PRODUCT_UUID_HASH, mfrPda, PROGRAM_ID_PK);

async function send(
  payer: KeyPairSigner,
  ixs: Instruction[],
): Promise<void> {
  let msg = createTransactionMessage({ version: 0 });
  msg = setTransactionMessageFeePayerSigner(payer, msg as never);
  for (const ix of ixs) {
    msg = appendTransactionMessageInstruction(ix, msg as never);
  }
  const msgWithLifetime = svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg as never);
  const tx = await signTransactionMessageWithSigners(msgWithLifetime as never);
  const res = svm.sendTransaction(tx as never);
  if (res instanceof FailedTransactionMetadata) {
    const outer = res.err() as unknown;
    const isAlreadyProcessed =
      typeof outer === "number" ? outer === 6 : String(outer) === "AlreadyProcessed" || String(outer) === "6";
    if (isAlreadyProcessed) {
      throw new Error(
        "transaction was short-circuited as AlreadyProcessed and never reached the program",
      );
    }
    const customCode = extractCustomErrorCode(res);
    const text =
      typeof outer === "object" && outer !== null && typeof (outer as { toString?: unknown }).toString === "function"
        ? (outer as { toString: () => string }).toString()
        : String(outer);
    throw new Error(`transaction failed: ${text} (customCode=${String(customCode)})`);
  }
}

/**
 * LiteSVM exposes transaction errors as napi classes whose `toString()`
 * collapses to just the enum discriminant (e.g. `"6"`), losing the inner
 * custom error code. Unwrap the real chain:
 *   err() -> TransactionErrorInstructionError -> .err() -> InstructionErrorCustom -> .code
 */
function extractCustomErrorCode(res: FailedTransactionMetadata): number | null {
  // NAPI-RS exposes napi classes whose own toString() collapses to just the
  // enum discriminant, but the useful information survives as string-typed
  // properties (`err` on the outer error, `error` on InstructionError*).
  // Walk whatever surface is actually present instead of trusting toString().
  const walk = (node: unknown, depth: number): number | null => {
    if (node === null || node === undefined || depth > 6) return null;
    if (typeof node === "number") return node;
    if (typeof node === "string") {
      const custom = node.match(/Custom\((\d+)\)/);
      if (custom) return Number(custom[1]);
      const bare = node.match(/(?<![\w.])(\d+)$/);
      return bare ? Number(bare[1]) : null;
    }
    if (typeof node !== "object") return null;
    const props = node as Record<string, unknown>;
    for (const key of ["code", "err", "error"]) {
      const found = walk(props[key], depth + 1);
      if (found !== null) return found;
    }
    for (const key of ["err", "error"]) {
      const method = (node as { [k: string]: unknown })[key];
      if (typeof method === "function") {
        try {
          const found = walk(method.call(node), depth + 1);
          if (found !== null) return found;
        } catch {
          // fall through to toString
        }
      }
    }
    const text = String(node);
    const custom = text.match(/Custom\((\d+)\)/);
    return custom ? Number(custom[1]) : null;
  };
  return walk(res.err(), 0);
}

async function expectCustom(
  payer: KeyPairSigner,
  ixs: Instruction[],
  code: number,
): Promise<void> {
  let msg = createTransactionMessage({ version: 0 });
  msg = setTransactionMessageFeePayerSigner(payer, msg as never);
  for (const ix of ixs) {
    msg = appendTransactionMessageInstruction(ix, msg as never);
  }
  const msgWithLifetime = svm.setTransactionMessageLifetimeUsingLatestBlockhash(msg as never);
  const tx = await signTransactionMessageWithSigners(msgWithLifetime as never);
  const res = svm.sendTransaction(tx as never);
  assert.ok(res instanceof FailedTransactionMetadata, "expected transaction to fail");
  const customCode = extractCustomErrorCode(res);
  if (customCode === null || customCode !== code) {
    const outer = res.err() as unknown;
    const text =
      typeof outer === "object" && outer !== null && typeof (outer as { toString?: unknown }).toString === "function"
        ? (outer as { toString: () => string }).toString()
        : String(outer);
  const meta =
    typeof res.meta === "function"
      ? (res.meta() as unknown as { logs?: unknown })
      : undefined;
  const rawLogs = meta?.logs as unknown;
  const logs: string[] = Array.isArray(rawLogs)
    ? rawLogs.map(String)
    : rawLogs && typeof (rawLogs as { length?: unknown }).length === "number"
      ? Array.from(rawLogs as ArrayLike<unknown>, String)
      : [];
    assert.fail(
      `expected custom error ${code}, got ${customCode}\n` +
        `err: ${text}\n` +
        (logs.length ? `logs:\n${logs.join("\n")}` : ""),
    );
  }
}

/**
 * Resend an instruction that is guaranteed to carry a distinct signature, so
 * LiteSVM cannot short-circuit it as AlreadyProcessed. A fresh fee payer
 * changes the signed message without touching instruction data, so the
 * program still sees exactly the instruction under test.
 */
async function expectCustomFromNewSigner(
  ixs: Instruction[],
  code: number,
): Promise<void> {
  const freshPayer = await generateKeyPairSigner();
  svm.airdrop(freshPayer.address, lamports(20_000_000_000n));
  const rewritten = ixs.map((ix) => {
    const signerIndex = ix.accounts?.findIndex(
      (acct) => acct.role === AccountRole.READONLY_SIGNER || acct.role === AccountRole.WRITABLE_SIGNER,
    );
    return {
      ...ix,
      accounts: ix.accounts?.map((acct, index) =>
        index === signerIndex ? { ...acct, address: freshPayer.address } : acct,
      ),
    };
  });
  await expectCustom(freshPayer, rewritten, code);
}

function readAccountData(addr: Address): Buffer {
  const acct = svm.getAccount(addr);
  assert.ok(acct, "account should exist");
  return Buffer.from((acct as { data: Uint8Array }).data);
}

async function setMalformedManufacturerAccount(addr: Address, discriminator: number): Promise<void> {
  const data = Buffer.alloc(MANUFACTURER_SIZE);
  data[0] = discriminator;
  data.fill(0x42, 1);
  await setRawAccount(addr, data, PROGRAM_ID_PK);
}

async function setMalformedProductAccount(addr: Address, discriminator: number): Promise<void> {
  const data = Buffer.alloc(PRODUCT_SIZE);
  data[0] = discriminator;
  data.fill(0x42, 1);
  await setRawAccount(addr, data, PROGRAM_ID_PK);
}

async function setRawAccount(addr: Address, data: Buffer, owner: Address): Promise<void> {
  (svm as unknown as { setAccount: (a: unknown) => void }).setAccount({
    address: addr,
    lamports: 1_000_000_000n,
    data: new Uint8Array(data),
    programAddress: owner,
    executable: false,
  });
}

// --- manufacturer ---------------------------------------------------------

test("initialize succeeds", async () => {
  await send(authority, [
    buildInitializeManufacturerIx(mfrPda, authority.address, MFR_UUID_HASH, PROGRAM_ID_PK),
  ]);
  const data = readAccountData(mfrPda);
  const decoded = decodeManufacturer(data);
  assert.ok(decoded);
  assert.equal(decoded.authority, authority.address);
  assert.equal(decoded.isActive, true);
  assert.ok(Buffer.from(decoded.uuidHash).equals(MFR_UUID_HASH));
});

test("deterministic manufacturer PDA", async () => {
  const [again] = await deriveManufacturerPda(MFR_UUID_HASH, PROGRAM_ID_PK);
  assert.equal(again, mfrPda);
});

test("duplicate initialization rejected", async () => {
  // test 1 already initialized this PDA; resend under a fresh signer so the
  // duplicate path is reached with a distinct signature.
  await expectCustomFromNewSigner(
    [buildInitializeManufacturerIx(mfrPda, authority.address, MFR_UUID_HASH, PROGRAM_ID_PK)],
    0,
  );
});

// --- product registration --------------------------------------------------

test("correct manufacturer authority succeeds", async () => {
  await send(authority, [
    buildRegisterProductIx(
      productPda,
      mfrPda,
      authority.address,
      alice.address,
      PRODUCT_UUID_HASH,
      PROGRAM_ID_PK,
    ),
  ]);
  const data = readAccountData(productPda);
  const decoded = decodeProduct(data);
  assert.ok(decoded);
  assert.equal(decoded.currentOwner, alice.address);
  assert.equal(decoded.manufacturer, mfrPda);
  assert.equal(decoded.transferCount, 0);
  assert.equal(decoded.status, 0); // Active
});

test("deterministic product PDA", async () => {
  const [again] = await deriveProductPda(PRODUCT_UUID_HASH, mfrPda, PROGRAM_ID_PK);
  assert.equal(again, productPda);
});

test("unauthorized authority fails", async () => {
  await expectCustom(
    outsider,
    [
      buildRegisterProductIx(
        productPda,
        mfrPda,
        outsider.address,
        alice.address,
        PRODUCT_UUID_HASH,
        PROGRAM_ID_PK,
      ),
    ],
    1,
  );
});

test("duplicate registration fails", async () => {
  // test 4 already registered this product. Transaction history is disabled
  // (withTransactionHistory(0n)) so a byte-identical resend is not
  // short-circuited as AlreadyProcessed and reaches the program's
  // duplicate-registration check.
  await expectCustom(
    authority,
    [
      buildRegisterProductIx(
        productPda,
        mfrPda,
        authority.address,
        alice.address,
        PRODUCT_UUID_HASH,
        PROGRAM_ID_PK,
      ),
    ],
    2,
  );
});

test("correct initial owner stored", () => {
  const data = readAccountData(productPda);
  const decoded = decodeProduct(data);
  assert.ok(decoded);
  assert.equal(decoded.currentOwner, alice.address);
});

test("manufacturer A cannot register under manufacturer B", async () => {
  const mfrBHash = Buffer.alloc(32, 3);
  const [mfrBPda] = await deriveManufacturerPda(mfrBHash, PROGRAM_ID_PK);
  await send(outsider, [
    buildInitializeManufacturerIx(mfrBPda, outsider.address, mfrBHash, PROGRAM_ID_PK),
  ]);
  const prodBHash = Buffer.alloc(32, 9);
  const [prodBPda] = await deriveProductPda(prodBHash, mfrBPda, PROGRAM_ID_PK);
  await expectCustom(
    authority,
    [
      buildRegisterProductIx(
        prodBPda,
        mfrBPda,
        authority.address,
        alice.address,
        prodBHash,
        PROGRAM_ID_PK,
      ),
    ],
    1,
  );
});

test("malformed / incorrect PDA rejected", async () => {
  const wrongPda = (await generateKeyPairSigner()).address;
  await expectCustom(
    authority,
    [
      buildRegisterProductIx(
        wrongPda,
        mfrPda,
        authority.address,
        alice.address,
        PRODUCT_UUID_HASH,
        PROGRAM_ID_PK,
      ),
    ],
    8,
  );
});

// --- ownership transfer ----------------------------------------------------

test("current owner succeeds", async () => {
  await send(alice, [
    buildTransferProductIx(productPda, alice.address, bob.address, PROGRAM_ID_PK),
  ]);
  const data = readAccountData(productPda);
  const decoded = decodeProduct(data);
  assert.ok(decoded);
  assert.equal(decoded.currentOwner, bob.address);
  assert.equal(decoded.transferCount, 1);
});

test("non-owner fails", async () => {
  await expectCustom(
    outsider,
    [buildTransferProductIx(productPda, outsider.address, alice.address, PROGRAM_ID_PK)],
    3,
  );
});

test("same-owner transfer fails", async () => {
  await expectCustom(
    bob,
    [buildTransferProductIx(productPda, bob.address, bob.address, PROGRAM_ID_PK)],
    4,
  );
});

test("transfer_count increments exactly once", () => {
  const data = readAccountData(productPda);
  const decoded = decodeProduct(data);
  assert.ok(decoded);
  assert.equal(decoded.transferCount, 1);
});

test("second transfer works from new owner", async () => {
  await send(bob, [
    buildTransferProductIx(productPda, bob.address, alice.address, PROGRAM_ID_PK),
  ]);
  const data = readAccountData(productPda);
  const decoded = decodeProduct(data);
  assert.ok(decoded);
  assert.equal(decoded.currentOwner, alice.address);
  assert.equal(decoded.transferCount, 2);
});

test("manufacturer cannot take ownership back", async () => {
  await expectCustom(
    authority,
    [buildTransferProductIx(productPda, authority.address, authority.address, PROGRAM_ID_PK)],
    3,
  );
});

test("product/manufacturer identity stays unchanged", () => {
  const data = readAccountData(productPda);
  const decoded = decodeProduct(data);
  assert.ok(decoded);
  assert.equal(decoded.manufacturer, mfrPda);
  assert.ok(Buffer.from(decoded.uuidHash).equals(PRODUCT_UUID_HASH));
  assert.equal(decoded.discriminator, 2);
  assert.equal(decoded.status, 0);
});

// --- malformed accounts must not masquerade as duplicates --------------------

test("malformed existing account is not reported as already initialized", async () => {
  const [malformedPda] = await deriveManufacturerPda(MALFORMED_MFR_HASH, PROGRAM_ID_PK);
  await setMalformedManufacturerAccount(malformedPda, 0x99);
  await expectCustom(
    authority,
    [
      buildInitializeManufacturerIx(
        malformedPda,
        authority.address,
        MALFORMED_MFR_HASH,
        PROGRAM_ID_PK,
      ),
    ],
    9,
  );
});

test("malformed existing product account is not reported as already registered", async () => {
  const [malformedProdPda] = await deriveProductPda(
    MALFORMED_PROD_HASH,
    mfrPda,
    PROGRAM_ID_PK,
  );
  await setMalformedProductAccount(malformedProdPda, 0x99);
  await expectCustom(
    authority,
    [
      buildRegisterProductIx(
        malformedProdPda,
        mfrPda,
        authority.address,
        alice.address,
        MALFORMED_PROD_HASH,
        PROGRAM_ID_PK,
      ),
    ],
    9,
  );
});
