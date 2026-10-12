// PDA derivation for RecallRelay, matching the on-chain program exactly.
//
// Seeds:
//   manufacturer: ["manufacturer", sha256(manufacturer_uuid)]
//   product:      ["product", manufacturer_pda, sha256(product_uuid)]
//
// sha256 here is Solana's `hashv` on the program side, which is plain
// SHA-256 of the input bytes. `@solana/kit` derives the same PDA via
// `getProgramDerivedAddress` when given identical seeds.

import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from "@solana/kit";
import { PROGRAM_ID } from "./deployment";

/** Derive a manufacturer PDA and its bump. */
export async function deriveManufacturerPda(
  uuidHash: Uint8Array,
  programId: Address = address(PROGRAM_ID),
): Promise<[Address, number]> {
  const result = await getProgramDerivedAddress({
    programAddress: programId,
    seeds: [Buffer.from("manufacturer"), Buffer.from(uuidHash)],
  });
  return [result[0] as Address, result[1] as number];
}

/** Derive a product PDA and its bump. */
export async function deriveProductPda(
  uuidHash: Uint8Array,
  manufacturerPda: Address,
  programId: Address = address(PROGRAM_ID),
): Promise<[Address, number]> {
  const manufacturerPdaBytes = getAddressEncoder().encode(manufacturerPda);
  const result = await getProgramDerivedAddress({
    programAddress: programId,
    seeds: [Buffer.from("product"), manufacturerPdaBytes, Buffer.from(uuidHash)],
  });
  return [result[0] as Address, result[1] as number];
}
