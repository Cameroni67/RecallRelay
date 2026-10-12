// Server-side Solana reading for RecallRelay Phase 3.
//
// The rule this module exists to enforce: **the client never supplies chain
// state**. A client submits only an identifier (manufacturer id / unit id)
// and, where relevant, a transaction signature it claims happened. This
// module reads the account straight from the cluster and returns what the
// chain actually says. The reconcile routes pass those observed values to
// the trusted RPCs; nothing the client sends is treated as fact.

import { createHash } from "node:crypto";
import { Connection, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, RPC_URL } from "./deployment";
import { fetchManufacturerAccount, fetchProductAccount } from "./program";
import type { ManufacturerAccount, ProductAccount } from "./types";

export { PROGRAM_ID, RPC_URL };

/** sha256 of a UUID/string identifier — matches the program's PDA seed hash. */
export function hashIdentifier(identifier: string): Buffer {
  return createHash("sha256").update(identifier, "utf8").digest();
}

/** Derive the manufacturer PDA for a raw 32-byte seed hash. */
export function manufacturerPdaFor(
  uuidHash: Buffer,
  programId: PublicKey = new PublicKey(PROGRAM_ID),
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("manufacturer"), uuidHash],
    programId,
  )[0];
}

/** Derive the product PDA for a raw 32-byte seed hash under a manufacturer. */
export function productPdaFor(
  uuidHash: Buffer,
  manufacturerPda: PublicKey,
  programId: PublicKey = new PublicKey(PROGRAM_ID),
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("product"), manufacturerPda.toBuffer(), uuidHash],
    programId,
  )[0];
}

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

/**
 * Fetch a confirmed transaction's signature and verify it was signed by the
 * given wallet. Returns false when the signature does not exist or was not
 * signed by that wallet — used so a client cannot attribute an unrelated
 * transaction to a unit.
 */
export async function transactionSignedBy(
  connection: Connection,
  signature: string,
  wallet: PublicKey,
): Promise<boolean> {
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) return false;
  const message = tx.transaction.message;
  const keys =
    "accountKeys" in message && Array.isArray(message.accountKeys)
      ? message.accountKeys
      : message.staticAccountKeys;
  const accountKeys = keys.map((key: { toBase58: () => string } | string) =>
    typeof key === "string" ? key : key.toBase58(),
  );
  const index = accountKeys.indexOf(wallet.toBase58());
  if (index < 0) return false;
  const signed = tx.transaction.signatures[index];
  return Boolean(signed);
}

export type ObservedManufacturer = {
  pda: string;
  authority: string;
  isActive: boolean;
  account: ManufacturerAccount;
};

/**
 * Read the manufacturer account for an id. `identifier` is the raw seed the
 * program hashed (the manufacturer's on-chain uuid). Returns null when the
 * account does not exist yet.
 */
export async function observeManufacturer(
  identifier: string,
  connection: Connection = getConnection(),
): Promise<ObservedManufacturer | null> {
  const uuidHash = hashIdentifier(identifier);
  const pda = manufacturerPdaFor(uuidHash);
  const account = await fetchManufacturerAccount(pda, connection);
  if (!account) return null;
  return {
    pda: pda.toBase58(),
    authority: account.authority,
    isActive: account.isActive,
    account,
  };
}

export type ObservedProduct = {
  pda: string;
  manufacturer: string;
  currentOwner: string;
  transferCount: number;
  isActive: boolean;
  account: ProductAccount;
};

/**
 * Read the product account for a unit. `unitIdentifier` is the raw seed the
 * program hashed (the unit's on-chain uuid) and `manufacturerIdentifier` the
 * manufacturer's. Returns null when the account does not exist yet.
 */
export async function observeProduct(
  unitIdentifier: string,
  manufacturerIdentifier: string,
  connection: Connection = getConnection(),
): Promise<ObservedProduct | null> {
  const manufacturerHash = hashIdentifier(manufacturerIdentifier);
  const manufacturerPda = manufacturerPdaFor(manufacturerHash);
  const uuidHash = hashIdentifier(unitIdentifier);
  const pda = productPdaFor(uuidHash, manufacturerPda);
  const account = await fetchProductAccount(pda, connection);
  if (!account) return null;
  return {
    pda: pda.toBase58(),
    manufacturer: account.manufacturer,
    currentOwner: account.currentOwner,
    transferCount: account.transferCount,
    isActive: account.status === 0,
    account,
  };
}

/**
 * A wallet's on-chain SOL balance, used to tell "no funds" apart from other
 * failures before asking a user to sign.
 */
export async function walletLamports(
  wallet: string,
  connection: Connection = getConnection(),
): Promise<bigint> {
  const balance = await connection.getBalance(new PublicKey(wallet), "confirmed");
  return BigInt(balance);
}
