// Fetch helpers for RecallRelay accounts on Devnet.

import { Connection, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, RPC_URL } from "./deployment";
import { decodeManufacturer, decodeProduct } from "./instructions";
import type { ManufacturerAccount, ProductAccount } from "./types";

/** Fetch and decode a manufacturer account. Returns null if not found or invalid. */
export async function fetchManufacturerAccount(
  address: PublicKey,
  connection: Connection = new Connection(RPC_URL, "confirmed"),
  programId: PublicKey = new PublicKey(PROGRAM_ID),
): Promise<ManufacturerAccount | null> {
  const info = await connection.getAccountInfo(address);
  if (!info) return null;
  if (!info.owner.equals(programId)) return null;
  return decodeManufacturer(Buffer.from(info.data));
}

/** Fetch and decode a product account. Returns null if not found or invalid. */
export async function fetchProductAccount(
  address: PublicKey,
  connection: Connection = new Connection(RPC_URL, "confirmed"),
  programId: PublicKey = new PublicKey(PROGRAM_ID),
): Promise<ProductAccount | null> {
  const info = await connection.getAccountInfo(address);
  if (!info) return null;
  if (!info.owner.equals(programId)) return null;
  return decodeProduct(Buffer.from(info.data));
}
